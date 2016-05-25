var _ = require('underscore');

var Question = Parse.Object.extend('Question');
var Follow = Parse.Object.extend('Follow');

Parse.Cloud.define("autoFollowUsers", function(request, response) {

    var userQuery = new Parse.Query(Parse.User);
    userQuery.descending("createdAt");
    userQuery.limit(400);

    // Get last 100 questions which is created by latest 100 user
    var questionQuery = new Parse.Query(Question);
    questionQuery.descending("createdAt");
    questionQuery.matchesQuery("createdBy", userQuery);
    questionQuery.limit(100)
    questionQuery.find().then(function(results) {

        // get new users from new questions
        var users = _.chain(results).map(function(question) {
            return question.get('createdBy');
        }).uniq(false, function(user) {
            return user.id;
        }).value();

        return Parse.Promise.when(Parse.Promise.as(users), Parse.Config.get());

    }).then(function(users, config) {

        // get admin users
        var admins = config.get("editorial");
        admins = _.map(admins, function(id) {
            var user = new Parse.User();
            user.id = id;
            return user;
        });

        // Get all the user this user already following
        var followerQuery = new Parse.Query(Follow);
        followerQuery.equalTo('follower', request.user);
        followerQuery.containedIn('followee', users.concat(admins));

        return Parse.Promise.when(Parse.Promise.as(users), followerQuery.find(), Parse.Promise.as(admins));

    }).then(function(users, results, admins) {

        // filter this user already following 
        var alreadyFollowed = {};
        _.each(results, function(follow) {
            alreadyFollowed[follow.get('followee').id] = true;
        });

        users = _.filter(users, function(user) {
            return (!alreadyFollowed.hasOwnProperty(user.id) && !request.user.hasOwnProperty(user.id));
        }, []);

        admins = _.filter(admins, function(user) {
            return (!alreadyFollowed.hasOwnProperty(user.id) && !request.user.hasOwnProperty(user.id));
        }, []);

        return Parse.Promise.when(Parse.Promise.as(users), Parse.Promise.as(admins));

    }).then(function(users, admins) {

        // randomize the list of user
        users = _.chain(users)
                 .shuffle()
                 .first(5)
                 .value();

        // randomize the list of user
        admins = _.chain(admins)
                 .shuffle()
                 .first(5)
                 .value();

         return Parse.Promise.as(users.concat(admins));

    }).then(function(users) {

        if (users.length === 0) {
            return Parse.Promise.as("done");
        }

        // insert the follows
        var follows = _.map(users, function(user) {
            var follow = new Follow();
            follow.set("follower", request.user);
            follow.set("followee", user);
            return follow;
        });

        Parse.Object.saveAll(follows, {
            success: function(list) {
                return Parse.Promise.as(list);
            },
            error: function(error) {
                return Parse.Promise.as([]);
            },
        })
        return Parse.Promise.as(Parse.Object.saveAll(follows));
    }).then(function(result) {
        response.success("good job " + result.length);
    }, function(error) {
        response.error("bad job " + error.message);
        //response.error("bad job ");
    });
});

Parse.Cloud.beforeSave('Follow', function(request, response) {
    var follow = request.object;

    var follower = follow.get('follower').fetch();
    follower.then(function(fr) {
        if (fr == null) {
            response.error("Follower is not a valid user");
            return;
        }

        var followee = follow.get('followee').fetch();
        followee.then(function(fe) {
            if (fe == null) {
                response.error("Followee is not a valid user");
                return;
            }
            if (fr.id == fe.id) {
                response.error("User cannot follow himself/herself.");
                return;
            }

            var query = new Parse.Query(Follow);
            query.equalTo("follower", follow.get("follower"));
            query.equalTo("followee", follow.get("followee"));
            query.first({
                success: function(object) {
                    if (object == null) {
                    } else {
                        follow.id = object.id;
                    }
                    response.success();
                },
                error: function(error) {
                    response.error("Error " + error.code + " : " + error.message + " when getting follow.");
                }
            });
        });
    });
});


