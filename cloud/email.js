var _ = require('underscore');
var mailgun = require('mailgun-js') ({'domain':'sandboxdef07ab0eacd4fb495ba1b9fa3f4abe6.mailgun.org', 'apiKey':'key-0398a72a7b331eb628137e6881d41d8d'});

Parse.Cloud.define("reportAbuse", function(request, response) {
    var user = request.user;
    if (user == null) {
        response.error("No user defined");
        return;
    }

    if (request.params.question == null) {
        response.error("No question defined");
        return;
    }

    mailgun.messages().send({
        to: "poll-feedback@projectlittle.co",
        from: "Report Abuse <postmaster@sandboxdef07ab0eacd4fb495ba1b9fa3f4abe6.mailgun.org>",
        subject: "Report Abuse",
        text: user.getUsername() + " reported this question!\n\n" + request.params.question + "\n\nReason:\n\n" + request.params.reason
    }, function(error, body) {
        if (error) {
            console.error(error);
            response.error("Uh oh, something went wrong");
        } else {
            console.log(body);
            response.success("Email sent!");
        }
    });
});
