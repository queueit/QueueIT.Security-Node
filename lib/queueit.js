var querystring = require('querystring');
var crypto = require('crypto');

module.exports = function(options)
{
    var version = "1.0.3";
    var defaultDomain = ".queue-it.net";
    var cookieNamePrefix = "QueueITAccepted-SDFrts345E-";

    return {
        validate: function (req, res, callback) {
            var cookieName = cookieNamePrefix + options.customerId + "-" + options.eventId;
          
            if (req.signedCookies[cookieName])
            {
                var cookie = req.signedCookies[cookieName];

                if (new Date().getTime() < cookie.Expiration)
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
                var redirectedUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
                var expectedHash = req.query.h;
                var timestamp = req.query.ts;
                if (this.verifyMd5Hash(redirectedUrl, expectedHash) && this.verifyTimestamp(req.query.ts))
                {
                    var expireTime = 1200000;
                    var expiration = new Date().getTime() + expireTime;
                    var cookie = {
                        QueueId: req.query.q,
                        OriginalUrl: redirectedUrl,
                        PlaceInQueue: req.query.p,
                        RedirectType: req.query.rt,
                        Timestamp: req.query.ts,
                        Hash: this.generateHashForCookie(req.query.q, redirectedUrl, req.query.p, req.query.rt, timestamp, expiration),
                        Expiration: expiration,
                    };
                    res.cookie(cookieName, cookie, { maxAge: expireTime, httpOnly: true, domain: options.cookieDomain, signed: true });

                    return callback(null);
                }
            }
            return callback('Forbidden');
        },

        generateHashForCookie: function (queueId, originalUrl, placeInQueue, redirectType, timestamp, expires) {
            var valueToHash = queueId + originalUrl + placeInQueue + redirectType + timestamp + expires + options.defaultKnownUserSecretKey;

            return crypto.createHash('md5').update(valueToHash).digest('hex');
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