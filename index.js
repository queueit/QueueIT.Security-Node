var express = require('express');
var cookieParser = require('cookie-parser')
var cons = require('consolidate');
var queueit = require('./lib/queueit.js');

var options = {
  customerId: "{YOUR CUSTOMER ID}",
  eventId: "{YOUR EVENT ID}",
  defaultKnownUserSecretKey: "{YOUR CUSTOMER SECRET KEY}",
  cookieDomain: "localhost",
  queryStringPrefix: "", // Optional
  cookieExpiration: 1200000, // Optional. The amount of time in milliseconds the user can stay on the website before sent to the queue. The time will be extended each time validation is performed. Defaults to 20 minutes.
  extendValidity: true // Optional. If false, the time will not be extended each time validation is performed. Defaults to true.
};
var queue = queueit(options);

var app = express();
app.use(cookieParser('your secret here'));
app.engine('html', cons.mustache);
app.set('view engine', 'html');

// This is the page in which you redirect the user to the queue
app.get('/', function (req, res)
{
  return res.render('index', {
    protectedPage: '/purchase'
  });
});

// This is the protected target url.
app.get('/purchase', function (req, res)
{
  queue.validate(req, res, function (err) {
    if (err)
    {
      var queueUrl = queue.getQueueUrl(req, res, '/purchase');
      return res.redirect(queueUrl);
    }
    return res.render('purchase');
  })
});

app.listen(3000, function () {
  console.log('App listening on port 3000.');
});
