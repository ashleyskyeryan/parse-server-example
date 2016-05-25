var _ = require('underscore');
var cons = require('../cloud/cons.js');
var pushutil = require('../cloud/pushutil.js');

var Activity = Parse.Object.extend('Activity');

module.exports.createNewActivityObjectAndSendPushNotification = function (activityType, targetUser, message, activityMessage
        , uri, actionUser, question, sendingPushNotifcation, subMessage, destination, type, userBadge, useMessageAsTitleForPush) {
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
        console.log("actionUser is not null : " + actionUser.id + " question id " + question + " sendingPushNotification " + sendingPushNotifcation);

    } else {
        console.log("actionUser is null " + sendingPushNotifcation);
    }
    act.set("question", question);

    console.log("0.5 createNewActivityObjectAndSendPushNotification");

    if(userBadge != null) {
        act.set("userBadge", userBadge);
    }

    console.log("1 createNewActivityObjectAndSendPushNotification");

    //    var sendingPushNotification2 = sendingPushNotifcation;

    var promiseActSave = act.save();

    var pushPromise = Parse.Promise.as(null);

            if (sendingPushNotifcation) {
                var uristr
                if(destination == null) {
                    uristr = cons.getHostName() + "activities/" + activity.id;
                } else {
                    uristr = destination;
                }

                var maxValue = -1;
                var progress = -1;
                if(userBadge != null) {
                    maxValue = userBadge.get("badge").get("maxValue");
                    progress = userBadge.get("progress");
                }

    console.log("2 createNewActivityObjectAndSendPushNotification");

                if(useMessageAsTitleForPush) {

                    pushPromise = sendNewActivityPushToUser(targetUser, message, subMessage, uristr, type, maxValue, progress);
                } else {
                    pushPromise = sendNewActivityPushToUser(targetUser, null, message, uristr, type, maxValue, progress);
                }

            }

console.log("20 createNewActivityObjectAndSendPushNotification");
    return Parse.Promise.when(promiseActSave, pushPromise);

  console.log("21 createNewActivityObjectAndSendPushNotification");

    return act.save(null, {
        success: function(activity) {

  console.log("22 createNewActivityObjectAndSendPushNotification");

            console.log("yeah new activity is saved " + activity.id + " sendingPushNotification= " + sendingPushNotifcation);
            // now send push message.

            if (sendingPushNotifcation) {
                var uristr
                if(destination == null) {
                    uristr = cons.getHostName() + "activities/" + activity.id;
                } else {
                    uristr = destination;
                }

                var maxValue = -1;
                var progress = -1;
                if(userBadge != null) {
                    maxValue = userBadge.get("badge").get("maxValue");
                    progress = userBadge.get("progress");
                }

    console.log("2 createNewActivityObjectAndSendPushNotification");

                if(useMessageAsTitleForPush) {

                    return sendNewActivityPushToUser(targetUser, message, subMessage, uristr, type, maxValue, progress);
                } else {
                    return sendNewActivityPushToUser(targetUser, null, message, uristr, type, maxValue, progress);
                }

            }

            return Parse.Promise.as(null);

        },
        error: function(activity, error) {
            console.log("Failed to create new object, with error code: " + error.message);
            return Parse.Promise.error(error);
        }
    }).then(function (activity) {

            console.log("2 createNewActivityObjectAndSendPushNotification");

    }, function(activity, error) {
            console.log("3 createNewActivityObjectAndSendPushNotification");

    } );

}

function sendNewActivityPushToUser(user, title, message, uristr, type, maxValue, progress) {

console.log("1 sendNewActivityPushToUser");

    var query = new Parse.Query(Parse.Installation);
    query.equalTo('currentUser', user);
    user.set("unreadActivities", 1);

    var promiseUserSave = user.save();
    var pushData = {
      "alert": message,
      "uri": uristr,
      "type": type,
      "maxValue" : maxValue,
      "progress" : progress,
    };

console.log("2 sendNewActivityPushToUser");

    if(title != null) {
      pushData["title"] = title;
    }

    return Parse.Promise.when(promiseUserSave, pushutil.sendPushToUser(user, pushData));

}

