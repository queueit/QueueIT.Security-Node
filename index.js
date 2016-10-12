var express = require('express');
var cons = require('consolidate');
var queueit = require('./lib/queueit.js');

var options = {
  customerId: "ticketania", // Customer id
  eventId: "link", // Event id
  queueDomain: "http://ticketania.queue-it.net/", // Queue url from GO platform
  defaultKnownUserSecretKey: "a774b1e2-8da7-4d51-b1a9-7647147bb13bace77210-a488-4b6f-afc9-8ba94551a7d7" // Secret key from queue-it account
};
var queue = queueit(options);

var app = express();
app.engine('html', cons.mustache);
app.set('view engine', 'html');

// This is the page in which you redirect the user to the queue
app.get('/', function (req, res)
{
  var queueUrl = queue.getQueueUrl(req, res, '/link/target');
  return res.render('link', {
    queueUrl: queueUrl,
  });
});

// This is the protected target url.
app.get('/link/target', function (req, res)
{
  queue.validate(req, function (err) {
    if (err)
    {
      return res.status(403).send('Forbidden');
    }
    return res.render('linktarget');
  })
});

app.listen(3000, function () {
  console.log('App listening on port 3000.');
});