
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'REGION'});

// Create an SQS service object
var sqs = new AWS.SQS({apiVersion: '2012-11-05'});

var queueURL = "SQS_QUEUE_URL";

var waitTimeSeconds = 20

var params = {
 AttributeNames: [
    "SentTimestamp",
    "ApproximateReceiveCount"
 ],
 MaxNumberOfMessages: 10,
 MessageAttributeNames: [
    "All"
 ],
 QueueUrl: queueURL,
 VisibilityTimeout: 30,
 WaitTimeSeconds: waitTimeSeconds
};

setInterval(function() {
    sqs.receiveMessage(params, function(err, data) {
      console.log('Polling')
      if (err) {
        console.log("Receive Error", err);
      } else if (data.Messages) {
        var deleteBatchParams = {
          QueueUrl: queueURL,
          Entries: data.Messages.map(item => { return { Id: item.MessageId, ReceiptHandle: item.ReceiptHandle } })
        };
        sqs.deleteMessageBatch(deleteBatchParams, function(err, data) {
          if (err) {
            console.log("Delete Error", err);
          } else {
            console.log("Message Deleted", data);
          }
        });
      }
    });
}, waitTimeSeconds*1000);