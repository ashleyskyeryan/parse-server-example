var HOST_NAME_DEV = "little://loveit-dev.parseapp.com/";
var HOST_NAME_PROD = "little://loveit.parseapp.com/";

var HOST_NAME = HOST_NAME_DEV;
if (Parse.applicationId === "DdoyUXH5i7ksGLV0ML3zd6XtguiOfpWmASzBvcnO") {
    HOST_NAME = HOST_NAME_PROD;
}

module.exports.getHostName = function() {
    return HOST_NAME;
}