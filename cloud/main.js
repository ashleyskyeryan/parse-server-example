Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

var _ = require('underscore');
var cons = require('../cloud/cons.js');

var Question = Parse.Object.extend('Question');
var Activity = Parse.Object.extend('Activity');
var Answer = Parse.Object.extend('Answer');

var BadgeUtil = require('../cloud/badges.js');

var ParseQuery = require('../cloud/utils/parsequery.js');

var PUSH_FOLLOWING_CREATED = "push_following_created_poll";
var PUSH_FOLLOWING_VOTED = "push_following_voted";
var PUSH_START_FOLLOWING = "push_start_following";
var PUSH_FIRST_ANSWER_TRIGGER = "push_first_answer_trigger";
var PUSH_EVERY_FIVE_ANSWER_TRIGGER = "push_every_five_answer_trigger";
var PUSH_MORE_ANSWER_TRIGGER_CREATE = "push_more_answer_trigger_create";
var PUSH_RESULTS_PER_3HRS = "push_results_per_3hrs";

// Try to keep the like count in sync.
var updateLikeCount = function(num) {
    return function(request) {
        // Bypass ACLs
        Parse.Cloud.useMasterKey();

        var like = request.object;

        if (!like.existed()) {
            var question = like.get('question').fetch();
            question.then(function(q) {
                q.increment('likes', num);
                q.save();
            });
        }
    };
};

var TYPE_ACTIVITY_CREATE = 1;
var TYPE_ACTIVITY_SOMEBODY_VOTE = 2;
var TYPE_ACTIVITY_YOU_HAVE_THIS_MANY_VOTES = 3;
var TYPE_ACTIVITY_SOMEBODY_FOLLOW = 4;

var TRIGGER_TOTAL_ANSWERS_FOR_INITIAL = 1;
var TRIGGER_TOTAL_ANSWERS_FOR_INTERVAL = 5;
var TRIGGER_TOTAL_ANSWERS_FOR_CREATOR = 25;

var beforeAnswerSave = function(request, response) {
    var answer = request.object;
    var question = answer.get("question");

    if (request.master) {
        response.success();
        return;
    }

    var query = new Parse.Query(Answer);
    query.equalTo("createdBy", answer.get("createdBy"));
    query.equalTo("question", question);
    query.first({
        success: function(object) {
            if (object == null) {
                answer.set('questionId', question.id);
                response.success();
            } else {
                response.error("Can't vote on the same question twice.");
            }
        },
        error: function(error) {
            response.error("Error " + error.code + " : " + error.message + " when getting answer first.");
        }
    });
};

var afterAnswerSave = function(request) {
    var answer = request.object;
    if (answer.createdAt.getTime() === answer.updatedAt.getTime()) {
        updateAnswerCount(request, 1);
    }
}

var afterAnswerDelete = function(request) {
    updateAnswerCount(request, -1);
}

var updateAnswerCount = function(request, num) {
    // to prevent server request limit of parse, we do not update when the number is decreasing.
    if(num < 0) {
        return;
    }

   Parse.Cloud.useMasterKey();

    var answerMapping = ['oneResponses', 'twoResponses', 'threeResponses', 'dislikes'];



    var answer = request.object;

    console.log("==== updateAnswer Count " + num + " questino " + answer);

    var question = answer.get('question').fetch();
    question.then(function(q) {
        if (q == null) {
            return;
        }

        q.increment(answerMapping[answer.get('answer')], num);
        q.save().then(function(question) {

            if (answer.get('answer') > 2) {
                return;
            }

            var userPointer = q.get('createdBy').fetch();
            userPointer.then(function(user) {
                user.increment('numVotes', num);
                user.save();
                if(num > 0) {
                    BadgeUtil.notifyNewAnswerCreated(answer, q, user, num);
                }
            });
        });

        // if answer is greater than 2, means it has been skipped by user
        if (answer.get('answer') > 2) {
            return;
        }

        if(num > 0) {
            handlePush(answer, q);
        }
    });};

var incrementUserPollCount = function(amount) {
    return function(request) {
        Parse.Cloud.useMasterKey();

        var question = request.object;

        console.log("==== incrementUserPollCount " + amount + " questino " + question);

        // TODO: workaround for server bug since we don't strictly need this
        if (!question.existed() || (amount < 0)) {


            var userPointer = question.get('createdBy');
            userPointer.fetch().then(function(user) {
                if (user == null) {
                    return;
                }

                console.log("==== really incrementUserPollCount " + amount + " questino " + question);


                user.increment('numPolls', amount);
                user.save();

                BadgeUtil.notifyNewPollCreated(question, user, amount);

            });
        }
    }
};

function handlePush(answer, question) {
    // lets calculate all the answers
    var totalAnswerNumber = (question.get('oneResponses') || 0) + (question.get('twoResponses') || 0) + (question.get('threeResponses') || 0);

    console.log("total number = " + totalAnswerNumber);

    if (totalAnswerNumber == 0) {
        return;
    }

    if (totalAnswerNumber == TRIGGER_TOTAL_ANSWERS_FOR_INITIAL) {
        // trigger first answer
        var voter = answer.get("createdBy").fetch();

        voter.then(function(v) {
            var creator = question.get("createdBy").fetch();
            creator.then(function(c) {
                if (c == null || c.id === v.id) {
                    return;
                }

                var activityMessage = v.get("username") + " voted on your poll.";
                var message = activityMessage + " See poll results.";

                question.set("pAnswerCnt", totalAnswerNumber);
                question.save();

                var uristr = cons.getHostName() + "posts/" + question.id;

                createActivityObjectAndSendPushNotification(TYPE_ACTIVITY_SOMEBODY_VOTE,
                    c, message, activityMessage, uristr, v, question, true, null, null, PUSH_FIRST_ANSWER_TRIGGER);
            });
        });
    } else if (totalAnswerNumber == TRIGGER_TOTAL_ANSWERS_FOR_CREATOR) {
        // trigger creation promotion
        var creator = question.get("createdBy").fetch();
        creator.then(function(c) {
            if (c == null) {
                return;
            }

            var activityMessage = "Your poll got " + totalAnswerNumber + " votes!";
            var message = activityMessage + " Create a new one!";

            var uristr = cons.getHostName() + "create";
            createActivityObjectAndSendPushNotification(TYPE_ACTIVITY_CREATE,
                c, message, activityMessage, uristr, null, question, true, null, null, PUSH_MORE_ANSWER_TRIGGER_CREATE);

        });
    } else if (totalAnswerNumber % TRIGGER_TOTAL_ANSWERS_FOR_INTERVAL == 0) {
        // send push for every 5 votes for each poll
        var previousPushcount = question.get("pAnswerCnt") || 0;
        console.log("here send push when total answer num is " + totalAnswerNumber + ", previous answer num is " + previousPushcount);
        if (totalAnswerNumber > previousPushcount) {
                var voter = answer.get("createdBy").fetch();

                voter.then(function(v) {
                    var creator = question.get("createdBy").fetch();
                    creator.then(function(c) {
                        if (c == null || c.id === v.id) {
                            return;
                        }

                        var userName = v.get('username');
                        var activityMessage;
                        var moreAnswerCount = totalAnswerNumber - previousPushcount - 1;
                        if (moreAnswerCount == 0) {
                            activityMessage = userName + " voted on your poll.";
                        } else if (moreAnswerCount == 1) {
                            activityMessage = userName + " & " + moreAnswerCount + " other person voted on your poll.";
                        } else {
                            activityMessage = userName + " & " + moreAnswerCount + " people voted on your poll.";
                        }

                        console.log("here save activity message " + activityMessage);
                        var message = activityMessage + " See poll results.";
                        question.set("pAnswerCnt", totalAnswerNumber);
                        question.save();

                        var uristr = cons.getHostName() + "posts/" + question.id;

                        createActivityObjectAndSendPushNotification(TYPE_ACTIVITY_SOMEBODY_VOTE,
                            c, message, activityMessage, uristr, v, question, true, null, null, PUSH_EVERY_FIVE_ANSWER_TRIGGER);
                    });

                });
        }
    }
}

function createActivityObjectAndSendPushNotification(activityType, targetUser, message, activityMessage, uri, actionUser, question, sendingPushNotifcation, subMessage, destination, type) {
    var act = new Activity();

    act.set("activityType", activityType);
    act.set("targetUser", targetUser);
    act.set("message", activityMessage);
    if(subMessage != null) {
        act.set("subMessage", subMessage);
    }
    act.set("uri", uri);
    if (actionUser != null) {
        act.set("actionUser", actionUser);
        console.log("actionUser is not null : " + actionUser.id + " question id " + question.id + " sendingPushNotification " + sendingPushNotifcation);

    } else {
        console.log("actionUser is null " + sendingPushNotifcation);
    }
    act.set("question", question);

    //    var sendingPushNotification2 = sendingPushNotifcation;

    act.save(null, {
        success: function(activity) {
            console.log("yeah new activity is saved " + activity.id + " sendingPushNotification= " + sendingPushNotifcation);
            // now send push message.

            if (sendingPushNotifcation) {
                var uristr
                if(destination == null) {
                    uristr = cons.getHostName() + "activities/" + activity.id;
                } else {
                    uristr = destination;
                }

                sendActivityPushToUser(targetUser, message, uristr, type);
            }

        },
        error: function(activity, error) {
            console.log("Failed to create new object, with error code: " + error.message);
        }
    });

}

function sendActivityPushToUser(user, message, uristr, type) {

    var query = new Parse.Query(Parse.Installation);

    query.equalTo('currentUser', user);

    user.set("unreadActivities", 1);
    user.save();

    Parse.Push.send({
        where: query, // Set our Installation query
        data: {
            alert: message,
            uri: uristr,
            type: type
        }
    }, {
        success: function() {
            // Push was successful
            console.log('push message success : ' + "sendActivityPushToUser" + message + user + uristr);
        },
        error: function(error) {
            // Handle error
            console.log('push message fail : ' + "sendActivityPushToUser" + message + user + uristr);
        }
    });
}

Parse.Cloud.afterSave('Like', updateLikeCount(1));
Parse.Cloud.afterDelete('Like', updateLikeCount(-1));

Parse.Cloud.beforeSave('Answer', beforeAnswerSave);

Parse.Cloud.afterSave('Answer', afterAnswerSave);
Parse.Cloud.afterDelete('Answer', afterAnswerDelete);

Parse.Cloud.afterSave('Question', incrementUserPollCount(1));
Parse.Cloud.afterDelete('Question', incrementUserPollCount(-1));


function sendPushIfAllTheQuestion(numberOfQuestionsToHandle, map) {

    if (numberOfQuestionsToHandle == 0) {

        for (var prop in map) {
            var pushData = map[prop];
            var targetUser = pushData["targetUser"];
            var answererName = pushData["answererName"];
            var countBesideOne = pushData["count"];

            var userName = answererName;

            console.log("prop " + prop + " count " + countBesideOne);

            var message;
            if (countBesideOne == 0) {
                message = userName + " voted on your polls. See poll results.";
            } else if (countBesideOne == 1) {
                message = userName + " & " + countBesideOne + " other person voted on your polls. See poll results.";
            } else if (countBesideOne > 10) {
                message = userName + " & 10+ people voted on your poll.";
            } else {
                message = userName + " & " + countBesideOne + " people voted on your polls. See poll results.";
            }

            var uristr = cons.getHostName() + "activities/";

            console.log("sending push messages " + targetUser.id + " message=" + message);

            sendActivityPushToUser(targetUser, message, uristr, PUSH_RESULTS_PER_3HRS);

        }

    } else {
        // console.log(" there are still questions to handle left " + numberOfQuestionsToHandle);
    }
}

// this part can be belong to Follow if we separate the js code into files.

var updateFollowCount = function(request, num) {

    Parse.Cloud.useMasterKey();

    var follow = request.object;
    if (follow == null) {
        console.log("follow object is null!");
        return;
    }

    var follower = follow.get('follower').fetch();
    var followee = follow.get('followee').fetch();
    follower.then(function(user) {
        if (user == null) {
            return;
        }
        user.increment('numFollowees', num);
        user.save();
    });
    followee.then(function(user) {
        if (user == null) {
            return;
        }
        user.increment('numFollowers', num);
        user.save();
    });
};

var afterFollowDelete = function(request) {
    updateFollowCount(request, -1);
}

var afterFollowSave = function(request) {
    var follow = request.object;
    if (follow.createdAt.getTime() === follow.updatedAt.getTime()) {
        updateFollowCount(request, 1);
        // may need to do it only for the first time creation.
        handleFollowingPush(follow);
    }
}

Parse.Cloud.afterSave('Follow', afterFollowSave);
Parse.Cloud.afterDelete('Follow', afterFollowDelete);

function handleFollowingPush(follow) {
    if(follow == null) {
        console.error("handleFollowingPush follow is empty");
        return;
    }
    follow.fetch().then(function(followObject) {
        if (followObject == null) {
            console.error("handleFollowingPush follow could not be fetched");
            return;
        }

        var follower = followObject.get("follower");
        var followee = followObject.get("followee");

        if(follower == null || followee == null) {
            console.error("handleFollowingPush either follower or followee is empty");
            return;
        }

        if(followee.id != null && follower.id != null && followee.id == follower.id) {
            console.error("requesting user is following user so we do not record this " + followee.id);
            return;
        }

        // lets find out whether already folowing activity is fired.
        var activityQuery = new Parse.Query(Activity);
        activityQuery.equalTo("actionUser", follower);
        activityQuery.equalTo("targetUser", followee);
        activityQuery.equalTo("activityType", TYPE_ACTIVITY_SOMEBODY_FOLLOW);
        activityQuery.first({
            success: function(object) {
                if (object == null) {
                    processFollowingPush(follower, followee);
                } else {
                    console.log("handleFollowingPush alreayd isFollowing fired " + follower.id + " followed " + followee.id );
                }
            },
            error: function(error) {
                console.log("handleFollowingPush can not find activity " + follower.id + " followed " + followee.id );
            }
        });

    });
}

function processFollowingPush(follower, followee) {

    if(follower == null || followee == null) {
        console.error("processFollowingPush can not find follower or followee");
        return;
    }

    // let's try to find the question for the followee
    // this is for backward compatibility for version before 2.0.6
    // they expect a question to draw in user activity
    var questionQuery = new Parse.Query(Question);
    questionQuery.equalTo("createdBy", followee);
    questionQuery.descending('createdAt');
    questionQuery.first({
        success: function(object) {

            //console.log("processFollowingPush " + object.id + " followerId " + follower.id + " followeeId " + followee.id );

            if (object == null) {
                // since followee does not have any question. let's use lastest poll instead.
                var firstQuestionQuery = new Parse.Query(Question);
                firstQuestionQuery.descending('createdAt');
                firstQuestionQuery.first({

                    success: function(firstQuestion) {

                        //console.log("processFollowingPush " + firstQuestion.id + " followerId " + follower.id + " followeeId " + followee.id );

                        if (firstQuestion == null) {
                            // since followee does not have any question. let's use lastest poll instead.
                            console.error("could not find any question so we skip the following push follow");
                        } else {
                            processFollowingPushWithQuestion(follower, followee, firstQuestion);
                        }
                    },
                    error: function(error) {
                        console.log("processFollowingPush can not find first question");
                    }
                })

            } else {
                processFollowingPushWithQuestion(follower, followee, object);
            }
        },
        error: function(error) {

            console.log("processFollowingPush can not find first question");

        }
    });
}

function processFollowingPushWithQuestion(follower, followee, question) {

    if(follower == null || followee == null || question == null) {
        console.error("processFollowingPushWithQuestion not enough information to send push");
    }

//    console.log("processFollowingPushWithQuestion " + question.id + " followerId " + follower.id + " followeeId " + followee.id );

    follower.fetch().then(function(object) {
        if (object == null) {
            console.error("processFollowingPushWithQuestion follow could not be fetched");
            return;
        }

        var uname = object.get("username");
        if(uname.length > 24) {
            console.log("isFollowing username is too long before fb issue " + uname);
            return;
        }

        var uristr = cons.getHostName() + "posts/" + question.id;
        var message = object.get("username") + " is following you.";
        var subMessage = "Follow back to see their polls."

        createActivityObjectAndSendPushNotification(TYPE_ACTIVITY_SOMEBODY_FOLLOW,
                        followee, message, message, uristr, follower, question, true, subMessage, cons.getHostName() + "profile/" + follower.id, PUSH_START_FOLLOWING);
    });
}


//////////////////////////////////////////////
// push for somebody followed created a new poll
/////////////////////////////////////////////

// need to chain it.
function handleFollowCreatingNewPoll(page, pageSize, skip, remainingLimit) {

    console.log("handleFollowCreatingNewPoll entered " + page + " pageSize " + pageSize + " skip " + skip + " remainingLimit " + remainingLimit + " querySkip = " + skip + page * pageSize);

    if(remainingLimit <= 0) {
        console.log("handleFollowCreatingNewPoll we handled all the limit");
        return;
    }

    var target_pageSize = remainingLimit < pageSize ? remainingLimit : pageSize;

    var query = new Parse.Query(Parse.User);
    query.descending('createdAt');
    query.skip(skip + page * pageSize);
    query.limit(target_pageSize);

    query.find().then(function(results) {
        var numberOfUsersToHandle = results.length;
        console.log("number of users to Handle = " + numberOfUsersToHandle);

        for (var i = 0; i < results.length; i++) {
            var user = results[i];
            // let's find out all the users that this user is following.
            handleFollowCreatingNewPoll_findFollowings(user, i+skip);
        }

        if(numberOfUsersToHandle < target_pageSize) {
            console.log("handleFollowCreatingNewPoll no more data need to handle");
        } else {
            console.log("handleFollowCreatingNewPoll fetching next page");
            handleFollowCreatingNewPoll(page + 1, pageSize, skip, remainingLimit - numberOfUsersToHandle);
        }
    });
}


function handleFollowCreatingNewPoll_findFollowings(user, index) {

    console.log("handleFollowCreatingNewPoll_findFollowings handling user [" + index + "]" + user.get("username"));

    //Let's define a query to find users that this user follows
    var Follow = Parse.Object.extend('Follow');

    var followingQuery = new Parse.Query(Follow);
        followingQuery.descending("createdAt");
        followingQuery.equalTo("follower", user);
        followingQuery.notEqualTo("followee", user);
        followingQuery.limit(1000);

    var questionQuery = new Parse.Query(Question);
        questionQuery.descending("createdAt");
        questionQuery.include("createdBy");
        questionQuery.limit(1);
        questionQuery.matchesKeyInQuery("createdBy", "followee", followingQuery);

    questionQuery.find().then(function(results) {
        var numberOfQuestionsToHandle = results.length;

        if(numberOfQuestionsToHandle == 0) {
            return;
        }

        var question = results[0];

        // whether the question is answered already by the user.
        var answerQuery = new Parse.Query(Answer);
        answerQuery.equalTo('question', question);
        answerQuery.equalTo('createdBy', user);

        answerQuery.first({
            success: function(answer) {
                if (answer == null) {
                    // let's find out Follow data.
                    var followQuery = new Parse.Query(Follow);
                        followQuery.equalTo("follower", user);
                        followQuery.include("followee");
                        followQuery.equalTo("followee", question.get("createdBy"));

                        followQuery.first({
                            success: function(object) {
                                if (object == null) {
                                    console.error("handleFollowCreatingNewPoll_findFollowings should find matched Follow");
                                } else {
                                    // yes found the follow object.
                                    var previousPushedQuestion = object.get("previousPushedQuestion");
                                    if(previousPushedQuestion != null && previousPushedQuestion.id == question.id ) {
                                        console.log("already sent push about this question");
                                        return;
                                    }

                                    object.set("previousPushedQuestion", question);

                                    // now this is new creation from one of followings.
                                    object.save(null, {
                                        success: function(follow) {
                                            console.log("yeah new question is updated " + question.id + " previousPushedQuestion= " + question.id);
                                            // now send push message.
                                            var followee = follow.get("followee");
                                            if(followee != null && followee.get("username") != null) {
                                                var uristr = cons.getHostName() + "feed/" + question.id;
                                                var message = followee.get("username") + " created a new poll.";
                                                sendActivityPushToUser(user, message, uristr, PUSH_FOLLOWING_CREATED);
                                            } else {
                                                console.error("handleFollowCreatingNewPoll_findFollowings can not get followee username");
                                            }
                                        },
                                        error: function(activity, error) {
                                            console.log("Failed to create new object, with error code: " + error.message);
                                        }
                                    });
                                }
                            },
                            error: function(error) {
                                console.error("handleFollowCreatingNewPoll_findFollowings should find matched Follow");
                            }
                        });
                        // end of let's find out Follow data.

                } else {
                    console.log("handleFollowCreatingNewPoll_findFollowings question " + question.id + " already voted by " + user.id);
                }
            },
            error: function(error) {
                console.error("Error " + error.code + " : " + error.message + " handleFollowCreatingNewPoll_findFollowings");
            }
        });

    });
}

//////////////////////////////////////////////
// push for somebody followed created a new poll
/////////////////////////////////////////////


// need to chain it.
function handleFollowNewAnswer(page, pageSize, skip, remainingLimit) {

    console.log("handleFollowNewAnswer entered " + page + " pageSize " + pageSize + " skip " + skip + " remainingLimit " + remainingLimit + " querySkip = " + skip + page * pageSize);

    if(remainingLimit <= 0) {
        console.log("handleFollowNewAnswer we handled all the limit");
        console.log("end 1 followingNewAnswerPushNotification");

        return;
    }

    var target_pageSize = remainingLimit < pageSize ? remainingLimit : pageSize;

    var query = new Parse.Query(Parse.User);
    query.descending('createdAt');
    query.skip(skip + page * pageSize);
    query.limit(target_pageSize);

    query.find().then(function(results) {
        var numberOfUsersToHandle = results.length;
        console.log("number of users to Handle = " + numberOfUsersToHandle);

        for (var i = 0; i < results.length; i++) {
            var user = results[i];
            // let's find out all the users that this user is following.

              handleFollowNewAnswer_findFollowings(user, i+skip);
//            delayingHandleFollowNewAnswer_findFollowings(user, i+skip, 100 * i);


//            delay(100).then(function() {
//                handleFollowNewAnswer_findFollowings(user, i+skip);
//            });
        }

        if(numberOfUsersToHandle < target_pageSize) {
            console.log("handleFollowNewAnswer no more data need to handle");
            console.log("end 2 followingNewAnswerPushNotification end on time " + Date.now());
        } else {
            console.log("handleFollowNewAnswer fetching next page");
            handleFollowCreatingNewPoll(page + 1, pageSize, skip, remainingLimit - numberOfUsersToHandle);
        }
    });
}

// test function trying to delay
function delayingHandleFollowNewAnswer_findFollowings(user, skip, delay) {

    var delayUntil;
    var delayPromise;

    var _delay = function () {
       if (Date.now() >= delayUntil) {
          delayPromise.resolve();
          return;
       } else {
          process.nextTick(_delay);
       }
     }

    var delay = function(delayTime) {
      delayUntil = Date.now() + delayTime;
      delayPromise = new Parse.Promise();
      _delay();
      return delayPromise;
      };

    var delayFoo = function(){foo()};

    delay(1000).then( function(user, skip) {
        console.log("current time " + Date.now());
    });

}


function handleFollowNewAnswer_findFollowings(user, index) {

//    console.log("[" + index + "] " + Date.now() + " handleFollowNewAnswer_findFollowings handling user [" + index + "]" + user.get("username") );


    //Let's define a query to find users that this user follows
    var Follow = Parse.Object.extend('Follow');

    var followingQuery = new Parse.Query(Follow);
        followingQuery.descending("createdAt");
        followingQuery.equalTo("follower", user);
        followingQuery.notEqualTo("followee", user);
        followingQuery.limit(1000);

    var answerQuery = new Parse.Query(Answer);
        answerQuery.descending("createdAt");
        answerQuery.include("createdBy");
        answerQuery.limit(1);
        answerQuery.include("question");
        answerQuery.matchesKeyInQuery("createdBy", "followee", followingQuery);

    answerQuery.find().then(function(results) {
        var numberOfAnswersToHandle = results.length;

        if(numberOfAnswersToHandle == 0) {
            return;
        }

        var answer = results[0];

        if(answer == null || answer.get("question") == null) {
            console.error("can not find createdBy handleFollowNewAnswer_findFollowings");
        }

        var question = answer.get("question");

        // whether the question is answered already by the user.
        var userAnswerQuery = new Parse.Query(Answer);
        userAnswerQuery.equalTo('question', question);
        userAnswerQuery.equalTo('createdBy', user);

        userAnswerQuery.first({
            success: function(ans) {
                if (ans == null) {
                    // let's find out Follow data.
                    var followQuery = new Parse.Query(Follow);
                        followQuery.equalTo("follower", user);
                        followQuery.include("followee");
                        followQuery.equalTo("followee", answer.get("createdBy"));

                        followQuery.first({
                            success: function(object) {
                                if (object == null) {
                                    console.error("handleFollowNewAnswer_findFollowings should find matched Follow");
                                } else {
                                    // yes found the follow object.
                                    var previousPushedAnswer = object.get("previousPushedAnswer");
                                    if(previousPushedAnswer != null && previousPushedAnswer.id == answer.id ) {
                                        console.log("already sent push about this answer " + previousPushedAnswer.id);
                                        return;
                                    }

                                    object.set("previousPushedAnswer", answer);

                                    // now this is new creation from one of followings.
                                    object.save(null, {
                                        success: function(follow) {
                                            console.log("yeah new answer is updated " + answer.id + " previousPushedAnswer= " + answer.id);
                                            // now send push message.
                                            var followee = follow.get("followee");
                                            if(followee != null && followee.get("username") != null) {
                                                var uristr = cons.getHostName() + "posts/" + question.id;
                                                var answerString = getAnswerString(question, answer);
                                                var message = followee.get("username") + " voted " + answerString + "! Do you agree?";
                                                sendActivityPushToUser(user, message, uristr, PUSH_FOLLOWING_VOTED);
                                                console.log("end 3 followingNewAnswerPushNotification index " + index + " end on time " + Date.now());
                                            } else {
                                                console.error("handleFollowNewAnswer_findFollowings can not get followee username");
                                            }
                                        },
                                        error: function(activity, error) {
                                            console.log("Failed to create new object, with error code: " + error.message);
                                        }
                                    });
                                }
                            },
                            error: function(error) {
                                console.error("handleFollowNewAnswer_findFollowings should find matched Follow");
                            }
                        });
                        // end of let's find out Follow data.

                } else {
                    console.log("handleFollowNewAnswer_findFollowings question " + question.id + " already voted by " + user.id);
                }
            },
            error: function(error) {
                console.error("Error " + error.code + " : " + error.message + " handleFollowNewAnswer_findFollowings");
            }
        });

    });
}

function getAnswerString(question, answer) {

    if(question == null || answer == null ) {
        return "";
    }

    var questionChoice = question.get("choice");
    var answerChoice = answer.get("answer");

    if (questionChoice == 1) {
        switch (answerChoice) {
        case 0:
            return "Yes";
        case 1:
            return "No";
        }
    }
    if (questionChoice == 2) {
        switch (answerChoice) {
        case 0:
            return "Left";
        case 1:
            return "Right";
        }
    }
    if (questionChoice == 3) {
        switch (answerChoice) {
        case 0:
            return "Left";
        case 1:
            return "Middle";
        case 2:
            return "Right";
        }
    }

    return "";
}


Parse.Cloud.define("deleteQuestion", function(request, response) {

    // check whether
    var user = request.user;
    var questionId = request.params.question_id;

    console.log("deleteQuestion questionId " + questionId + " user " + user.id);
    if(user == null) {
        response.error("delete question : can not detect requesting user");
        return;
    }

    if(questionId == null) {
        response.error("delete question : question id is not specified");
        return;
    }

    Parse.Cloud.useMasterKey();
    var activityCounter = 0;
    var answerCounter = 0;
    var activities = [];
    var answers = [];

    var theQuestion;

    // let's check whether user requesting deletion is the creator of the question.
    var questionQuery = new Parse.Query(Question);
    questionQuery.descending("createdAt");
    questionQuery.equalTo("objectId", questionId);
    questionQuery.include("createdBy");
    questionQuery.limit(1)
    questionQuery.find().then(function(results) {
        if(results.length < 1) {
            response.error("delete question : can not find question with id " + questionId);
            return;
        }

        var question = results[0];
        theQuestion = question;

        if(!(user.id === question.get("createdBy").id)) {
            var errorMsg = "delete question : requesting user " + user.id + " is not owner of question with id " + questionId;
            return Parse.Promise.error({ "message": errorMsg, "code": 101 });
        }

        return Parse.Promise.as(question);

    }).then( function(question) {
            // lets try to delete all the user activities related to the question.
            console.log("passed question " + question.id);

            var activityQuery = new Parse.Query(Activity);
            activityQuery.equalTo("question", question);
            return activityQuery.each( function(activity) {
                activityCounter += 1;
                console.log("activity " + activity.id + " message " + activity.get("message"));
                activities.push(activity);
            });
    }).then (function() {
            console.log("collecting all the related activities related to question " + theQuestion.id + " are done " + activityCounter );
            // this code should be the actual one to delete the all the activities.
            var size = activities.length;
            if(size == 0) {
               return Parse.Promise.as(null);
            }

            var PAGE_SIZE = 50;

            var serialPromise = Parse.Promise.as();

            var i, j;
            for (i=0,j=size; i<j; i+=PAGE_SIZE) {
                var subList = activities.slice(i,i+PAGE_SIZE);
                console.log(subList);

                serialPromise = serialPromise.then(function () {

                    return Parse.Object.destroyAll(subList).then(function() {
                              console.log("deleting all the related the activites are done " + theQuestion.id + " sublist " + i);
                              return Parse.Promise.as(null);
                          }, function(error) {
                              console.log("deleting all the related the activites not successful " + activityCounter + " the question " + theQuestion.id + " chunk count = " + i + " error " + error.message);
                              if (error.code === Parse.Error.AGGREGATE_ERROR) {
                                  for (var i = 0; i < error.errors.length; i++) {
                                      console.log("Couldn't delete " + error.errors[i].object.id +
                                          "due to " + error.errors[i].message);
                                  }
                                  return Parse.Promise.as(null);
                              } else {
                                  console.log("Delete activities aborted " + i + " because of " + error.message );
                                  return Parse.Promise.error(error);
                              }
                    });
                });
            }

            return serialPromise;

        }, function(error) {
            console.log("collecting all the related activities not successful " + activityCounter + " error " + error.message);
            return Parse.Promise.error(error);
    }).then (function() {

            // now time to delete answers.
            console.log("querying the answers related to the question " + theQuestion.id);
            var answerQuery = new Parse.Query(Answer);
            answerQuery.equalTo("question", theQuestion);
            return answerQuery.each( function(answer) {
                answerCounter += 1;
                console.log("answer " + answer.id + " answer " + answer.get("answer"));
                answers.push(answer);
            });
    }).then (function() {
            console.log("collecting all the related answers for question " + theQuestion.id + " are done " + answerCounter );
            // this code should be the actual one to delete the all the activities.
            var size = answers.length;
            if(size == 0) {
               return Parse.Promise.as(null);
            }

            var PAGE_SIZE = 50;

            var serialPromise = Parse.Promise.as();

            var i, j;
            for (i=0,j=size; i<j; i+=PAGE_SIZE) {
                var subList = answers.slice(i,i+PAGE_SIZE);
                console.log(subList);

                serialPromise = serialPromise.then(function () {
                    return Parse.Object.destroyAll(subList).then(function() {
                              console.log("deleting all the related the answers are done " + theQuestion.id + " sublist " + i);
                              return Parse.Promise.as(null);
                          }, function(error) {
                              console.log("deleting all the related the answers not successful " + answerCounter + " the question " + theQuestion.id + " chunk count = " + i + " error " + error.message);
                              if (error.code === Parse.Error.AGGREGATE_ERROR) {
                                  for (var i = 0; i < error.errors.length; i++) {
                                      console.log("Couldn't delete " + error.errors[i].object.id +
                                          "due to " + error.errors[i].message);
                                  }
                                  return Parse.Promise.as(null);
                              } else {
                                  console.log("Delete asnwers aborted " + i + " because of " + error.message );
                                  return Parse.Promise.error(error);
                              }
                    });
                });
            }
        }, function(error) {
            console.log("collecting all the related answers for question " + theQuestion.id + " not successful " + answerCounter + " error " + error.message);
            return Parse.Promise.error(error);
    }).then (function () {
            // now time to delete the question itself.
            console.log("deleting the question " + theQuestion.id);
            return theQuestion.destroy();
    }).then(function(result) {
            console.log("the Question is deleted successfully " + theQuestion.id);
            response.success("the Question is deleted successfully " + theQuestion.id);
        }, function(error) {
            console.log("failed in deleting the question " + theQuestion.id + " error " + error.message);
            response.error("failed in deleting the question " + theQuestion.id + " error " + error.message);
    });
});

require('../cloud/follow.js');
require('../cloud/inspiration.js');
require('../cloud/email.js');
require('../cloud/badges.js');



