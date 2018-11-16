Please note this repository is deprecated. Replacement is found [here](https://github.com/queueit/KnownUser.V3.Javascript).
-

# QueueIT.Security-Node

Queue-it KnownUser integration in Node.js

In order to use the code, please follow below steps:

1. Copy `lib/queueit.js` into your own source tree
2. Look in `index.js` for an example on how to use in your own application

## Requirements

### Compatibility

See `package.json` for which versions of `express` and `cookie-parser` the library has been tested with.

### Cookie middleware

You need to install cookie middleware in order for the library to work. The example uses [`cookie-parser`](https://www.npmjs.com/package/cookie-parser).

If you are using different cookie middleware, you might want to override the method to get a cookie. 
By default the library assumes cookies are stored as properties in the `req.cookies` object.
Other middleware, such as [`cookies`](https://www.npmjs.com/package/cookies), use `req.cookies.get`.
In this scenario you need to set the following property on the options:

    var options = {
        // Other values
        getCookie: function(req, cookieName) { return req.cookies.get(cookieName); }
    };
    var queue = queueit(options);
