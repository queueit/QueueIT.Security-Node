var querystring = require('querystring');
var crypto = require('crypto');

module.exports = function(options)
{
    return {
        validate: function (req, callback) {
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
                    return callback(null);
                }
            }
            return callback('Forbidden');
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
            var query = querystring.stringify({c: options.customerId, e: options.eventId, t: targetUrl});
            return options.queueDomain + "?" + query;
        }
    }
};