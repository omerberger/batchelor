'use strict';
var async = require("async");
var _ = require("lodash");
var request = require("request");
var utils = require("./util/Utils");
var validator = require("./util/Validator");
var CONST = require("./util/Const");
var log = require("./util/Logger");
var config = require("./util/Config");
var internalTransport;

/**
 * Will issue all calls using async and request
 * @param requests
 * @param done - callback method to call once finish processing all requests
 */
function issueCalls(requests, done) {
    if (!internalTransport) {
        log.debug("[batchelor] Transport running issueCalls");
        var requestsMap = {};
        // creates the collection of 'requests' (holds a collection of getReq methods)
        var allRequests = _validateRequests(requests);
        allRequests.valid.forEach(function (req) {
            requestsMap[req.name] = _getAsyncRequestWrapper(req);
        });

        async.parallelLimit(requestsMap, config.getConf().maxConcurrentBatches, function (err, results) {
            if (err) {
                log.error("[batchelor] Transport Error in running requests, err: " + err);
                done(err);
            }
            else {
                log.debug("[batchelor] Transport finished running requests, results:" + JSON.stringify(results));
                _.assign(results, allRequests.invalid);
                done(null, results);
            }
        });
    } else {
        internalTransport.issueCalls(requests, done);
    }
}

/**
 * Allows overriding transport layer or clearing it (by providing void 0)
 * @param transport
 */
function setTransport(transport) {
    if (!transport || (transport && typeof transport.issueCalls === "function")) {
        internalTransport = transport;
    }
}

/**
 * method building the request for the running process
 * @param requests
 * @returns {{valid: Array, invalid: {}}}
 * @private
 */
function _validateRequests(requests) {
    log.debug("[batchelor] Transport _validateRequests");
    requests = utils.padArray(requests);
    var batchRequests = {
        valid: [],
        invalid: {}
    };
    requests.forEach(function (req) {
        var clonedRequest = _.clone(config.getConf().request, true); //Deep clone
        _.merge(clonedRequest, req);

        if (validator.isValidRequest(clonedRequest)) {
            batchRequests.valid.push(validator.cleanRequest(clonedRequest));
        }
        else {
            batchRequests.invalid[req.name || "missingName"] = CONST.RESPONSE_TYPE.INVALID_TASK;
        }
    });

    return batchRequests;
}


/**
 * method to be called in parallel from async.parallelLimit
 * @param req - request to threat
 * @returns {Function}
 * @private
 */
function _getAsyncRequestWrapper(req) {
    return function (done) {
        req.body = req.body || req.data;
        try {
            req.headers.HTTP_X_FORWARDED_FOR = req.ip;

            req.timeout = parseInt(req.timeout, 10) || req.timeout;
            log.debug("[batchelor] Transport Requesting URL: " + req.url + ", headers: " + JSON.stringify(req.headers) + ", method: " + req.method + ", body(when POST method): " + req.body + ", timeout: " + req.timeout);

            // request to the API host for every job
            request(req, function (error, response, body) {
                var result = _processResponse(error, response, body, req);
                done(null, result);
            });
        }
        catch (ex) {
            log.error("[batchelor] Transport exception parsing the body or in request, ex: " + ex);
            done(ex);
        }
    };
}

/**
 * callback method to be called once request return from call
 * @param originalRequest
 * @param error
 * @param response
 * @param body
 * @private
 */
function _processResponse(error, response, body, originalRequest) {
    log.debug("[Transport] _processResponse");
    var result = {};
    var rawHeaders;

    if (error || !response) {
        log.error("[batchelor] Transport _processResponse no response or error with originalRequest.url: " + originalRequest.url + ", IP: " + originalRequest.ip + (error ? " Error Code: " + error.code : ""));
        result = error ? CONST.RESPONSE_TYPE[error.code] || CONST.RESPONSE_TYPE.ERROR_API_URL : CONST.RESPONSE_TYPE.ERROR_API_URL;
    } else {
        try {
            log.debug("[batchelor] Transport _processResponse body: " + body + " originalRequest.url: " + originalRequest.url);
            if(typeof  body === 'string') {
                result.body = JSON.parse(body);
            }else{
                result.body = body;
            }
        } catch (err) {
            result.body = body;//Might be string and not JSON
            log.debug(CONST.BODY_RESPONSE.NO_JSON_OBJECT + ", IP: " + originalRequest.ip + " body: " + body + "originalRequest.url: " + originalRequest.url);
        }

        // set the headers/status in the result object
        result.headers = response.headers;
        result.statusCode = result.statusCode || response.statusCode;
        result.HTTPStatus = result.HTTPStatus || response.statusCode;

        // if the flag originalHeader is true, add originalHeader to the response
        if (config.getConf().originalHeader || originalRequest.caseSensitiveHeaders) {

            // call to the method in case one of the options is true
            rawHeaders = _getRawOriginalHeaders(response.rawHeaders);

            if (config.getConf().originalHeader) {
                result.originalHeader = rawHeaders.originalHeadersStr;
            }

            result.headers = (originalRequest.caseSensitiveHeaders) ? rawHeaders.originalHeadersObj : result.headers;
        }
    }

    return result;
}

/**
 * The raw headers as they were received are pass in the headers parameter, which is an array of [key, value, key2, value2, ...]
 * @param rawHeaders: array
 * @private
 */
function _getRawOriginalHeaders(rawHeaders) {
    rawHeaders = rawHeaders || [];
    var rawHeadersStr = "";
    var rawHeadersObj = {};
    for (var i = 0, j = 1; i < rawHeaders.length; i += 2, j += 2) {
        rawHeadersStr += rawHeaders[i] + ": " + rawHeaders[j];
        rawHeadersObj[rawHeaders[i]] = rawHeaders[j];
        // for the last headers don't add '\n'
        rawHeadersStr += (i < rawHeaders.length - 2) ? "\n" : "";
    }
    return {
        originalHeadersStr: rawHeadersStr,
        originalHeadersObj: rawHeadersObj
    };
}

module.exports = {
    issueCalls: issueCalls,
    setTransport: setTransport
};