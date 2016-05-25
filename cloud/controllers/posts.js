var _ = require('underscore');
var express = require('express');
var path = require('path');

var platform = require('../../cloud/libs/platform.js');

var Post = Parse.Object.extend('Post');

var Question = Parse.Object.extend('Question');

exports.show = function(req, res) {
    var postQuery = new Parse.Query(Question);
    postQuery.include("createdBy");
    var foundPost;
    postQuery.get(req.params.id).then(function(post) {

      if (post) {
        foundPost = post;

        console.log(foundPost);

        return [];

        var commentQuery = new Parse.Query(Comment);
        commentQuery.equalTo('post', post);
        commentQuery.descending('createdAt');
        return commentQuery.find();
      } else {
        return [];
      }
    }).then(function(comments) {

        console.log(comments);
        console.log(foundPost);

      res.render('posts/post', {
        platform: platform.parse(req.get('User-Agent')).os.family,
        question: foundPost,
        createdBy: foundPost.get('createdBy'),
        comments: comments
      });
    },
    function() {

      res.send(500, 'Failed finding the specified question to show');
    });
};

// Display all posts.
exports.index = function(req, res) {
  console.log('where are you?.');
  var query = new Parse.Query(Question);
  query.descending('createdAt');
  query.find().then(function(results) {
    console.log('!where are you?. ' + results);
    //res.sendFile(path.join(__dirname, '/../../public/test.html'));
    res.render('posts/index', {
      posts: results
    });
  }, function() {
    res.send(500, 'Failed loading posts');
  });
};



