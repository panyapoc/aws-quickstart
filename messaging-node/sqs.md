# AWS Simple Queue Service (SQS) Hands On Lab

## Introduction

In this example, we will be exploring AWS SQS through the AWS Console along with a series of Node.js modules to work with a standard SQS queue.

1. Creating a standard SQS queue | 10 mins
2. Sending message to queue | 10 mins
3. Receiving message and deleteing message from queue | 5 mins
4. Using Dead-letter Queues (DLQ) | 15 mins
5. Recieve message using long polling consumers | 10 mins (optional)

This lab is based on the examples provided in the [AWS Developer Guide for Amazon SQS](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/sqs-examples.html).

### Before we begin

**Set-up an AWS account**

**[Using Cloud9 with the AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/cloud9-javascript.html)**

- Cloud9 - A cloud IDE for writing, running, and debugging code
- Create a development environment (recommend that you choose the option to Create a new instance for environment (EC2))
- In the environment, install the AWS SDK for JavaScript using `npm install aws-sdk`

## 1. Create a SQS queue

**Using the [Amazon SQS on AWS Console](https://ap-southeast-1.console.aws.amazon.com/sqs/v2/home?region=ap-southeast-1#/)**

- SQS > Create Queue > Type: Standard
- Define Access Policy, who can access your queue.

Reference

- [Creating an Amazon SQS queue (console)](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-configure-create-queue.html)
- [High throughput for FIFO queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/high-throughput-fifo.html)

## 2. Sending message to queue

**In your AWS Cloud9 environment,** create a Node.js module to call the `sendMessage` method. The callback returns the unique ID of the message.

```node
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region 
AWS.config.update({region: 'REGION'});

// Create an SQS service object
var sqs = new AWS.SQS({apiVersion: '2012-11-05'});

var params = {
   // Remove DelaySeconds parameter and value for FIFO queues
  DelaySeconds: 10,
  MessageAttributes: {
    "Title": {
      DataType: "String",
      StringValue: "The Whistler"
    },
    "Author": {
      DataType: "String",
      StringValue: "John Grisham"
    },
    "WeeksOn": {
      DataType: "Number",
      StringValue: "6"
    }
  },
  MessageBody: "Information about current NY Times fiction bestseller for week of 12/11/2016.",
  // MessageDeduplicationId: "TheWhistler",  // Required for FIFO queues
  // MessageGroupId: "Group1",  // Required for FIFO queues
  QueueUrl: "SQS_QUEUE_URL"
};

sqs.sendMessage(params, function(err, data) {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Success", data.MessageId);
  }
});
```

**Update the following values in the code**: `REGION` and `SQS_QUEUE_URL`

**Send a message to the queue** by running your module: `node sqs_sendmessage.js`

Reference

- [SQS Quotas and Throughput](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html)

## 3. Receiving and deleting message from queue

Call the `receiveMessage` method to recieve only a maximum of `1` message from the queue by specifying an integer for request parameter `MaxNumberOfMessages`. The callback returns an array of Message objects from which you can retrieve `ReceiptHandle` for each message that you use to later delete that message.

Create another JSON object containing the parameters needed to delete the message, which are the URL of the queue and the `ReceiptHandle` value. Call the `deleteMessage` method to delete the message you received.

```node
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'REGION'});

// Create an SQS service object
var sqs = new AWS.SQS({apiVersion: '2012-11-05'});

var queueURL = "SQS_QUEUE_URL";

var params = {
 AttributeNames: [
    "SentTimestamp"
 ],
 MaxNumberOfMessages: MAX_MESSAGE_COUNT,
 MessageAttributeNames: [
    "All"
 ],
 QueueUrl: queueURL,
 VisibilityTimeout: 20,
 WaitTimeSeconds: 0
};

sqs.receiveMessage(params, function(err, data) {
  if (err) {
    console.log("Receive Error", err);
  } else if (data.Messages) {
    console.log('Message Recieved', data.Messages)
    var deleteParams = {
      QueueUrl: queueURL,
      ReceiptHandle: data.Messages[0].ReceiptHandle
    };
    sqs.deleteMessage(deleteParams, function(err, data) {
      if (err) {
        console.log("Delete Error", err);
      } else {
        console.log("Message Deleted", data);
      }
    });
  }
});
```

In this example, the parameters `MessageAttributeNames` specify receipt of all message attributes, as well as receipt of no more than 1 messages - `MaxNumberOfMessages` (max: `10` messages).

Additional resources

- [Create a Node.js module used to manage visibility timeout](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/sqs-examples-managing-visibility-timeout.html)

Reference

- [SQS Basic Architecture and Visibility Timeout on Recieves](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-basic-architecture.html)
- [AWS SDK for JavaScript - AWS.SQS recieveMessage](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#receiveMessage-property)

## 4. Using Dead-letter Queues (DLQ)

"Dead Letter Queue – An SQS queue that will receive the messages which were not successfully processed after maximum number of receives by consumers."

"Because Amazon SQS is a distributed system, there's no guarantee that the consumer actually receives the message (for example, due to a connectivity issue, or due to an issue in the consumer application). Thus, the consumer must delete the message from the queue after receiving and processing it."

In this section, we will mimic message that has gone unprocessed (on the consumer side), and after its maximum recieves, allow it to redrive from the source queue to the dead-letter queue. Dead letter queues could be used to isolate messages that can't be processed for later analysis.

- **Create a SQS queue to be used as the dead-letter queue**
  - This queue should match the source queue's type
  - Recommended best practice, Enable "Redrive allow policy" to define which source queues can use this queue as the dead-letter queue.
    - SQS > The SQS Queue > Edit > Enable "Redrive allow policy" > "Redrive permission" By queue
- **Re-configure the source queue to redrive unprocessed message to the newly created DLQ queue**
  - SQS > "The Source Queue > Edit > Enable "Dead-letter queues" > Specify DLQ name and the maximum recieves
- **Create a new Node.js module to intentionally recieve message without deleting the message afterward**
  - Expected result,
    - Messages recieved by this Node.js module without being deleted for the number of maximum recieves will be redrive to the dead-letter queue.
    - The duration in which the message will redrive to DLQ would be approximately `visibility timeout duration * number of maximum recieves` seconds.
  - Based on the existing `recieveMessage` module from the previous section,
    - Call `recieveMessage` method to retrieve messages from queue,
    - Remove call to the `deleteMessage` method which is required in indicating message has been processed by the consumer,
    - To speed up the process by recieving message with surprisingly small `VisibilityTimeout` (seconds)
      - When receiving messages, you can also set a special visibility timeout for the returned messages without changing the overall queue timeout.
    - Simply log the message handle ID and approximate recieve count
      - The approximate recieve count is obtained by adding `ApproximateReceiveCount` to the list of `AttributeNames` in the request parameter of recieve message.
        - `var approximateReceiveCount = data.Messages[0].Attributes.ApproximateReceiveCount`
- **Ensure a test message is available the source queue**
  - If not, send a test message (section #2)
- **Run the Node.js module and check the message count in DLQ**
  - Run the module through the number of 'maximum recieves' per message,
  - In each execution, the console should log a message handle ID with its current approximate recieve count,
  - Once no message is returned (when message's approximate recieve count > maximum recieves), check the messages count in DLQ queue,
    - On AWS Console : SQS > The DLQ Queue > Details section,> More > Messages available

<details>
<summary><b>See Spoilers</b></summary>

In this example,

- Explicitly set the `VisibilityTimeout` to 2 (second)
  - For optimal performance, set the visibility timeout to be larger than the AWS SDK read timeout.
- Remove call to `deleteMessage` method.
- For logging, add attribute `ApproximateReceiveCount` to the request parameter's attribute name.

```node
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'REGION'});

// Create an SQS service object
var sqs = new AWS.SQS({apiVersion: '2012-11-05'});

var queueURL = "SQS_QUEUE_URL";

var params = {
 AttributeNames: [
    "SentTimestamp",
    "ApproximateReceiveCount"
 ],
 MaxNumberOfMessages: 1,
 MessageAttributeNames: [
    "All"
 ],
 QueueUrl: queueURL,
 VisibilityTimeout: 2,
 WaitTimeSeconds: 0
};

sqs.receiveMessage(params, function(err, data) {
  if (err) {
    console.log("Receive Error", err);
  } else if (data.Messages) {
    // pass
    var receiptHandle = data.Messages[0].ReceiptHandle
    var approximateReceiveCount = data.Messages[0].Attributes.ApproximateReceiveCount
    console.log("Pass", receiptHandle, approximateReceiveCount)
  }
});

```

</details>

<hr />

Reference

- [Amazon SQS visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html)
- [Developer Guide on Amazon SQS Dead-letter Queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html)

## 5. Recieve message using long polling consumers

Amazon SQS provides short polling and long polling to receive messages from a queue. By default, queues use short polling.

When the wait time for the ReceiveMessage API action is greater than 0, long polling is in effect. The maximum long polling wait time, `WaitTimeSeconds`, is 20 seconds.

- Long polling helps reduce the cost of using Amazon SQS by eliminating the number of empty responses (when there are no messages available for a ReceiveMessage request) and false empty responses (when messages are available but aren't included in a response).
- Reduce false empty responses by querying all—rather than a subset of—Amazon SQS servers.
- Return messages as soon as they become available.

In this example, the Node.js module use long-polling to wait until the messages is available in a queue before sending a response. The recieved messages are then deleted in batch by calling the `deleteMessageBatch` method. 

```node
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
```

**Using long polling**
The `ReceiveMessage` call sets `WaitTimeSeconds` not equal to `0` or queue attribute `ReceiveMessageWaitTimeSeconds` is not set to `0`.

Reference

- [Amazon SQS short and long polling](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-short-and-long-polling.html)
- [deleteMessageBatch operation](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#deleteMessageBatch-property)
- [Using JavaScript Promises with AWS.Request.promise](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/using-promises.html)
- [Using async/await](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/using-async-await.html)

## Additional Resources

[Amazon SQS Pricing](https://aws.amazon.com/sqs/pricing/)

[Amazon SQS Pricing Calculator](https://calculator.aws/#/createCalculator/SQS)

[Best practices for Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-best-practices.html)

[Amazon SQS batch actions](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-batch-api-actions.html) - Reduce costs or manipulate up to 10 messages with a single action