var _ = require('underscore');
var cons = require('../cloud/cons.js');
var pushutil = require('../cloud/pushutil.js');
var Trend = Parse.Object.extend('Trend');
/*
Cloud job for push notifications
- Push for Inspiration
*/
var PUSH_INSPIRATION_WEEKEND_LOOK = "push_inspiration_weekend_look";
var PUSH_INSPIRATION_MONDAY_LOOK = "push_inspiration_monday_look";
var PUSH_INSPIRATION_DAILY_TREND = "push_inspiration_daily_trend";

function getTrends() {
    var promise = Parse.Promise.as();
    promise = Parse.Cloud.httpRequest({
        url: 'http://api.polyvore.com/splash_trend/shop_search/stream'
    }).then(function(httpResponse) {
        // success
        // convert response string to json object
        var response = JSON.parse(httpResponse.text);
        // get items array
        var items = response.content.items;
        var trends = [];
        var index;
        for (index = 0; index < items.length; index++) {
            // if item is splash-trend-shop-search
            var trend;
            var item = items[index];
            if (item.class == "splash-trend-shop-search") {
                // build shop url
                if (item.type == "shop") {
                    trend = item.shop_search.query;
                } else if (item.type == "brand") {
                    trend = item.shop_search.brand;
                } else {
                    continue;
                }
            } else {
                continue;
            }
            trends.push(trend);
        }
        return trends;
    },function(httpResponse) {
        // error
        console.log('Fetch trend request failed with response code ' + httpResponse.status);
        promise.error("Request trends failed!");
    });
    return promise;
}

function handleInspirationPush(type, params) {
    var pushData = {
        alert: "Create a poll and see what your friends think",
        uri: cons.getHostName() + "create",
        type: type,
    };

    if (type == PUSH_INSPIRATION_MONDAY_LOOK) {
        pushData.title = "Not sure what to wear tomorrow?";
        sendInspirationPush(pushData, params);
    } else if (type == PUSH_INSPIRATION_WEEKEND_LOOK) {
        pushData.title = "Plan your weekend look!";
        pushData.alert = "Create a poll and see what your friends think";
        sendInspirationPush(pushData, params);
    } else if (type == PUSH_INSPIRATION_DAILY_TREND) {
        pushData.alert = "Compare items from the trend";
        pushData.title = "So hot right now: " + params.query + "!";
        pushData.uri = cons.getHostName() + "create?query=" + params.query;
        getTrends().then(function(trends) {
            console.log("Here got a list of trends " + trends.length);
            Parse.Cloud.useMasterKey();

            // Query for trends which have been selected within 10 days
            var d = new Date(); // gets today
            var d1 = new Date(d - 1000 * 60 * 60 * 24 * 10); // gets 10 days ago

            var trendQuery = new Parse.Query(Trend);
            trendQuery.greaterThan("createdAt", d1);
            return Parse.Promise.when(Parse.Promise.as(trends), trendQuery.find());
        }, function(error) {
            status.error("Failed to get trends list, drop push inspiration daily!");
        }).then(function(trends, blacklist) {
            // Get the first item of the trend list as candidate
            var candidate;
            if (trends.length > 0) {
                candidate = trends[0];
            }
            console.log("Here blacklist size = " + blacklist.length);
            // Filter blacklisted items from the trend list
            if (blacklist.length > 0) {
                var blacklisted = {};
                _.each(blacklist, function(blacklistItem) {
                    blacklisted[blacklistItem.get('name')] = true;
                });

                trends = _.filter(trends, function(trend) {
                    return (!blacklisted.hasOwnProperty(trend));
                }, []);
            }
            console.log("Here filter trend list = " + trends.length);
            // replace candidate with the first item in the filtered trend list
            // If the filtered trend list is empty, return the original candidate
            if (trends.length > 0) {
                candidate = trends[0];
            }
            return Parse.Promise.as(candidate);
        }).then(function(trend) {
            if (trend != null) {
                var trendObject = new Trend();
                trendObject.set("name", trend);
                trendObject.save();
                pushData.BUNDLE_SEARCH_QUERY = trend;
                pushData.title = "So hot right now: " + trend + "!";
                pushData.uri = cons.getHostName() + "create?query=" + trend;
            }
            console.log("Here pushData uri = " + pushData.uri);
            sendInspirationPush(pushData, params);
        });
    }
}

function sendInspirationPush(pushData, params) {
    // Only send push to myself if it's in test mode
    if (params.test == "true") {
        var query = new Parse.Query(Parse.User);
        query.equalTo("username", "vbvb");

        var productQuery = params.query;
        query.find().then(function(results) {
            var numberOfUsersToHandle = results.length;
            console.log("number of users to Handle = " + numberOfUsersToHandle);

            for (var i = 0; i < results.length; i++) {
                var user = results[i];
                pushutil.sendPushToUser(user, pushData);
            }
        });
    } else if (params.limit) {
        var query = new Parse.Query(Parse.Installation);
        query.descending('createdAt');
        query.limit(params.limit);
        pushutil.sendPushToQuery(query, pushData);
    } else {
        pushutil.sendPushToAll(pushData);
    }
}
