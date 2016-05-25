// Send push notification to ALL users
module.exports.sendPushToAll = function(pushData) {
    var query = new Parse.Query(Parse.Installation);

    Parse.Push.send({
        where: query,
        data: pushData
    }, {
        success: function() {
            // Push was successful
            console.log("push message success : sendPushToAll " + pushData.title + " " + pushData.alert);
        },
        error: function(error) {
            // Handle error
            console.log("push message fail : sendPushToAll " + pushData.title + " " + pushData.alert);
        }
    });
}

// Send push notification to this user
module.exports.sendPushToUser = function(user, pushData) {
    var query = new Parse.Query(Parse.Installation);
    query.equalTo('currentUser', user);

console.log("11 sendPushToUser");
    return Parse.Push.send({
        where: query,
        data: pushData
    }, {
        success: function() {
            // Push was successful
            console.log("push message success : sendPushToUser " + pushData.title + " " + pushData.alert);
            return Parse.Promise.as(null);
        },
        error: function(error) {
            // Handle error
            console.log("push message fail : sendPushToUser " + pushData.title + " " + pushData.alert);
            return Parse.Promise.error(error);
        }
    });
}

// Send push notification to query
module.exports.sendPushToQuery = function(userQuery, pushData) {
    Parse.Push.send({
        where: userQuery,
        data: pushData
    }, {
        success: function() {
            // Push was successful
            console.log("push message success : sendPushToQuery " + pushData.title + " " + pushData.alert);
        },
        error: function(error) {
            // Handle error
            console.log("push message fail : sendPushToQuery " + pushData.title + " " + pushData.alert);
        }
    });
}