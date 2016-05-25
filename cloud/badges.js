var _ = require('underscore');
var cons = require('../cloud/cons.js');

var Question = Parse.Object.extend('Question');
var UserBadge = Parse.Object.extend('UserBadge');
var Badge = Parse.Object.extend('Badge')

var ParseQuery = require('../cloud/utils/parsequery.js');
var UserActivityUtil = require('../cloud/useractivityutil.js');

var BADGE_TYPE_CREATED_FIRST_POLL = 1;
var BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW = 2;
var BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW = 3;
var BADGE_TYPE_GOT_500_VOTES = 4;
var BADGE_TYPE_GOT_1000_VOTES = 5;
var BADGE_TYPE_50_VOTES_ON_A_POLL = 6;
var BADGE_TYPE_50_VOTES_ON_10_POLLS = 7;

var NUMBER_OF_VOTES_FOR_POLLS = 50;

var POINTER_BADGE_TYPE_CREATED_FIRST_POLL = "5eTD33R4os";
var POINTER_BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW = "Te9FQ1jRZF";
var POINTER_BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW = "BWuuHRIZM1";
var POINTER_BADGE_TYPE_GOT_500_VOTES = "ieU8PspGSv";
var POINTER_BADGE_TYPE_GOT_1000_VOTES = "dSZt3CHRwT";
var POINTER_BADGE_TYPE_50_VOTES_ON_A_POLL = "8HEtBqfpqy";
var POINTER_BADGE_TYPE_50_VOTES_ON_10_POLLS = "baK2WTS9zL";

var BADGE_STATE_DISABLED = 0;  // not sure this state is needed.
var BADGE_STATE_PROGRESSING = 1;
var BADGE_STATE_COMPLETED = 2;

var SETUP_BADGE_ERROR_CODE_NON_EXISTING_USER = 701;
var SETUP_BADGE_ERROR_CODE_CAN_NOT_FIND_BADGE_TYPE = 702;
var SETUP_BADGE_ERROR_CODE_CAN_NOT_GET_STATS = 703;
var SETUP_BADGE_ERROR_CODE_CAN_NOT_FIND_BADGE_RECORD = 704;
var SETUP_BADGE_ERROR_CODE_CAN_NOT_FIND_QUESTION = 705;

var TOTAL_VOTES_PER_QUESTION = 50;
var ONE_DAY_MILLISECONDS = 1000 * 60 * 60 * 24;

// not usre we need to redefine these here or can define inside pushutil or useractivityutil
var TYPE_ACTIVITY_CREATE = 1;
var TYPE_ACTIVITY_SOMEBODY_VOTE = 2;
var TYPE_ACTIVITY_YOU_HAVE_THIS_MANY_VOTES = 3;
var TYPE_ACTIVITY_SOMEBODY_FOLLOW = 4;

var PUSH_FOLLOWING_CREATED = "push_following_created_poll";
var PUSH_FOLLOWING_VOTED = "push_following_voted";
var PUSH_START_FOLLOWING = "push_start_following";
var PUSH_FIRST_ANSWER_TRIGGER = "push_first_answer_trigger";
var PUSH_EVERY_FIVE_ANSWER_TRIGGER = "push_every_five_answer_trigger";
var PUSH_MORE_ANSWER_TRIGGER_CREATE = "push_more_answer_trigger_create";
var PUSH_RESULTS_PER_3HRS = "push_results_per_3hrs";

var PUSH_BADGE_UNLOCK_BADGE_TYPE_CREATED_FIRST_POLL = "PUSH_BADGE_UNLOCK_BADGE_TYPE_CREATED_FIRST_POLL";
var PUSH_BADGE_UNLOCK_BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW = "PUSH_BADGE_UNLOCK_BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW";
var PUSH_BADGE_UNLOCK_BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW = "PUSH_BADGE_UNLOCK_BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW";
var PUSH_BADGE_UNLOCK_BADGE_TYPE_GOT_500_VOTES = "PUSH_BADGE_UNLOCK_BADGE_TYPE_GOT_500_VOTES";
var PUSH_BADGE_UNLOCK_BADGE_TYPE_GOT_1000_VOTES = "PUSH_BADGE_UNLOCK_BADGE_TYPE_GOT_1000_VOTES";
var PUSH_BADGE_UNLOCK_BADGE_TYPE_50_VOTES_ON_A_POLL = "PUSH_BADGE_UNLOCK_BADGE_TYPE_50_VOTES_ON_A_POLL";
var PUSH_BADGE_UNLOCK_BADGE_TYPE_50_VOTES_ON_10_POLLS = "PUSH_BADGE_UNLOCK_BADGE_TYPE_50_VOTES_ON_10_POLLS";
var PUSH_BADGE_PROMOTION_MORE_VOTE_TO_GO = "PUSH_BADGE_PROMOTION_MORE_VOTE_TO_GO";
var PUSH_BADGE_PROMOTION_MORE_POLLS_TO_GET_50 = "PUSH_BADGE_PROMOTION_MORE_POLLS_TO_GET_50";
var PUSH_BADGE_PROMOTION_DONT_LOSE_CREATION_STREAK = "PUSH_BADGE_PROMOTION_DONT_LOSE_CREATION_STREAK";

var TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_CREATED_FIRST_POLL = 5;
var TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW = 6;
var TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW = 7;
var TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_GOT_500_VOTES = 8;
var TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_GOT_1000_VOTES = 9;
var TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_50_VOTES_ON_A_POLL = 10;
var TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_50_VOTES_ON_10_POLLS = 11;
var TYPE_ACTIVITY_BADGE_PROMOTION_MORE_VOTE_TO_GO = 12;
var TYPE_ACTIVITY_BADGE_PROMOTION_MORE_POLLS_TO_GET_50 = 13;
var TYPE_ACTIVITY_BADGE_PROMOTION_DONT_LOSE_CREATION_STREAK = 14;

Parse.Cloud.define("handlePromotionCreationStreakBadges", function(request, response) {

    Parse.Cloud.useMasterKey();

    // check whether
    var requestingUser = request.user;
    var userId = null;
    var localCreatedDateStr = request.params.localCreatedDateStr;

    console.log("handlePromotionCreationStreakBadges userId " + userId + " requesting User " + requestingUser + " localCreatedDateStr=" + localCreatedDateStr);

    if(requestingUser == null) {
        response.error("handlePromotionCreationStreakBadges : can not detect requesting user");
        return;
    } else if (localCreatedDateStr == null) {
        response.error("handlePromotionCreationStreakBadges : can not find local created date");
        return;
    } else {
        userId = requestingUser.id;

        requestingUser.fetch().then(function (user) {
            console.log("handlePromotionCreationStreakBadges fetch user successfully " + user.id);

            return Parse.Promise.as(user);

        }).then(function(user) {

            console.log("handlePromotionCreationStreakBadges yes successfully fetched user " + user.id);

            return handlePromotionCreationStreakBadges(user, localCreatedDateStr);

        }).then(function(result) {   // handling response to this cloud function.
            console.log("handleCreationStreakBadges successfully " + userId);
            response.success("handleCreationStreakBadges successfully " + userId);
           }, function(error) {
            console.log("falied in handleCreationStreakBadges " + userId + " error : " + error.message);
            response.error("falied in handleCreationStreakBadges " + userId + " error : " + error.message);
        });

        return;

    }

});


function handlePromotionCreationStreakBadges(user, localCreatedDateStr) {

    console.log("handlePromotionCreationStreakBadges user=" + user.id + " localCreatedDateStr=" + localCreatedDateStr);

    if(user.get("badgesCreatedAt") == null) {
        console.log("handlePromotionCreationStreakBadges badge is not initialized for the user " + user.id);
        return Parse.Promise.as(null);
    }

    var badgeTypes = [BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW, BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW];

    // it can optimize the performance later but now we just check related badge.
    var amount = 1; // one question.
    var userBadgeQuery = new Parse.Query(UserBadge);
    userBadgeQuery.ascending('type');
    userBadgeQuery.containedIn("type", badgeTypes);
    userBadgeQuery.equalTo('user', user);
    userBadgeQuery.limit(2);
    userBadgeQuery.include("badge");

    console.log("1 handlePromotionCreationStreakBadges")
    return userBadgeQuery.find().then(function(results) {

    console.log("2 handlePromotionCreationStreakBadges")

        var questionCreatedAt = Date.parse(localCreatedDateStr);
        var isDone = false;

        results.forEach(function(userBadge) {

    console.log("31 handlePromotionCreationStreakBadges" + userBadge.id);

            var userBadge;
            var prevouslyCreatedAt;
            var previousLocalCreatedDateStr;
            var diffInMilliSeconds;

            if(isDone == false && userBadge != null && userBadge.get("state") == BADGE_STATE_PROGRESSING && userBadge.get("progress") > 0 ) {
                // lets just check whether prevoius date is more than one day.
                prevouslyCreatedAt = 0;

    console.log("42 handlePromotionCreationStreakBadges" + userBadge.id + " isDone=" + isDone);


                previousLocalCreatedDateStr = userBadge.get("localCreatedDateStr");
                if(previousLocalCreatedDateStr != null) {

                    prevouslyCreatedAt = Date.parse(previousLocalCreatedDateStr);
                }

                diffInMilliSeconds = questionCreatedAt - prevouslyCreatedAt;


    console.log("5 handlePromotionCreationStreakBadges" + userBadge.id + " previousLocalCreatedDateStr " + previousLocalCreatedDateStr + " localCreatedDateStr " + localCreatedDateStr);

                if(diffInMilliSeconds > 0 && diffInMilliSeconds <= ONE_DAY_MILLISECONDS) {
    console.log("6 handlePromotionCreationStreakBadges" + userBadge.id + "diff=" + diffInMilliSeconds);
                    isDone = true;
                    // something is not right. Guess it is because time zone changes in the client.
                    // lets start over
                    return handleNotificationForPromoteCreationStreakForUserBadge(userBadge);
                }
            }

    console.log("7 handlePromotionCreationStreakBadges" + userBadge.id);

        });


    console.log("8 handlePromotionCreationStreakBadges");

        return Parse.Promise.as(null);

    }, function(error) {

        console.log("error in handling handlePromotionCreationStreakBadges " + error.message);
        return Parse.Promise.error(error);

    });
}


function handleNotificationForPromoteCreationStreakForUserBadge(userBadge) {

    console.log("handleNotificationForPromoteCreationStreakForUserBadge " + userBadge.id + " userBadge progress " + userBadge.get("progress")  );

    var progress = userBadge.get("progress");
    var maxValue = userBadge.get("badge").get("maxValue");

    var badge = userBadge.get("badge");

    var activityType = TYPE_ACTIVITY_BADGE_PROMOTION_DONT_LOSE_CREATION_STREAK;
    var targetUser = userBadge.get("user");
    var message = "Don't loose your streak: " + progress + "/" + maxValue +"!";
    var activityMessage = message;
    var subMessage = "Create once a day to unlock badges";
    var uri = cons.getHostName() + "create";

    // this field may not be meaningful for this type of user activity
    var actionUser = targetUser;
    var question = null;
    var sendingPushNotifcation = true;
    var destination = uri;
    var type = PUSH_BADGE_PROMOTION_DONT_LOSE_CREATION_STREAK;

    console.log("handleNotificationForPromoteCreationStreakForUserBadge " + userBadge.id + " activityType=" + activityType
        + " targetUser=" + targetUser.id + " uri="
        + uri + " sendingPushNotifcation=" + sendingPushNotifcation + " message" + message
        + " subMessage=" + subMessage);

    return UserActivityUtil.createNewActivityObjectAndSendPushNotification(activityType, targetUser
        , message, activityMessage, uri, actionUser, question
        , sendingPushNotifcation, subMessage, destination, type, userBadge, true).then(function () {
            console.log("handleNotificationForPromoteCreationStreakForUserBadge notification and push successful");
            return Parse.Promise.as(userBadge);
        }, function(error) {
            console.log("handleNotificationForPromoteCreationStreakForUserBadge " + error.message);
            return Parse.Promise.error(error);
        });
}

Parse.Cloud.define("handleCreationStreakBadges", function(request, response) {

    Parse.Cloud.useMasterKey();

    // check whether
    var requestingUser = request.user;
    var userId = null;
    var questionId = request.params.questionId;
    var localCreatedDateStr = request.params.localCreatedDateStr;

    console.log("handleCreationStreakBadges userId " + userId + " requesting User " + requestingUser + " localCreatedDateStr=" + localCreatedDateStr);

    if(requestingUser == null) {
        response.error("handleCreationStreakBadges : can not detect requesting user");
        return;
    } else if (localCreatedDateStr == null) {
        response.error("handleCreationStreakBadges : can not find local created date");
        return;
    } else if (questionId == null) {
        response.error("handleCreationStreakBadges : can not find question id");
        return;
    } else {
        userId = requestingUser.id;

        requestingUser.fetch().then(function (user) {
            console.log("handleCreationStreakBadges fetch user successfully " + user.id);


            var questionQuery = new Parse.Query(Question);
            var questionPromise = questionQuery.get(questionId, {
                              success: function(question) {
                                console.log("yes found  question " + question.id);
                                return Parse.Promise.as(question);
                              },
                              error: function(question, error) {
                                var errorMsg = "cound not find question " + questionId + "error : " + error.message;
                                console.log(errorMsg);
                                return Parse.Promise.error({ "message": errorMsg, "code": SETUP_BADGE_ERROR_CODE_CAN_NOT_FIND_QUESTION });
                              }});


            return Parse.Promise.when( user, questionPromise);

        }).then(function(user, question) {

            console.log("yes successfully fetched user " + user.id + " and question " + question.id);

            return handleCreationStreakBadgesForUser(user, question, localCreatedDateStr);

        }).then(function(result) {   // handling response to this cloud function.
            console.log("handleCreationStreakBadges successfully " + userId);
            response.success("handleCreationStreakBadges successfully " + userId);
           }, function(error) {
            console.log("falied in handleCreationStreakBadges " + userId + " error : " + error.message);
            response.error("falied in handleCreationStreakBadges " + userId + " error : " + error.message);
        });

        return;

    }

});

function handleCreationStreakBadgesForUser(user, question, localCreatedDateStr) {



    console.log("handleCreationStreakBadgesForUser user=" + user.id + " question=" + question.id + " localCreatedDateStr=" + localCreatedDateStr);

    if(user.get("badgesCreatedAt") == null) {
        console.log("handleCreationStreakBadgesForUser badge is not initialized for the user " + user.id);
        return Parse.Promise.as(null);
    }

    var badgeTypes = [BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW, BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW];

    // it can optimize the performance later but now we just check related badge.
    var amount = 1; // one question.
    var userBadgeQuery = new Parse.Query(UserBadge);
    userBadgeQuery.ascending('type');
    userBadgeQuery.containedIn("type", badgeTypes);
    userBadgeQuery.equalTo('user', user);
    userBadgeQuery.limit(2);
    userBadgeQuery.include("badge");
    return userBadgeQuery.find().then(function(results) {

        var map = new Object();
        results.forEach(function(userBadge) {
            map[userBadge.get("type")] = userBadge;
        });

        var promises = [];
        // handle BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW,
        promises.push(handleCreationStreakWithLocalDate(map, user, question, amount, BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW, localCreatedDateStr));
        // handle BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW
        promises.push(handleCreationStreakWithLocalDate(map, user, question, amount, BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW, localCreatedDateStr));

        return Parse.Promise.when(promises);

    }, function(error) {

        console.log("error in handling handleCreationStreakBadgesForUser " + error.message);
        return Parse.Promise.error(error);

    });
}

function handleCreationStreakWithLocalDate(map, user, question, amount, badgeType, localCreatedDateStr) {

    console.log("handleCreationStreakWithLocalDate user " + user.id + " question " + question.id + " amount=" + amount + " badge type=" + badgeType + " localCreatedDateStr=" + localCreatedDateStr);

    var userBadge = map[badgeType];

    if(userBadge == null) {
        console.log("could not find badge record " + badgeType);
        return Parse.Promise.as(null);
    }

    var state = userBadge.get("state");
    var isPreviousBadgeStateProgressing = state == BADGE_STATE_PROGRESSING;

    if(state == BADGE_STATE_COMPLETED) {
        console.log("badge " + badgeType + " is already completed");
        return Parse.Promise.as(null);
    }

    var maxValue = userBadge.get("badge").get("maxValue");
    var progress = userBadge.get("progress");
    var relatedQuestions = userBadge.get("relatedQuestions");

    console.log("localCreatedDateStr=" +  localCreatedDateStr + " parsed=" + Date.parse(localCreatedDateStr));

    var questionCreatedAt = Date.parse(localCreatedDateStr);
    var prevouslyCreatedAt = 0;

    var previousLocalCreatedDateStr = userBadge.get("localCreatedDateStr");
    if(previousLocalCreatedDateStr != null) {

        prevouslyCreatedAt = Date.parse(previousLocalCreatedDateStr);
    }

    var diffInMilliSeconds = questionCreatedAt - prevouslyCreatedAt;

    if(diffInMilliSeconds < 0 || progress == 0 || diffInMilliSeconds > ONE_DAY_MILLISECONDS) {
        // something is not right. Guess it is because time zone changes in the client.
        // lets start over
        progress = 1;
        relatedQuestions = [question];
    } else if (diffInMilliSeconds ==  ONE_DAY_MILLISECONDS) {
        progress += 1;
        relatedQuestions.push(question);
        console.log("handleCreationStreakWithLocalDate handling badge type " + badgeType +  " found successive creation : user " + user.id + " question " + question.id + " progress " + progress + " pre=" + previousLocalCreatedDateStr + " qcreated=" + localCreatedDateStr);
    } else {
        // other case like same day....
        // progress is same.
        if(relatedQuestions.length > 0) {
            relatedQuestions.pop();
        }
        relatedQuestions.push(question);
    }

    // lets check it meets the requirement
    if(progress >= maxValue && state != BADGE_STATE_DISABLED) {
        console.log("handleCreationStreakWithLocalDate handling badge type " + badgeType + " completed user " + user.id + " question " + question.id + " progress " + progress + " pre=" + previousLocalCreatedDateStr + " qcreated=" + localCreatedDateStr);
        userBadge.set("state", BADGE_STATE_COMPLETED);
    }

    // update userBadge progress
    userBadge.set("progress", progress);
    userBadge.set("progressUpdatedAt", question.get("createdAt"));
    userBadge.set("localCreatedDateStr", localCreatedDateStr);
    userBadge.set("relatedQuestions", relatedQuestions);

    return userBadge.save().then( function (userBadge) {
        // now to handle notification.

        console.log("handleCreationStreakWithLocalDate handling badge type " + badgeType + " successfuly saved userBadge user " + user.id + " question " + question.id);

        // first unlock notification.
        if(isPreviousBadgeStateProgressing && userBadge.get("state") == BADGE_STATE_COMPLETED) {
            console.log("handleCreationStreakWithLocalDate handling badge type " + badgeType + " newly completed so will send notification user " + user.id + " question " + question.id);
            return handleNotificationForUnlockedUserBadge(userBadge);
        }

        return Parse.Promise.as(null);

    });

}



// This method can be called set up bages for user with userId as given as a parameter user_id
Parse.Cloud.define("setupBadgesForUser", function(request, response) {

    // check whether
    var requestingUser = request.user;
    var userId = null;

    console.log("setupBadgesForUser userId " + userId + " requesting User " + requestingUser);
    if(requestingUser == null) {
        // TODO need to turn on
        // response.error("setupBadgesForUser : can not detect requesting user");
        // return;
    } else {
        userId = requestingUser.id;



        requestingUser.fetch().then(function (user) {
            console.log("set up Badges fetch user successfully " + userId);

            return initializeUserBadgeForUser(user);
        }).then(function(result) {   // handling response to this cloud function.
            console.log("set up Badges successfully " + userId);
            response.success("set up Badges successfully " + userId);
           }, function(error) {
            console.log("falied in setting up Badges " + userId + " error : " + error.message);
                      response.error("falied in setting up Badges " + userId + " error : " + error.message);
        });

        return;

    }

    // this part is for manual test.

    if(request.params.user_id != null) {
        userId = request.params.user_id;
    }

    if(userId == null) {
        response.error("setupBadgesForUser : user id is not specified");
        return;
    }

    var query = new Parse.Query(Parse.User);
    return query.get(userId, {
      success: function(user) {
        console.log("yes found  user " + user.id);
        return Parse.Promise.as(user);
      },
      error: function(user, error) {
        var errorMsg = "cound not find user " + userId + "error : " + error.message;
        console.log(errorMsg);
        return Parse.Promise.error({ "message": errorMsg, "code": SETUP_BADGE_ERROR_CODE_NON_EXISTING_USER });
      }
    }).then(function (user) {

        return initializeUserBadgeForUser(user);

    }).then(function(result) {   // handling response to this cloud function.
              console.log("set up Badges successfully " + userId);
              response.success("set up Badges successfully " + userId);
          }, function(error) {
              console.log("falied in setting up Badges " + userId + " error : " + error.message);
              response.error("falied in setting up Badges " + userId + " error : " + error.message);
    });
});

function initializeUserBadgeForUser(user) {

    Parse.Cloud.useMasterKey();

    if(user == null) {
        return Parse.Promise.error({ "message": "user does not exist for initializing badges", "code": SETUP_BADGE_ERROR_CODE_NON_EXISTING_USER });
    }

    if(user.get("badgesCreatedAt") == null) {
        console.log("badges are not created yet for the user " + user.id);
    } else {
        console.log("badges were already created at " + user.get("badgesCreatedAt") + " for user " + user.id);
        return Parse.Promise.as(null);
    }

    var promises = [];

    // handle BADGE_TYPE_CREATED_FIRST_POLL.
    promises.push(updateBadge(BADGE_TYPE_CREATED_FIRST_POLL, BADGE_STATE_PROGRESSING, 0, user, null));

    //handle BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW,
    promises.push(updateBadge(BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW, BADGE_STATE_PROGRESSING, 0, user, []));

    //handle BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW,
    promises.push(updateBadge(BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW, BADGE_STATE_PROGRESSING, 0, user, []));

    //handle BADGE_TYPE_GOT_500_VOTES,
    promises.push(updateBadge(BADGE_TYPE_GOT_500_VOTES, BADGE_STATE_PROGRESSING, 0, user, null));

    //handle BADGE_TYPE_GOT_1000_VOTES,
    promises.push(updateBadge(BADGE_TYPE_GOT_1000_VOTES, BADGE_STATE_PROGRESSING, 0, user, null));

    //handle BADGE_TYPE_50_VOTES_ON_A_POLL,
    promises.push(updateBadge(BADGE_TYPE_50_VOTES_ON_A_POLL, BADGE_STATE_PROGRESSING, 0, user, []));

    //handle BADGE_TYPE_50_VOTES_ON_A_POLL,
    promises.push(updateBadge(BADGE_TYPE_50_VOTES_ON_10_POLLS, BADGE_STATE_PROGRESSING, 0, user, []));

    return Parse.Promise.when(promises).then(function() {

        // lets update badgesCreatedAt date in the user.
        user.set("badgesCreatedAt", new Date());
        return user.save();

    });

}

// create if not exists already
function updateBadge (badgeType, state, progress, user, relatedQuestions) {

    console.log("create a badge badgeType:" + badgeType + " state:" + state + " progress:" + progress + " user:" + user.id  + " relatedQuestions:" + relatedQuestions );

    if(user == null) {
        return Parse.Promise.error({ "message": "user is empty while creating badge", "code": SETUP_BADGE_ERROR_CODE_NON_EXISTING_USER });
    }

//    console.log("create a badge badgeType: 1");

    // let's find Badge object corresponding badge type
    // we can hard code this for better performance.
    var query = new Parse.Query(Badge);
    query.equalTo("type", badgeType);

    var isPreviousStateLocked = true;

    return query.first().then(function (badge) {

//        console.log("create a badge badgeType: 2");
        if (badge == null) {
            return Parse.Promise.error({ "message": "Can not find badge type", "code": SETUP_BADGE_ERROR_CODE_CAN_NOT_FIND_BADGE_TYPE });
        } else {
            return Parse.Promise.as(badge);
        }
    }).then(function(badge) {
        console.log("create a badge badgeType: 3");

        //first check whether this user has already corresponding UserBadge object.
        var userBadgeQuery = new Parse.Query(UserBadge);
        userBadgeQuery.descending('createdAt');
        userBadgeQuery.equalTo("type", badgeType);
        userBadgeQuery.equalTo('user', user);
        userBadgeQuery.include("badge");
        return Parse.Promise.when(userBadgeQuery.first(), badge);

    }).then (function(userBadge, badge) {

//        console.log("create a badge badgeType: 4");

        if(userBadge == null) {
//        console.log("create a badge badgeType: 4.5");

            // there is no userBadge so we need to create one.
            userBadge = new UserBadge();
            userBadge.set("type", badgeType);
            userBadge.set("user", user);

            var newACL = new Parse.ACL();
            newACL.setPublicReadAccess(true);
            newACL.setWriteAccess(user.id, true);
            userBadge.setACL(newACL);

            isPreviousStateLocked = true;
        } else {

            isPreviousStateLocked = userBadge.get("state") != BADGE_STATE_COMPLETED;

        }
        console.log("create a badge badgeType: 5 previous state locked" + isPreviousStateLocked);

        userBadge.set("badge", badge);
        userBadge.set("state", state);
        userBadge.set("progress", progress);
        if(relatedQuestions == null) {
            userBadge.unset("relatedQuestions");
        } else {
            userBadge.set("relatedQuestions", relatedQuestions);
        }

        // set progressUpdatedAt time.
        var progressUpdatedAt = new Date();
        console.log("updateBadge : progressUpdatedAt=" + progressUpdatedAt);
        userBadge.set("progressUpdatedAt", progressUpdatedAt);
        return userBadge.save();

    }).then (function(userBadge) {
        // let's handle the badge notification.
        // if needed.

//        if(isPreviousStateLocked && userBadge.get("state")==BADGE_STATE_COMPLETED) {
//            // lets create notification.
//            return handleNotificationForUnlockedUserBadge(userBadge);
//        }

        // no notifications
        console.log("no notifications")
        return Parse.Promise.as(userBadge);


    }).then (function(userBadge) {
        console.log("Yes userBadge is updated " + userBadge.id);
        return Parse.Promise.as(userBadge);
    }, function(error) {
        console.log("falied in updateBadge error : " + error.message);
        return Parse.Promise.error(error);
    });

}

function handleNotificationFor50VotesOnPollsForUserBadge(userBadge) {

    console.log("handleNotificationFor50VotesOnPollsForUserBadge " + userBadge.id + " userBadge progress " + userBadge.get("progress")  );

    var progress = userBadge.get("progress");
    var maxValue = userBadge.get("badge").get("maxValue");

    var badge = userBadge.get("badge");

    var activityType = TYPE_ACTIVITY_BADGE_PROMOTION_MORE_POLLS_TO_GET_50;
    var targetUser = userBadge.get("user");
    var message = "Your poll got " + NUMBER_OF_VOTES_FOR_POLLS + " votes!";
    var activityMessage = message;
    var subMessage = (maxValue - progress) + " more until your next badge! Create now";
    var uri = cons.getHostName() + "create";

    // this field may not be meaningful for this type of user activity
    var actionUser = targetUser;
    var question = null;
    var sendingPushNotifcation = true;
    var destination = uri;
    var type = PUSH_BADGE_PROMOTION_MORE_POLLS_TO_GET_50;

    console.log("handleNotificationFor50VotesOnPollsForUserBadge " + userBadge.id + " activityType=" + activityType
        + " targetUser=" + targetUser.id + " uri="
        + uri + " sendingPushNotifcation=" + sendingPushNotifcation + " message" + message
        + " subMessage=" + subMessage);

    return UserActivityUtil.createNewActivityObjectAndSendPushNotification(activityType, targetUser
        , message, activityMessage, uri, actionUser, question
        , sendingPushNotifcation, subMessage, destination, type, userBadge, true).then(function () {
            console.log("handleNotificationFor50VotesOnPollsForUserBadge notification and push successful");
            return Parse.Promise.as(userBadge);
        }, function(error) {
            console.log("handleNotificationFor50VotesOnPollsForUserBadge " + error.message);
            return Parse.Promise.error(error);
        });
}

function handleNotificationForPromoteVotesForUserBadge(userBadge) {

    console.log("handleNotificationForPromoteVotesForUserBadge " + userBadge.id + " userBadge progress " + userBadge.get("progress")  );

    var progress = userBadge.get("progress");
    var maxValue = userBadge.get("badge").get("maxValue");

    var badge = userBadge.get("badge");

    var activityType = TYPE_ACTIVITY_BADGE_PROMOTION_MORE_VOTE_TO_GO;
    var targetUser = userBadge.get("user");
    var message = progress + " votes! " + (maxValue - progress) + " more to go.";
    var activityMessage = message;
    var subMessage = "Create polls to unlock the next badges";
    var uri = cons.getHostName() + "create";

    // this field may not be meaningful for this type of user activity
    var actionUser = targetUser;
    var question = null;
    var sendingPushNotifcation = true;
    var destination = uri;
    var type = PUSH_BADGE_PROMOTION_MORE_VOTE_TO_GO;

    console.log("handleNotificationForPromoteVotesForUserBadge " + userBadge.id + " activityType=" + activityType
        + " targetUser=" + targetUser.id + " uri="
        + uri + " sendingPushNotifcation=" + sendingPushNotifcation + " message" + message
        + " subMessage=" + subMessage);

    return UserActivityUtil.createNewActivityObjectAndSendPushNotification(activityType, targetUser
        , message, activityMessage, uri, actionUser, question
        , sendingPushNotifcation, subMessage, destination, type, userBadge, true).then(function () {
            console.log("handleNotificationForPromoteVotesForUserBadge notification and push successful");
            return Parse.Promise.as(userBadge);
        }, function(error) {
            console.log("handleNotificationForPromoteVotesForUserBadge " + error.message);
            return Parse.Promise.error(error);
        });
}

function handleNotificationForUnlockedUserBadge(userBadge) {

    var badge = userBadge.get("badge");

    var activityType = getActivityType(userBadge.get("type"));
    var targetUser = userBadge.get("user");
    var message = "You've unlocked " + badge.get("title");
    var activityMessage = message;
    var subMessage = badge.get("subMessage");
    var uri = cons.getHostName() + "badge/" + userBadge.id + "?badgeType=" + userBadge.get("type");

    // this field may not be meaningful for this type of user activity
    var actionUser = targetUser;
    var question = null;
    var sendingPushNotifcation = true;
    var destination = uri;
    var type = getPushType(userBadge.get("type"));

    console.log("handleNotificationForUnlockedUserBadge " + userBadge.id + " activityType=" + activityType
        + " targetUser=" + targetUser.id + " uri="
        + uri + " sendingPushNotifcation=" + sendingPushNotifcation + " message" + message
        + " subMessage=" + subMessage);

    return UserActivityUtil.createNewActivityObjectAndSendPushNotification(activityType, targetUser
        , message, activityMessage, uri, actionUser, question
        , sendingPushNotifcation, subMessage, destination, type, userBadge, false).then(function () {
            console.log("handleNotificationForUnlockedUserBadge notification and push successful");
            return Parse.Promise.as(userBadge);
        }, function(error) {
            console.log("handleNotificationForUnlockedUserBadge " + error.message);
            return Parse.Promise.error(error);
        });
}


function getPushType(badgeType) {

    switch(badgeType) {
        case BADGE_TYPE_CREATED_FIRST_POLL:
            return PUSH_BADGE_UNLOCK_BADGE_TYPE_CREATED_FIRST_POLL;
        case BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW:
            return PUSH_BADGE_UNLOCK_BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW;
        case BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW:
            return PUSH_BADGE_UNLOCK_BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW;
        case BADGE_TYPE_GOT_500_VOTES:
            return PUSH_BADGE_UNLOCK_BADGE_TYPE_GOT_500_VOTES;
        case BADGE_TYPE_GOT_1000_VOTES:
            return PUSH_BADGE_UNLOCK_BADGE_TYPE_GOT_1000_VOTES;
        case BADGE_TYPE_50_VOTES_ON_A_POLL:
            return PUSH_BADGE_UNLOCK_BADGE_TYPE_50_VOTES_ON_A_POLL;
        case BADGE_TYPE_50_VOTES_ON_10_POLLS:
            return PUSH_BADGE_UNLOCK_BADGE_TYPE_50_VOTES_ON_10_POLLS;
        default :
            return "UNKOWN_PUSH_TYPE";
    }
}



function getActivityType(badgeType) {

    switch(badgeType) {
        case BADGE_TYPE_CREATED_FIRST_POLL:
            return TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_CREATED_FIRST_POLL;
        case BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW:
            return TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW;
        case BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW:
            return TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW;
        case BADGE_TYPE_GOT_500_VOTES:
            return TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_GOT_500_VOTES;
        case BADGE_TYPE_GOT_1000_VOTES:
            return TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_GOT_1000_VOTES;
        case BADGE_TYPE_50_VOTES_ON_A_POLL:
            return TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_50_VOTES_ON_A_POLL;
        case BADGE_TYPE_50_VOTES_ON_10_POLLS:
            return TYPE_ACTIVITY_BADGE_UNLOCK_BADGE_TYPE_50_VOTES_ON_10_POLLS;
        default :
            return -1;
    }
}

function handle50VotesOnPolls(map, user, answer, question, amount, badgeType, numberToSkipPromotionNotification) {

    console.log("handle50VotesOnPolls user " + user.id + " answer=" + answer.id + " question " + question.id + " amount=" + amount + " badge type=" + badgeType);

    var userBadge = map[badgeType];

    if(userBadge == null) {
        console.log("handle50VotesOnPolls could not find badge record " + badgeType);
        return Parse.Promise.as(null);
    }

    var state = userBadge.get("state");
    var isPreviousBadgeStateProgressing = state == BADGE_STATE_PROGRESSING;

    if(state == BADGE_STATE_COMPLETED) {
        console.log("handle50VotesOnPolls badge " + badgeType + " is already completed");
        return Parse.Promise.as(null);
    }

    var maxValue = userBadge.get("badge").get("maxValue");
    var progress = userBadge.get("progress");
    var answerCreatedAt = answer.get("createdAt");
    var relatedQuestions = userBadge.get("relatedQuestions");

    // lets check whether current poll is already in the previously counted question.
    relatedQuestions.forEach(function(q) {
        if(question.id == q.id ) {
            console.log("question " + question.id + " is already counted for 50 votes so we will skip");
            return Parse.Promise.as(null);
        }
    });

    var totalAnswerNumber = (question.get('oneResponses') || 0) + (question.get('twoResponses') || 0) + (question.get('threeResponses') || 0);

    if(totalAnswerNumber >= NUMBER_OF_VOTES_FOR_POLLS) {
        console.log("found a quetion with more than " + maxValue + " handling badge type " + badgeType + " completed user " + user.id + " question " + question.id + " progress " + progress + " answerCreatedAt=" + answerCreatedAt);
        relatedQuestions.push(question);
        progress += 1;

        if( progress >= maxValue && state != BADGE_STATE_DISABLED ) {
            console.log("change state to complete after found a quetion with more than " + maxValue + " handling badge type " + badgeType + " completed user " + user.id + " question " + question.id + " progress " + progress + " answerCreatedAt=" + answerCreatedAt);
            userBadge.set("state", BADGE_STATE_COMPLETED);
        }

        userBadge.set("progress", progress);
        userBadge.set("progressUpdatedAt", answerCreatedAt);
        userBadge.set("relatedQuestions", [question]);

        return userBadge.save().then( function (userBadge) {
            // now to handle notification.

            console.log("handle50VotesOnPolls handling badge type " + badgeType + "successfuly saved userBadge user " + user.id + " answer " + answer.id + " question " + question.id );
            // first unlock notification.
            if(isPreviousBadgeStateProgressing && userBadge.get("state") == BADGE_STATE_COMPLETED) {
                console.log("handling badge type " + badgeType + "newly completed so will send notification user " + user.id + " answer " + answer.id + " question " + question.id);
                return handleNotificationForUnlockedUserBadge(userBadge);
            } else  if(progress > numberToSkipPromotionNotification) {
                // consider to send promotion notification.
                console.log("handle50VotesOnPolls will send promotion notification progress " + progress );
                return handleNotificationFor50VotesOnPollsForUserBadge(userBadge);
            }
            return Parse.Promise.as(null);

        });
    }

    console.log("skip the question for handle50VotesOnPolls handling badge type " + badgeType + "successfuly saved userBadge user " + user.id + " answer " + answer.id + " question " + question.id + " totalAnswers=" + totalAnswerNumber);

    return Parse.Promise.as(null);

}

function handleGotManyTotalVotes(map, user, answer, question, amount, badgeType, numberToSkipPromotionNotification) {

    console.log("1 handleGotManyTotalVotes user " + user.id + " answer=" + answer.id + " question " + question.id + " amount=" + amount + " badge type=" + badgeType);

    var userBadge = map[badgeType];

    if(userBadge == null) {
        console.log("handleGotManyTotalVotes could not find badge record " + badgeType);
        return Parse.Promise.as(null);
    }

    var state = userBadge.get("state");
    var isPreviousBadgeStateProgressing = state == BADGE_STATE_PROGRESSING;

    if(state == BADGE_STATE_COMPLETED) {
        console.log("2 handleGotManyTotalVotes badge " + badgeType + " is already completed");
        return Parse.Promise.as(null);
    }

    var maxValue = userBadge.get("badge").get("maxValue");
    var progress = userBadge.get("progress");
    var answerCreatedAt = answer.get("createdAt");

    var adjustedProgressNumber = progress + 1;
    var sendPromotionNotification = false;

    // lets check it meets the requirement
    if(adjustedProgressNumber >= maxValue && state != BADGE_STATE_DISABLED) {
        console.log("handling badge type " + badgeType + " completed user " + user.id + " question " + question.id + " progress " + progress + " answerCreatedAt=" + answerCreatedAt);
        userBadge.set("state", BADGE_STATE_COMPLETED);
    } else {
        console.log("handleGotManyTotalVotes will send promotion notification progress " + adjustedProgressNumber + " condition " +(adjustedProgressNumber%100) + " " );

        // consider to send promotion notification.
        if(adjustedProgressNumber > numberToSkipPromotionNotification && ((adjustedProgressNumber%100) == 0) ) {
            console.log("handleGotManyTotalVotes will send promotion notification progress " + adjustedProgressNumber );
            sendPromotionNotification = true;
        }
    }

    userBadge.set("progress", progress+1);
    userBadge.set("progressUpdatedAt", answerCreatedAt);
    userBadge.set("relatedQuestions", [question]);

    return userBadge.save().then( function (userBadge) {
        // now to handle notification.

        console.log("handleGotManyTotalVotes handling badge type " + badgeType + "successfuly saved userBadge user " + user.id + " answer " + answer.id + " question " + question.id );
        // first unlock notification.
        if(isPreviousBadgeStateProgressing && userBadge.get("state") == BADGE_STATE_COMPLETED) {
            console.log("handling badge type " + badgeType + "newly completed so will send notification user " + user.id + " answer " + answer.id + " question " + question.id);
            return handleNotificationForUnlockedUserBadge(userBadge);
        } else if (sendPromotionNotification) {
            console.log("calling handleNotificationForPromoteVotesForUserBadge " + adjustedProgressNumber);
            return handleNotificationForPromoteVotesForUserBadge(userBadge);
        }
        return Parse.Promise.as(null);

    });
}


// return
// 0 means same day
// 1 means one day
// 2 means more than one day.
function daysBetweenTwoDates(previousStreakDate, creationDateForCurrentQuestion) {

    // let's make copy of them
    previousStreakDate = new Date(previousStreakDate.getTime());
    creationDateForCurrentQuestion = new Date(creationDateForCurrentQuestion.getTime());

    creationDateForCurrentQuestion.setHours(0, 0, 0, 0);
    previousStreakDate.setHours(0, 0, 0, 0);

    if ( creationDateForCurrentQuestion.getTime() -  previousStreakDate.getTime() == 0 ) {
        // it is same day
        return 0;
    } else if ( creationDateForCurrentQuestion.getTime() -  previousStreakDate.getTime() == ONE_DAY_MILLISECONDS ) {

        return 1;

    } else {

        return 2;
    }
}

function handleFirstPoll(map, user, question, amount) {

    console.log("handleFirstPoll user " + user.id + " question " + question.id + " amount=" + amount);

    var userBadge = map[BADGE_TYPE_CREATED_FIRST_POLL];

    if(userBadge == null) {
        console.log("could not find first poll badge record");
        return Parse.Promise.as(null);
    }

    var state = userBadge.get("state");
    var isPreviousBadgeStateProgressing = state == BADGE_STATE_PROGRESSING;

    if(state == BADGE_STATE_COMPLETED) {
        console.log("first badge is complete");
        return Parse.Promise.as(null);
    }

    var maxValue = userBadge.get("badge").get("maxValue");
    var progress = userBadge.get("progress");

    if(progress + 1 >= maxValue && state != BADGE_STATE_DISABLED) {
        console.log("2 handleFirstPoll user " + user.id + " question " + question.id);

        userBadge.set("state", BADGE_STATE_COMPLETED);
    }

    // update userBadge progress
    userBadge.set("progress", progress+1);
    userBadge.set("progressUpdatedAt", question.get("createdAt"));
    userBadge.set("relatedQuestions", [question]);


//    console.log("3 handleFirstPoll user " + user.id + " question " + question.id);

    return userBadge.save().then( function (userBadge) {
        // now to handle notification.

        console.log("successfully saved userBadge handleFirstPoll user " + user.id + " question " + question.id);

        // first unlock notification.
        if(isPreviousBadgeStateProgressing && userBadge.get("state") == BADGE_STATE_COMPLETED) {

            console.log("send notification handleFirstPoll user " + user.id + " question " + question.id);

            return handleNotificationForUnlockedUserBadge(userBadge);
        }

        return Parse.Promise.as(null);

    });
}



function getBadgePointer(badgeType) {

    var badgeObjectId = null;

    switch(badgeType) {

        case BADGE_TYPE_CREATED_FIRST_POLL:
            badgeObjectId = POINTER_BADGE_TYPE_CREATED_FIRST_POLL;
            break;
        case BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW:
            badgeObjectId = POINTER_BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW;
            break;
        case BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW:
            badgeObjectId = POINTER_BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW;
            break;
        case BADGE_TYPE_GOT_500_VOTES:
            badgeObjectId = POINTER_BADGE_TYPE_GOT_500_VOTES;
            break;
        case BADGE_TYPE_GOT_1000_VOTES:
            badgeObjectId = POINTER_BADGE_TYPE_GOT_1000_VOTES;
            break;
        case BADGE_TYPE_50_VOTES_ON_A_POLL:
            badgeObjectId = POINTER_BADGE_TYPE_50_VOTES_ON_A_POLL;
            break;
        case BADGE_TYPE_50_VOTES_ON_10_POLLS:
            badgeObjectId = POINTER_BADGE_TYPE_50_VOTES_ON_10_POLLS;
            break;
        default:
            badgeObjectId = null;
            break;
    }

    if(badgeObjectId == null) {
        return null;
    }

    var badge = new Badge();
    badge.id = badgeObjectId;
    return badge;

}


module.exports.notifyNewPollCreated = function (question, user, amount) {

    console.log("notifyNewPollCreated question=" + question.id + " user=" + user.id + " amount=" + amount + " createdDate=" + question.get("createdAt")  + " user.get numPolls=" + user.get("numPolls"));

    if(user.get("badgesCreatedAt") == null) {
        console.log("badge is not initialized for the user " + user.id);
        return Parse.Promise.as(null);
    }

    var badgeTypes = [BADGE_TYPE_CREATED_FIRST_POLL, BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW, BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW];

    // it can optimize the performance later but now we just check related badge.
    var userBadgeQuery = new Parse.Query(UserBadge);
    userBadgeQuery.ascending('type');
    userBadgeQuery.containedIn("type", badgeTypes);
    userBadgeQuery.equalTo('user', user);
    userBadgeQuery.limit(3);
    userBadgeQuery.include("badge");
    return userBadgeQuery.find().then(function(results) {

        var map = new Object();
        results.forEach(function(userBadge) {
            map[userBadge.get("type")] = userBadge;
        });

        var promises = [];
        // handle BADGE_TYPE_CREATED_FIRST_POLL.
        promises.push(handleFirstPoll(map, user, question, amount));
        // handle BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW,
        //promises.push(handleCreationStreak(map, user, question, amount, BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW));
        // handle BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW
        //promises.push(handleCreationStreak(map, user, question, amount, BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW));

        return Parse.Promise.when(promises);

    }, function(error) {

        console.log("error in handling notifyNewPollCreated " + error.message);
        return Parse.Promise.error(error);

    });

}

module.exports.notifyNewAnswerCreated = function (answer, question, user, amount) {

    console.log("notifyNewAnswerCreated answer=" + answer.id + " question=" + question.id + " user=" + user.id + " amount=" + amount + " createdDate=" + question.get("createdAt")  + " user.get numPolls=" + user.get("numPolls"));

    if(user.get("badgesCreatedAt") == null) {
        console.log("badge is not initialized for the user " + user.id);
        return Parse.Promise.as(null);
    }

    var badgeTypes = [BADGE_TYPE_GOT_500_VOTES, BADGE_TYPE_GOT_1000_VOTES
        , BADGE_TYPE_50_VOTES_ON_A_POLL, BADGE_TYPE_50_VOTES_ON_10_POLLS];

    // it can optimize the performance later but now we just check related badge.
    var userBadgeQuery = new Parse.Query(UserBadge);
    userBadgeQuery.ascending('type');
    userBadgeQuery.containedIn("type", badgeTypes);
    userBadgeQuery.equalTo('user', user);
    userBadgeQuery.limit(4);
    userBadgeQuery.include("badge");
    return userBadgeQuery.find().then(function(results) {

        var map = new Object();
        results.forEach(function(userBadge) {
            map[userBadge.get("type")] = userBadge;
        });

        var promises = [];
        // handle BADGE_TYPE_GOT_500_VOTES.
        promises.push(handleGotManyTotalVotes(map, user, answer, question, amount, BADGE_TYPE_GOT_500_VOTES, 0));
        // handle BADGE_TYPE_GOT_1000_VOTES.
        promises.push(handleGotManyTotalVotes(map, user, answer, question, amount, BADGE_TYPE_GOT_1000_VOTES, 500));
        // handle BADGE_TYPE_50_VOTES_ON_A_POLL
        promises.push(handle50VotesOnPolls(map, user, answer, question, amount, BADGE_TYPE_50_VOTES_ON_A_POLL, 1));
        // handle BADGE_TYPE_50_VOTES_ON_10_POLLS
        promises.push(handle50VotesOnPolls(map, user, answer, question, amount, BADGE_TYPE_50_VOTES_ON_10_POLLS, 1));

        return Parse.Promise.when(promises);

    }, function(error) {

        console.log("error in handling notifyNewPollCreated " + error.message);
        return Parse.Promise.error(error);

    });

}





////////////////////////////////////////////////////////



Parse.Cloud.define("setupBadgesForUserWithPreviousHistory", function(request, response) {

    // check whether
    var requestingUser = request.user;
    var userId = request.params.user_id;

    console.log("setupBadgesForUser userId " + userId + " requesting User " + requestingUser);
    if(requestingUser == null) {
        // TODO need to turn on
        // response.error("setupBadgesForUser : can not detect requesting user");
        // return;
    }

    if(userId == null) {
        response.error("setupBadgesForUser : user id is not specified");
        return;
    }

    //let's check wheter user is exsiting.
    var query = new Parse.Query(Parse.User);
    return query.get(userId, {
      success: function(user) {
        console.log("yes found  user " + user.id);
        return Parse.Promise.as(user);
      },
      error: function(user, error) {
        var errorMsg = "cound not find user " + userId + "error : " + error.message;
        console.log(errorMsg);
        return Parse.Promise.error({ "message": errorMsg, "code": SETUP_BADGE_ERROR_CODE_NON_EXISTING_USER });
      }
    }).then(function (user) {

        Parse.Cloud.useMasterKey();

        // lets check the first badge which is type BADGE_TYPE_CREATED_FIRST_POLL.
        console.log("user is got " + user.get("username"));

        return calculateStats(user);


    }).then(function(user, map) {

        console.log("setupBadgesForUser : totalVotes=" + map["totalVotes"] + " totalQuestionWith50=" + map["totalQuestionWith50"] + " totalQuestions=" + map["totalQuestions"] );
        console.log("setupBadgesForUser longestStreak " + map["longestCreationStreak"] + " longestCreationStreakNum " + map["longestCreationStreakNum"] + " longestCreationStreakPreviousDate " +  map["longestCreationStreakPreviousDate"]);

        if(map == null) {
            return Parse.Promise.error({ "message": "Can not find stats", "code": SETUP_BADGE_ERROR_CODE_CAN_NOT_GET_STATS });
        }

        var promises = [];

        // handle BADGE_TYPE_CREATED_FIRST_POLL.
        promises.push(updateBadge(BADGE_TYPE_CREATED_FIRST_POLL, map["totalQuestions"]>0 ? BADGE_STATE_COMPLETED : BADGE_STATE_PROGRESSING, 1, user, null));

        //handle BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW,
        promises.push(updateBadge(BADGE_TYPE_CREATED_POLL_3_DAYS_IN_A_ROW, map["longestCreationStreakNum"]>=3 ? BADGE_STATE_COMPLETED : BADGE_STATE_PROGRESSING, map["longestCreationStreakNum"], user, map["longestCreationStreak"]));

        //handle BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW,
        promises.push(updateBadge(BADGE_TYPE_CREATED_POLL_7_DAYS_IN_A_ROW, map["longestCreationStreakNum"]>=7 ? BADGE_STATE_COMPLETED : BADGE_STATE_PROGRESSING, map["longestCreationStreakNum"], user, map["longestCreationStreak"]));

        //handle BADGE_TYPE_GOT_500_VOTES,
        promises.push(updateBadge(BADGE_TYPE_GOT_500_VOTES, map["totalVotes"]>=500 ? BADGE_STATE_COMPLETED : BADGE_STATE_PROGRESSING, map["totalVotes"], user, null));

        //handle BADGE_TYPE_GOT_1000_VOTES,
        promises.push(updateBadge(BADGE_TYPE_GOT_1000_VOTES, map["totalVotes"]>=1000 ? BADGE_STATE_COMPLETED : BADGE_STATE_PROGRESSING, map["totalVotes"], user, null));

        //handle BADGE_TYPE_50_VOTES_ON_A_POLL,
        promises.push(updateBadge(BADGE_TYPE_50_VOTES_ON_A_POLL, map["totalQuestionWith50"]>=1 ? BADGE_STATE_COMPLETED : BADGE_STATE_PROGRESSING, map["totalQuestionWith50"], user, null));

        //handle BADGE_TYPE_50_VOTES_ON_A_POLL,
        promises.push(updateBadge(BADGE_TYPE_50_VOTES_ON_10_POLLS, map["totalQuestionWith50"]>=10 ? BADGE_STATE_COMPLETED : BADGE_STATE_PROGRESSING, map["totalQuestionWith50"], user, null));


        return Parse.Promise.when(promises);

    }).then(function(result) {   // handling response to this cloud function.
        console.log("set up Badges successfully " + userId);
        response.success("set up Badges successfully " + userId);
    }, function(error) {
        console.log("falied in setting up Badges " + userId + " error : " + error.message);
        response.error("falied in setting up Badges " + userId + " error : " + error.message);
    });

});


function handleCreationStreak(map, user, question, amount, badgeType) {

    console.log("handleCreationStreak user " + user.id + " question " + question.id + " amount=" + amount + " badge type=" + badgeType);

    var userBadge = map[badgeType];

    if(userBadge == null) {
        console.log("could not find badge record " + badgeType);
        return Parse.Promise.as(null);
    }

    var state = userBadge.get("state");
    var isPreviousBadgeStateProgressing = state == BADGE_STATE_PROGRESSING;

    if(state == BADGE_STATE_COMPLETED) {
        console.log("badge " + badgeType + " is already completed");
        return Parse.Promise.as(null);
    }

    var maxValue = userBadge.get("badge").get("maxValue");
    var progress = userBadge.get("progress");
    var progressUpdatedAt = userBadge.get("progressUpdatedAt");
    var questionCreatedAt = question.get("createdAt");

    // now handling progress update for this kind of badge
    var dayGap = daysBetweenTwoDates(progressUpdatedAt, questionCreatedAt);
    var relatedQuestions = userBadge.get("relatedQuestions");
    if(progress == 0 || dayGap > 1) {
        //initial state
        //let's start.
        progress = 1;
        relatedQuestions = [question];
    } else if(dayGap == 1) {
        // one day difference
        progress += 1;
        relatedQuestions.push(question);
        console.log("handling badge type " + badgeType +  " found successive creation : user " + user.id + " question " + question.id + " progress " + progress + " pre=" + progressUpdatedAt + " qcreated=" + questionCreatedAt);
    } else {
        // other case like same day....
        // progress is same.
        if(relatedQuestions.length > 0) {
            relatedQuestions.pop();
        }
        relatedQuestions.push(question);
    }

    // lets check it meets the requirement
    if(progress >= maxValue && state != BADGE_STATE_DISABLED) {
        console.log("handling badge type " + badgeType + " completed user " + user.id + " question " + question.id + " progress " + progress + " pre=" + progressUpdatedAt + " qcreated=" + questionCreatedAt);
        userBadge.set("state", BADGE_STATE_COMPLETED);
    }

    // update userBadge progress
    userBadge.set("progress", progress);
    userBadge.set("progressUpdatedAt", questionCreatedAt);
    userBadge.set("relatedQuestions", relatedQuestions);

    return userBadge.save().then( function (userBadge) {
        // now to handle notification.

        console.log("handling badge type " + badgeType + "successfuly saved userBadge user " + user.id + " question " + question.id);

        // first unlock notification.
        if(isPreviousBadgeStateProgressing && userBadge.get("state") == BADGE_STATE_COMPLETED) {
            console.log("handling badge type " + badgeType + "newly completed so will send notification user " + user.id + " question " + question.id);
            return handleNotificationForUnlockedUserBadge(userBadge);
        }
        return Parse.Promise.as(null);

    });

}




function calculateStats(user) {


    console.log("calculateStats 1");

    var map = new Object();
    map["totalVotes"] = 0;
    map["totalQuestionWith50"] = 0;
    map["totalQuestions"] = 0;


    map["longestCreationStreak"] = [];
    map["longestCreationStreakNum"] = 0;
    map["longestCreationStreakPreviousDate"] = new Date(10);

    map["currentCreationStreak"] = [];
    map["currentCreationStreakNum"] = 0;
    map["currentCreationStreakPreviousDate"] = new Date(10);

    var userQuestionQuery = new Parse.Query(Question);
    userQuestionQuery.ascending("createdAt");
    userQuestionQuery.equalTo("createdBy", user);

    return ParseQuery.runQueryPaginated({
                query:userQuestionQuery,
                pageCB: function(questions) {

                    var totalVotes = map["totalVotes"];
                    var totalQuestionWith50 = map["totalQuestionWith50"];
                    var totalQuestions = map["totalQuestions"];

                    var oneDayMilliseconds = 1000 * 60 * 60 * 24;

//    console.log("calculateStats 1.5 " + questions.length );

                  questions.forEach(function(question) {

                        totalQuestions += 1;

                        var totalAnswerNumber = (question.get('oneResponses') || 0) + (question.get('twoResponses') || 0) + (question.get('threeResponses') || 0);

//    console.log("calculateStats 1.6" + question.id + " totalAnswer = " + totalAnswerNumber);

                        totalVotes += totalAnswerNumber;
                        if(totalAnswerNumber >= TOTAL_VOTES_PER_QUESTION) {
                            totalQuestionWith50 += 1;
                        }

                        //let's calcuate current streak.
                        // if current one is 0 or today is more than one day from previous streak date.
                        var creationDateForCurrentQuestion = question.get("createdAt");
                        var previousStreakDate = map["currentCreationStreakPreviousDate"];

//                        var oneMoreDayFromPreviousStreakDate = new Date(previousStreakDate.getTime() + oneDayMilliseconds);
                        var oneMoreDayFromPreviousStreakDate = new Date(previousStreakDate.getTime());

                        creationDateForCurrentQuestion.setHours(0, 0, 0, 0);
                        oneMoreDayFromPreviousStreakDate.setHours(0, 0, 0, 0);

//            console.log("1 current " + map["currentCreationStreak"] + " num " + map["currentCreationStreakNum"] + " previous date " +  map["currentCreationStreakPreviousDate"]);


                        if(map["currentCreationStreakNum"] == 0) {
                            map["currentCreationStreak"] = [question];
                            map["currentCreationStreakNum"] = 1;
                            map["currentCreationStreakPreviousDate"] = question.get("createdAt");
//            console.log("2 current " + map["currentCreationStreak"] + " num " + map["currentCreationStreakNum"] + " previous date " +  map["currentCreationStreakPreviousDate"]);

                        } else if ( creationDateForCurrentQuestion.getTime() -  oneMoreDayFromPreviousStreakDate.getTime() == 0 ) {
                            // it is same day
                            map["currentCreationStreak"] = [question];
                            map["currentCreationStreakNum"] = 1;
                            map["currentCreationStreakPreviousDate"] = question.get("createdAt");
//            console.log("3 current " + map["currentCreationStreak"] + " num " + map["currentCreationStreakNum"] + " previous date " +  map["currentCreationStreakPreviousDate"]);

                        } else if ( creationDateForCurrentQuestion.getTime() -  oneMoreDayFromPreviousStreakDate.getTime() == oneDayMilliseconds ) {

                            console.log("4 current " + creationDateForCurrentQuestion + " one day more from previous = " + oneMoreDayFromPreviousStreakDate);
                            // it is next day
                            // increase streak.
                            map["currentCreationStreak"].push(question);
                            map["currentCreationStreakNum"] = map["currentCreationStreakNum"] + 1;
                            map["currentCreationStreakPreviousDate"] = question.get("createdAt");
//            console.log("4 current " + map["currentCreationStreak"] + " num " + map["currentCreationStreakNum"] + " previous date " +  map["currentCreationStreakPreviousDate"]);

                        } else {
                            // it will be new streak.
                            map["currentCreationStreak"] = [question];
                            map["currentCreationStreakNum"] = 1;
                            map["currentCreationStreakPreviousDate"] = question.get("createdAt");
//            console.log("5 current " + map["currentCreationStreak"] + " num " + map["currentCreationStreakNum"] + " previous date " +  map["currentCreationStreakPreviousDate"]);

                        }

//            console.log("6 current " + map["currentCreationStreak"] + " num " + map["currentCreationStreakNum"] + " previous date " +  map["cStreakPreviousDate"]);
//            console.log("6 longest " + map["longestCreationStreak"] + " num " + map["longestCreationStreakNum"] + " previous date " +  map["longestCreationStreakPreviousDate"]);

                        // now to check to update the longest;
                        if(map["currentCreationStreakNum"] >= map["longestCreationStreakNum"]) {
                            map["longestCreationStreak"] = map["currentCreationStreak"].slice(0);
                            map["longestCreationStreakNum"] = map["currentCreationStreakNum"];
                            map["longestCreationStreakPreviousDate"] = map["currentCreationStreakPreviousDate"];
 //           console.log("7 current " + map["currentCreationStreak"] + " num " + map["currentCreationStreakNum"] + " previous date " +  map["currentCreationStreakPreviousDate"]);
 //           console.log("7 longest " + map["longestCreationStreak"] + " num " + map["longestCreationStreakNum"] + " previous date " +  map["longestCreationStreakPreviousDate"]);

                        }
                    });

                    map["totalVotes"] = totalVotes;
                    map["totalQuestionWith50"] = totalQuestionWith50;
                    map["totalQuestions"]  = totalQuestions;

                    return Parse.Promise.as();
                },
                pageSize: 500

    }).then(function() {

//            console.log("calculateStats 3");

            console.log("totalVotes " +  map["totalVotes"] + " totalQuestionWith50 " + map["totalQuestionWith50"]);
            console.log("current " + map["currentCreationStreak"] + " num " + map["currentCreationStreakNum"] + " previous date " +  map["currentCreationStreakPreviousDate"]);
            console.log("longest " + map["longestCreationStreak"] + " num " + map["longestCreationStreakNum"] + " previous date " +  map["longestCreationStreakPreviousDate"]);

            return Parse.Promise.when(user, map);

        }, function(error) {

//            console.log("calculateStats 4");


            return Parse.Promise.error(error);
    });


}
