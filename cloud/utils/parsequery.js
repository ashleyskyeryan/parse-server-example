// This module implements util functions related to Parse.Query
 
// Parse's limit on limit and skip values.
var MAX_QUERY_LIMIT = 1000;
var MAX_QUERY_SKIP = 10000;
// Helper function for exports.runQueryPaginated
// @param {Parse.Query} query - The query object to run
// @param {function(results)} pageCB - The callback function to handle each result page. This function should return a Promise.
// @param {int} [skip=0] - Where to begin the query, defaults to 0.
// @param {int} [pageSize=1000] - Results to fetch per page, defaults to 1000. If an invalid value (<= 0 or > 1000) is passed it'll be ignored.
function runQuery(params) {
    // Parse doesn't accept skip greater than 10000
    var skip = params.skip || 0;
    if (skip >= MAX_QUERY_SKIP) {
        if (params.complete) {
            params.complete();
        }
        return Parse.Promise.as(0);
    }
 
    var limit = params.pageSize || 0;
    if (limit <= 0 || limit > MAX_QUERY_LIMIT) {
        limit = MAX_QUERY_LIMIT;
    }
 
    var query = params.query;
    query.skip(skip);
    query.limit(limit);
    return query.find().then(function(results) {
        var cbPromise = params.pageCB(results);
        if (results.length < limit) {
            return cbPromise;
        }
 
        var recursionPromise = runQuery({
            query: query,
            skip: skip + limit,
            pageCB: params.pageCB,
            pageSize: params.pageSize
        });
        return Parse.Promise.when(cbPromise, recursionPromise);
    }, function(error) {
        return Parse.Promise.error(error);
    });
}
 
module.exports = {
    // Runs a paginated query and tries to get all results, up to Parse's 10000 limit on skip and 1000 limit on limit.
    //
    // @param {Parse.Query} query - The query object to run
    // @param {function(results)} pageCB - The callback function to handle each result page. This function should return a Promise.
    // @param {int} [pageSize=1000] - results to fetch per page, defaults to 1000. If an invalid value (<= 0 or > 1000) is passed it'll be ignored.
    runQueryPaginated: function(params) {
        return runQuery({
            query: params.query,
            pageCB: params.pageCB,
            skip: 0,
            pageSize: params.pageSize
        });
    }
};


