Parse.Cloud.job("pushnotification", function(request, status) {
    Parse.Cloud.useMasterKey();

    var d = new Date();
    var currentHour = d.getHours() - 8;
    if (currentHour >= 0 && currentHour < 7) {
        status.success("Push notification job is skipped for hour " + currentHour);
        return;
    }

    var skip = request.params.skip || 0;
    var limit = request.params.limit || 100;

    console.log("skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));
    //    var arr = ["first"];
    var map = new Object();

    var query = new Parse.Query(Question);
    query.limit(limit);
    if (skip > 0) {
        query.skip(skip);
    }
    query.descending('updatedAt');
    query.include("createdBy");
    query.find().then(function(results) {

        var numberOfQuestionsToHandle = results.length;

        console.log("number of questions to Handle = " + numberOfQuestionsToHandle);

        for (var i = 0; i < results.length; i++) {

            var question = results[i];

            var previousPushcount = question.get("pAnswerCnt") || 0;
            var totalAnswerNumber = (question.get('oneResponses') || 0) + (question.get('twoResponses') || 0) + (question.get('threeResponses') || 0);

            if (totalAnswerNumber > previousPushcount && totalAnswerNumber > 1) {

                var c = question.get("createdBy");

                if (c == null) {
                    numberOfQuestionsToHandle--;
                    sendPushIfAllTheQuestion(numberOfQuestionsToHandle, map);
                    continue;
                }

                var firstAnswerQuery = new Parse.Query(Answer);
                firstAnswerQuery.descending('createdAt');
                firstAnswerQuery.equalTo('question', question);
                firstAnswerQuery.notEqualTo('createdBy', c);
                firstAnswerQuery.include('createdBy');
                firstAnswerQuery.include('question');
                firstAnswerQuery.limit(1);
                firstAnswerQuery.find().then(function(answers) {
                    if (answers.length < 1) {
                        numberOfQuestionsToHandle--;
                        sendPushIfAllTheQuestion(numberOfQuestionsToHandle, map);
                        return;
                    }

                    var answer = answers[0];
                    var answerer = answer.get('createdBy');

                    if (answerer == null) {
                        numberOfQuestionsToHandle--;
                        console.error("error answerer is null question id  answer id = " + answer.id);
                        sendPushIfAllTheQuestion(numberOfQuestionsToHandle, map);
                        return;
                    }

                    var userName = answerer.get('username');
                    var question = answer.get("question");

                    var previousPushcount = question.get("pAnswerCnt") || 0;
                    var totalAnswerNumber = (question.get('oneResponses') || 0) + (question.get('twoResponses') || 0) + (question.get('threeResponses') || 0);

                    var totalAnswerNumberMinusOne = totalAnswerNumber - previousPushcount - 1;

                    var c = question.get("createdBy");
                    console.log(" inside FirstAnswer question id = " + question.id + " target user " + c.id + " action user " + answerer.id);

                    if (map.hasOwnProperty(c.id)) {
                        var pushData = map[c.id];
                        var previousSum = pushData["count"];
                        pushData["count"] = previousSum + (totalAnswerNumber - previousPushcount);
                        console.log("found another question belong to " + c.id + " current count " + pushData["count"]);
                    } else {
                        var pushData = new Object();
                        pushData["count"] = totalAnswerNumber - previousPushcount - 1;
                        pushData["targetUser"] = c;
                        pushData["answererName"] = userName;
                        map[c.id] = pushData;
                        console.log("found frist question belong to " + c.id + " current count " + pushData["count"]);
                    }

                    var activityMessage;
                    if (totalAnswerNumberMinusOne == 0) {
                        activityMessage = userName + " voted on your poll.";
                    } else if (totalAnswerNumberMinusOne == 1) {
                        activityMessage = userName + " & " + totalAnswerNumberMinusOne + " other person voted on your poll.";
                    } else {
                        activityMessage = userName + " & " + totalAnswerNumberMinusOne + " people voted on your poll.";
                    }

                    var message = activityMessage + " See poll results.";

                    question.set("pAnswerCnt", totalAnswerNumber);
                    question.save();

                    //                     var sendingPushNotification;
                    //                     if(arr.indexOf(c.id) >= 0) {
                    //                         console.log("already sent push to " + c.id);
                    //                         sendingPushNotification = false;
                    //                     } else {
                    //                         arr.push(c.id);
                    //                         console.log("push is being sent to " + c.id);
                    //                         sendingPushNotification = true;
                    //                     }

                    var uristr = cons.getHostName() + "posts/" + question.id;
                    createActivityObjectAndSendPushNotification(TYPE_ACTIVITY_YOU_HAVE_THIS_MANY_VOTES,
                        c, message, activityMessage, uristr, answerer, question, false, null, null, PUSH_RESULTS_PER_3HRS);

                    numberOfQuestionsToHandle--;
                    sendPushIfAllTheQuestion(numberOfQuestionsToHandle, map);

                });
            } else {
                numberOfQuestionsToHandle--;
                sendPushIfAllTheQuestion(numberOfQuestionsToHandle, map);
            }
        }

        // TODO when call back is done the set call status.success
        //        status.success("erverything is good");
    });


});

Parse.Cloud.job("followingCreateNewPollPushNotification_0_250", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 0;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_250_500", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 250;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_500_750", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 500;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_750_1000", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 750;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_1000_1250", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 1000;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_1250_1500", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 1250;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_1500_1750", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 1500;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_1750_2000", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 1750;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_2000_2250", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 2000;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_2250_2500", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 2250;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_2500_2750", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 2500;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_2750_3000", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 2750;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_3000_3250", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 3000;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_3250_3500", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 3250;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_3500_3750", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 3500;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_3750_4000", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 3750;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_4000_4250", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 4000;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_4250_4500", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 4250;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_4500_4750", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 4500;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification_4750_5000", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 4750;
    var limit = request.params.limit || 250;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingCreateNewPollPushNotification", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 0;
    var limit = request.params.limit || 3000;
    var pageSize = 1000;

    console.log("followingCreateNewPollPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit));

    handleFollowCreatingNewPoll(0, pageSize, skip, limit);

});


Parse.Cloud.job("followingNewAnswerPushNotification_0_300", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 0;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_300_600", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 300;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_600_900", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 600;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_900_1200", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 900;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_1200_1500", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 1200;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_1500_1800", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 1500;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_1800_2100", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 1800;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_2100_2400", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 2100;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_2400_2700", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 2400;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_2700_3000", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 2700;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_3000_3300", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 3000;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_3300_3600", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 3300;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_3600_3900", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 3600;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_3900_4200", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 3900;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_4200_4500", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 4200;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_4500_4800", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 4500;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

Parse.Cloud.job("followingNewAnswerPushNotification_4800_5100", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 4800;
    var limit = request.params.limit || 300;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});


Parse.Cloud.job("followingNewAnswerPushNotification", function(request, status) {
    Parse.Cloud.useMasterKey();

    var skip = request.params.skip || 0;
    var limit = request.params.limit || 3000;
    var pageSize = 1000;

    console.log("followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    console.log("start followingNewAnswerPushNotification skip =" + skip + " limit = " + limit + " sum = " + (skip + limit) + " start on time " + Date.now());
    handleFollowNewAnswer(0, pageSize, skip, limit);

});

//require('../cloud/app.js');
//
// Once on Thursday night at 7PM (3AM UTC)
// Since parse doesn't support for scheduling weekly job
// we have to check the day and skip the other days manually
Parse.Cloud.job("pushInspirationWeekend", function(request, status) {
    var d = new Date();
    var currentDay = d.getDay();
    if (currentDay != 5) {
        status.success("Push notification job is skipped for day " + currentDay);
        return;
    }
    handleInspirationPush(PUSH_INSPIRATION_WEEKEND_LOOK, request.params);
});

// Once on Sunday night at 7PM
Parse.Cloud.job("pushInspirationMonday", function(request, status) {
    var d = new Date();
    var currentDay = d.getDay();
    if (currentDay != 1) {
        status.success("Push notification job is skipped for day " + currentDay);
        return;
    }
    handleInspirationPush(PUSH_INSPIRATION_MONDAY_LOOK, request.params);
});

// Once every morning at 7AM
Parse.Cloud.job("pushInspirationDaily", function(request, status) {
    handleInspirationPush(PUSH_INSPIRATION_DAILY_TREND, request.params);
});

