var express = require('express');
var cookieParser = require('cookie-parser')
var cons = require('consolidate');
var queueit = require('./lib/queueit.js');

var options = {
  customerId: "ticketania", // Customer id
  eventId: "simple", // Event id
  defaultKnownUserSecretKey: "a774b1e2-8da7-4d51-b1a9-7647147bb13bace77210-a488-4b6f-afc9-8ba94551a7d7", // Secret key from queue-it account
  cookieDomain: "localhost",
  queryStringPrefix: "", // Optional
  cookieExpiration: 1200000 // Optional. The amount of time in milliseconds the user can stay on the website before sent to the queue. The time will be extended each time validation is performed. Defaults to 20 minutes.
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