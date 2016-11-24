'use strict';
var querystring = require('querystring');
var crypto = require('crypto');

var getCookie = function(req, cookieName) {
    return req.cookies[cookieName];
};

var getQueryValue = function(req, options, key) {
    return req.query[options.queryStringPrefix + key];
};

var getAllQueryValues = function(req, options) {
    return {
        QueueId: getQueryValue(req, options, "q"),
        PlaceInQueue: getQueryValue(req, options, "p"),
        Timestamp: getQueryValue(req, options, "ts"),
        Hash: getQueryValue(req, options, "h"),
        RedirectType: getQueryValue(req, options, "rt")
    };
};

var getOriginalUrl = function(req, options) {
    var url = getRedirectedUrl(req);
    url = url.replace(getRegex(options, "q"), "");
    url = url.replace(getRegex(options, "ts"), "");
    url = url.replace(getRegex(options, "c"), "");
    url = url.replace(getRegex(options, "e"), "");
    url = url.replace(getRegex(options, "rt"), "");
    url = url.replace(getRegex(options, "h"), "");
    url = url.replace(getRegex(options, "p"), "");
    url = url.replace(/[\?&]$/, "");
    return url;
};

var getRegex = function(options, key) {
    return new RegExp("([\?&])(" + options.queryStringPrefix + key + "=[^&]*)", "i");
};

var getRedirectedUrl = function(req) {
    return req.protocol + '://' + req.get('host') + req.originalUrl;
};

module.exports = function(options)
{
    var version = "1.0.5";
    var defaultDomain = ".queue-it.net";
    var cookieNamePrefix = "QueueITAccepted-SDFrts345E-";

    options.getCookie = opt(options, "getCookie", getCookie);
    options.queryStringPrefix = opt(options, "queryStringPrefix", "");
    options.cookieExpiration = opt(options, "cookieExpiration", 1200000);
    var cookieName = cookieNamePrefix + options.customerId + "-" + options.eventId;

    function opt(options, name, defaultValue) {
        return options && options[name]!==undefined ? options[name] : defaultValue;
    }

    return {
        validate: function (req, res, callback) {

            if (options.getCookie(req, cookieName))
            {
                var cookie = this.deserializeCookie(options.getCookie(req, cookieName));

                if (new Date().getTime() < new Date(Date.parse(cookie.Expiration)).getTime())
                {
                    var hashForCookie = this.generateHashForCookie(cookie.QueueId, cookie.OriginalUrl, cookie.PlaceInQueue, cookie.RedirectType, cookie.Timestamp, cookie.Expiration);
                    if (hashForCookie == cookie.Hash)
                    {
                        if (cookie.RedirectType != "Idle")
                        {
                            this.setCookie(res, cookie.QueueId, cookie.OriginalUrl, cookie.PlaceInQueue, cookie.RedirectType, cookie.Timestamp);
                        }
                        return callback(null);
                    }
                }
            }

            var queryValues = getAllQueryValues(req, options);

            if (queryValues.QueueId &&
                queryValues.PlaceInQueue &&
                queryValues.Timestamp &&
                queryValues.Hash &&
                queryValues.QueueId.length > 0 &&
                queryValues.PlaceInQueue.length > 0 &&
                queryValues.Timestamp.length > 0 &&
                queryValues.Hash.length > 0 &&
                !isNaN(queryValues.Timestamp))
            {
                var originalUrl = getOriginalUrl(req, options);
                var expectedHash = queryValues.Hash;
                var timestamp = queryValues.Timestamp;
                if (this.verifyMd5Hash(getRedirectedUrl(req), expectedHash) && this.verifyTimestamp(queryValues.Timestamp))
                {
                    this.setCookie(res, queryValues.QueueId, originalUrl, queryValues.PlaceInQueue, queryValues.RedirectType, timestamp);

                    return callback(null);
                }
            }
            return callback('Forbidden');
        },

        setCookie: function(res, queueId, originalUrl, placeInQueue, redirectType, timestamp) {
            var expiration = this.toISOStringWithExtraPrecision((new Date(new Date().getTime() + options.cookieExpiration)));

            var cookie = {
                QueueId: queueId,
                OriginalUrl: originalUrl,
                PlaceInQueue: placeInQueue,
                RedirectType: redirectType,
                Timestamp: timestamp,
                Hash: this.generateHashForCookie(queueId, originalUrl, placeInQueue, redirectType, timestamp, expiration),
                Expiration: expiration
            };
            res.cookie(cookieName, this.serializeCookie(cookie), { maxAge: options.cookieExpiration, httpOnly: true, domain: options.cookieDomain, signed: false, encode: String });
        },

        toISOStringWithExtraPrecision: function(date) {
            var isoString = date.toISOString();
            return isoString.replace(/Z$/, "0000Z");
        },

        generateHashForCookie: function (queueId, originalUrl, placeInQueue, redirectType, timestamp, expires) {
            var valueToHash = queueId + originalUrl + this.decryptPlaceInQueue(placeInQueue) + redirectType + timestamp + expires + options.defaultKnownUserSecretKey;

            var insertDashes = function (input) {
                var output = "";
                for (var i = 0; i < input.length; i++)
                {
                    output += input.substr(i, 2);
                    i++;
                    if (i+2 > input.length) {
                        break;
                    }
                    output += "-";
                }
                return output;
            }

            return insertDashes(crypto.createHash('sha256').update(valueToHash).digest('hex').toUpperCase());
        },

        decryptPlaceInQueue: function(e) {
            return parseInt(e.substr(30, 1) + e.substr(3, 1) + e.substr(11, 1) + e.substr(20, 1) + e.substr(7, 1) + e.substr(26, 1) + e.substr(9, 1));
        },

        serializeCookie: function(cookie) {
            var values = [
                this.createKeyValuePair("QueueId", cookie.QueueId),
                this.createKeyValuePair("OriginalUrl", encodeURIComponent(cookie.OriginalUrl)),
                this.createKeyValuePair("PlaceInQueue", cookie.PlaceInQueue),
                this.createKeyValuePair("RedirectType", cookie.RedirectType),
                this.createKeyValuePair("TimeStamp", cookie.Timestamp),
                this.createKeyValuePair("Hash", cookie.Hash),
                this.createKeyValuePair("Expires", cookie.Expiration)
            ];
            return values.join("&");
        },

        createKeyValuePair: function(key, value) {
            return key + "=" + value;
        },

        deserializeCookie: function(cookie) {
            var values = cookie.split("&");
            var obj = {};
            for (var i = 0; i < values.length; i++)
            {
                var split = values[i].split("=");
                var key = split[0];
                var value = split[1];
                obj[key] = value;
            }

            return {
                QueueId: obj["QueueId"],
                OriginalUrl: decodeURIComponent(obj["OriginalUrl"]),
                PlaceInQueue: obj["PlaceInQueue"],
                RedirectType: obj["RedirectType"],
                Timestamp: obj["TimeStamp"],
                Hash: obj["Hash"],
                Expiration: obj["Expires"]
            };
        },

        verifyMd5Hash: function (redirectedUrl, expectedHash) {
            var expectedUrl = redirectedUrl.replace(expectedHash, options.defaultKnownUserSecretKey);

            var calculatedHash = crypto.createHash('md5').update(expectedUrl).digest('hex');
            return calculatedHash == expectedHash;
        },

        verifyTimestamp: function(timestamp) {
            var currentTimestamp = Math.floor(new Date() / 1000);
            var expire = 4*60; // The link expires after 4 minutes
            return timestamp + expire > currentTimestamp;
        },

        getQueueUrl: function(req, res, target) {
            var targetUrl = req.protocol + '://' + req.get('host') + target;
            var query = querystring.stringify({
                c: options.customerId,
                e: options.eventId,
                t: targetUrl,
                ver: "n" + version});
            return "http://" + options.customerId + defaultDomain + "/?" + query;
        }
    }
};