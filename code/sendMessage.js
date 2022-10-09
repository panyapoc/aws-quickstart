"use strict";

require('dotenv').config()
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
var _faker = require ('@faker-js/faker');
// Set the region 
AWS.config.update({region: 'ap-southeast-1'});

// Create an SQS service object
var sqs = new AWS.SQS({apiVersion: '2012-11-05'});
var queueURL = process.env.SQS_URL;

var waitTimeSeconds = 1

setInterval(function() {
  var msg = {
    username: _faker.faker.name.fullName(),
    email: _faker.faker.internet.email(),
  }

  console.log(msg);

  var params = {
    // Remove DelaySeconds parameter and value for FIFO queues
    DelaySeconds: 10,
    // MessageAttributes: {
    //   "Title": {
    //     DataType: "String",
    //     StringValue: "The Whistler"
    //   },
    //   "Author": {
    //     DataType: "String",
    //     StringValue: "John Grisham"
    //   },
    //   "WeeksOn": {
    //     DataType: "Number",
    //     StringValue: "6"
    //   }
    // },
    MessageBody: JSON.stringify(msg),
    // MessageDeduplicationId: "TheWhistler",  // Required for FIFO queues
    // MessageGroupId: "Group1",  // Required for FIFO queues
    QueueUrl: queueURL
  };

  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Success", data.MessageId);
    }
  });
}, waitTimeSeconds*1000);