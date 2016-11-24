'use strict';
var querystring = require('querystring');
var crypto = require('crypto');

var getCookie = function(req, cookieName) {
    return req.cookies[cookieName];
};

module.exports = function(options)
{
    var version = "1.0.5";
    var defaultDomain = ".queue-it.net";
    var cookieNamePrefix = "QueueITAccepted-SDFrts345E-";
    options.getCookie = options.getCookie || getCookie;

    return {
        validate: function (req, res, callback) {
            var cookieName = cookieNamePrefix + options.customerId + "-" + options.eventId;

            if (options.getCookie(req, cookieName))
            {
                var cookie = this.deserializeCookie(options.getCookie(req, cookieName));

                if (new Date().getTime() < new Date(Date.parse(cookie.Expiration)).getTime())
                {
                    var hashForCookie = this.generateHashForCookie(cookie.QueueId, cookie.OriginalUrl, cookie.PlaceInQueue, cookie.RedirectType, cookie.Timestamp, cookie.Expiration);
                    if (hashForCookie == cookie.Hash)
                    {
                        return callback(null);
                    }
                }
            }
            if (req.query.q && 
                req.query.p && 
                req.query.ts &&
                req.query.h &&
                req.query.q.length > 0 &&
                req.query.p.length > 0 && 
                req.query.ts.length > 0 &&
                req.query.h.length > 0 &&
                !isNaN(req.query.ts))
            {
                var originalUrl = this.getOriginalUrl(req);
                var expectedHash = req.query.h;
                var timestamp = req.query.ts;
                if (this.verifyMd5Hash(this.getRedirectedUrl(req), expectedHash) && this.verifyTimestamp(req.query.ts))
                {
                    var expireTime = 1200000;
                    var expiration = this.toISOStringWithExtraPrecision((new Date(new Date().getTime() + expireTime)));
                    var cookie = {
                        QueueId: req.query.q,
                        OriginalUrl: originalUrl,
                        PlaceInQueue: req.query.p,
                        RedirectType: req.query.rt,
                        Timestamp: req.query.ts,
                        Hash: this.generateHashForCookie(req.query.q, originalUrl, req.query.p, req.query.rt, timestamp, expiration),
                        Expiration: expiration
                    };
                    res.cookie(cookieName, this.serializeCookie(cookie), { maxAge: expireTime, httpOnly: true, domain: options.cookieDomain, signed: false, encode: String });

                    return callback(null);
                }
            }
            return callback('Forbidden');
        },

        getOriginalUrl: function(req) {
            var url = this.getRedirectedUrl(req);
            url = url.replace(/([\?&])(q=[^&]*)/i, "");
            url = url.replace(/([\?&])(ts=[^&]*)/i, "");
            url = url.replace(/([\?&])(c=[^&]*)/i, "");
            url = url.replace(/([\?&])(e=[^&]*)/i, "");
            url = url.replace(/([\?&])(rt=[^&]*)/i, "");
            url = url.replace(/([\?&])(h=[^&]*)/i, "");
            url = url.replace(/([\?&])(p=[^&]*)/i, "");
            url = url.replace(/[\?&]$/, "");
            return url;
        },

        toISOStringWithExtraPrecision: function(date) {
            var isoString = date.toISOString();
            return isoString.replace(/Z$/, "0000Z");
        },

        getRedirectedUrl: function(req) {
            return req.protocol + '://' + req.get('host') + req.originalUrl;
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