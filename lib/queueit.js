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
    var queueItToken = getQueryValue(req, options, "queueittoken");
    if (queueItToken)
    {
        var keyValueSeparatorChar = '_';
        var keyValueSeparatorGroupChar = '~';
        var groups = queueItToken.split(keyValueSeparatorGroupChar);
        var timestamp = "";
        var cookieValidityMinute = "";
        var extendableCookie = "";
        var hash = "";
        var eventId = "";
        var queueId = "";
        for (var i = 0; i < groups.length; i++)
        {
            var keyValueArr = groups[i].split(keyValueSeparatorChar);
            switch (keyValueArr[0])
            {
                case "ts":
                    timestamp = keyValueArr[1];
                    break;
                case "cv":
                    cookieValidityMinute = keyValueArr[1];
                    break;
                case "ce":
                    extendableCookie = keyValueArr[1];
                    break;
                case "h":
                    hash = keyValueArr[1];
                    break;
                case "e":
                    eventId = keyValueArr[1];
                    break;
                case "q":
                    queueId = keyValueArr[1];
                    break;
            }
        }
        var queueItTokenWithoutHash = queueItToken.replace("~h_" + hash, "");
        return {
            Type: "V3",
            QueueId: queueId,
            Timestamp: timestamp,
            EventId: eventId,
            Hash: hash,
            CookieValidityMinute: cookieValidityMinute,
            ExtendableCookie: extendableCookie,
            QueueItTokenWithoutHash: queueItTokenWithoutHash
        };

    }
    return {
        Type: "V2",
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
    var version = "1.0.6";
    var defaultDomain = ".queue-it.net";
    var cookieNamePrefix = "QueueITAccepted-SDFrts345E-";

    options.getCookie = opt(options, "getCookie", getCookie);
    options.queryStringPrefix = opt(options, "queryStringPrefix", "");
    options.cookieExpiration = opt(options, "cookieExpiration", 1200000);
    options.extendValidity = opt(options, "extendValidity", true);
    var cookieName = cookieNamePrefix + options.customerId + "-" + options.eventId;
    var cookieNameV3 = cookieNamePrefix + "_" + options.eventId;

    function opt(options, name, defaultValue) {
        return options && options[name]!==undefined ? options[name] : defaultValue;
    }

    return {
        validate: function (req, res, callback) {

            if (options.getCookie(req, cookieName))
            {
                var cookie = this.deserializeCookie(options.getCookie(req, cookieName));

                if (new Date().getTime() < Date.parse(cookie.Expiration))
                {
                    var hashForCookie = this.generateHashForCookie(cookie.QueueId, cookie.OriginalUrl, cookie.PlaceInQueue, cookie.RedirectType, cookie.Timestamp, cookie.Expiration);
                    if (hashForCookie == cookie.Hash)
                    {
                        if (options.extendValidity && cookie.RedirectType != "Idle")
                        {
                            this.setCookie(res, cookie.QueueId, cookie.OriginalUrl, cookie.PlaceInQueue, cookie.RedirectType, cookie.Timestamp);
                        }
                        return callback(null);
                    }
                }
            }

            if (options.getCookie(req, cookieNameV3))
            {
                var cookieV3 = this.deserializeCookieV3(options.getCookie(req, cookieNameV3));

                if (new Date().getTime() < Date.parse(cookieV3.Expires))
                {
                    var hashForCookieV3 = this.generateHashForCookieV3(cookieV3.QueueId, cookieV3.IsCookieExtendable, cookieV3.Expires, options.defaultKnownUserSecretKey)
                    if (hashForCookieV3 == cookieV3.Hash)
                    {
                        if (options.extendValidity)
                        {
                            this.setCookieV3(res, cookieV3.QueueId, options.eventId, 0, cookieV3.IsCookieExtendable, cookieV3.Expires);
                        }
                        return callback(null);
                    }
                }
            }

            var queryValues = getAllQueryValues(req, options);

            if (queryValues.Type == "V2" &&
                (queryValues.QueueId &&
                queryValues.PlaceInQueue &&
                queryValues.Timestamp &&
                queryValues.Hash &&
                queryValues.QueueId.length > 0 &&
                queryValues.PlaceInQueue.length > 0 &&
                queryValues.Timestamp.length > 0 &&
                queryValues.Hash.length > 0 &&
                !isNaN(queryValues.Timestamp)))
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

            if (queryValues.Type == "V3" &&
                (queryValues.QueueId &&
                queryValues.Hash &&
                queryValues.Timestamp))
            {
                var originalUrl = getOriginalUrl(req, options);
                var expectedHash = queryValues.Hash;
                var timestamp = queryValues.Timestamp;
                if (this.verifyHashV3(queryValues.QueueItTokenWithoutHash, expectedHash) && this.verifyTimestamp(queryValues.Timestamp))
                {
                    this.setCookieV3(res, queryValues.QueueId, queryValues.EventId, queryValues.CookieValidityMinute, queryValues.ExtendableCookie);

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

        setCookieV3: function(res, queueId, eventId, cookieValidityMinute, isCookieExtendable) {
            if (!cookieValidityMinute)
            {
                cookieValidityMinute = options.cookieExpiration / 60000;
            }
            var expiration = this.toISOStringWithExtraPrecision((new Date(new Date().getTime() + (cookieValidityMinute * 60000))));

            var cookie = {
                IsCookieExtendable: isCookieExtendable,
                Hash: this.generateHashForCookieV3(queueId, isCookieExtendable, expiration, options.defaultKnownUserSecretKey),
                Expires: expiration,
                QueueId: queueId,
            };
            var cookieNameV3 = cookieNamePrefix + "_" + eventId;
            res.cookie(cookieNameV3, this.serializeCookieV3(cookie), { maxAge: options.cookieExpiration, httpOnly: true, domain: options.cookieDomain, signed: false, encode: String });
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

        generateHashForCookieV3: function (queueId, isCookieExtendable, expiration, secretKey) {
            var valueToHash = queueId + isCookieExtendable + expiration + secretKey;

            return crypto.createHmac('sha256', secretKey).update(valueToHash).digest('hex');
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

        serializeCookieV3: function(cookie) {
            var values = [
                this.createKeyValuePair("IsCookieExtendable", cookie.IsCookieExtendable),
                this.createKeyValuePair("Hash", cookie.Hash),
                this.createKeyValuePair("Expires", cookie.Expires),
                this.createKeyValuePair("QueueId", cookie.QueueId)
            ];
            return values.join("&");
        },

        createKeyValuePair: function(key, value) {
            return key + "=" + value;
        },

        getCookieValues: function(cookie) {
            var values = cookie.split("&");
            var obj = {};
            for (var i = 0; i < values.length; i++)
            {
                var split = values[i].split("=");
                var key = split[0];
                var value = split[1];
                obj[key] = value;
            }
            return obj;
        },

        deserializeCookie: function(cookie) {
            var obj = this.getCookieValues(cookie);

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

        deserializeCookieV3: function(cookie) {
            var obj = this.getCookieValues(cookie);

            return {
                IsCookieExtendable: obj["IsCookieExtendable"],
                Hash: obj["Hash"],
                QueueId: obj["QueueId"],
                Expires: obj["Expires"]
            };
        },

        verifyMd5Hash: function (redirectedUrl, expectedHash) {
            var expectedUrl = redirectedUrl.replace(expectedHash, options.defaultKnownUserSecretKey);

            var calculatedHash = crypto.createHash('md5').update(expectedUrl).digest('hex');
            return calculatedHash == expectedHash;
        },

        verifyHashV3: function (queueItTokenWithoutHash, expectedHash) {
            var calculatedHash = crypto.createHmac('sha256', options.defaultKnownUserSecretKey).update(queueItTokenWithoutHash).digest('hex');

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