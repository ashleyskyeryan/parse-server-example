var express = require('express');
var moment = require('moment');
var _ = require('underscore');
var md5 = require('../cloud/libs/md5.js');

// Controller code in separate files.
var postsController = require('../cloud/controllers/posts.js');

// Required for initializing Express app in Cloud Code.
var app = express();

// We will use HTTP basic auth to protect some routes (e.g. adding a new blog post)
// var basicAuth = express.basicAuth('bsbs','b');

// The information showed about the poster
var userEmail = 'pv-android@polyvore.com';
var userDisplayName = 'polyvore';
var userDescription = 'polyvore.com';

// Instead of using basicAuth, you can also implement your own cookie-based
// user session management using the express.cookieSession middleware
// (not shown here).

// Global app configuration section
app.set('views', '../cloud/views');
app.set('view engine', 'ejs');  // Switch to Jade by replacing ejs with jade here.
app.use(express.bodyParser());
app.use(express.methodOverride());

// Note that we do not write app.use(basicAuth) here because we want some routes
// (e.g. display all blog posts) to be accessible to the public.

// You can use app.locals to store helper methods so that they are accessible
// from templates.
app.locals._ = _;
app.locals.hex_md5 = md5.hex_md5;
app.locals.userEmail = userEmail;
app.locals.userDisplayName = userDisplayName;
app.locals.userDescription = userDescription;
app.locals.formatTime = function(time) {
  return moment(time).format('MMMM Do YYYY, h:mm a');
};
// Generate a snippet of the given text with the given length, rounded up to the
// nearest word.
app.locals.snippet = function(text, length) {
  if (text.length < length) {
    return text;
  } else {
    var regEx = new RegExp("^.{" + length + "}[^ ]*");
    return regEx.exec(text)[0] + "...";
  }
};

// RESTful routes for the blog post object.
app.get('/posts', postsController.index);
app.get('/posts/:id', postsController.show);

// Required for initializing Express app in Cloud Code.
app.listen();
