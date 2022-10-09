# AWS Simple Queue Service (SQS) Hands On Lab

## Introduction

In this example, we will be exploring AWS SQS through the AWS Console along with a series of Node.js modules to work with a standard SQS queue.

1. Creating a standard SQS queue | 10 mins
2. Sending message to queue | 10 mins
3. Receiving message and deleteing message from queue | 5 mins
4. Using Dead-letter Queues (DLQ) | 15 mins
5. Receive messages using long polling consumers | 10 mins (optional)

This lab is based on the examples provided in the [AWS Developer Guide for Amazon SQS](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/sqs-examples.html).

### Before we begin

**Set-up an AWS account**

**[Using Cloud9 with the AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/cloud9-javascript.html)**

- Cloud9 - A cloud IDE for writing, running, and debugging code
- Create a development environment (recommend that you choose the option to Create a new instance for environment (EC2))
- In the environment, install the AWS SDK for JavaScript using `npm install aws-sdk`


---

## 1. Create a SQS queue

**Using the [Amazon SQS on AWS Console](https://ap-southeast-1.console.aws.amazon.com/sqs/v2/home?region=ap-southeast-1#/)**

- SQS > Create Queue > Type: Standard
- Define Access Policy, who can access your queue.

Reference

- [Creating an Amazon SQS queue (console)](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-configure-create-queue.html)
- [High throughput for FIFO queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/high-throughput-fifo.html)

## 2. Sending message to queue

**In your AWS Cloud9 environment,** create a Node.js module to call the `sendMessage` method. The callback returns the unique ID of the message.

``` javascript
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

``` javascript
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

### Background

"Dead Letter Queue – An SQS queue that will receive the messages which were not successfully processed after maximum number of receives by consumers."

"Because Amazon SQS is a distributed system, there's no guarantee that the consumer actually receives the message (for example, due to a connectivity issue, or due to an issue in the consumer application). Thus, the consumer must delete the message from the queue after receiving and processing it."

Dead letter queues could be used to isolate messages that can't be processed for later analysis.

### Let's do it

In this section,

- we will mimic message that has gone unprocessed (on the consumer side), and after its maximum receives, allow it to redrive from the source queue to the dead-letter queue.

**Create a SQS queue to be used as the dead-letter queue**

- This queue should match the source queue's type
- Best practice,
  - Enable "Redrive allow policy" to define which source queues can use this queue as the dead-letter queue.

**Re-configure the source queue to redrive unprocessed message to the newly created DLQ queue**

- SQS > Queue > Edit > Enable "Dead-letter queues" > Specify DLQ name and the maximum recieves

**Create a new Node.js module to intentionally recieve message without deleting the message afterward**

- Expected result,
  - Message recieved by this Node.js module wouldn't be deleted and will be placed back to the queue after the visibility timeout duration,
  - When the approximate recieve count of the message is more than the maximum recieves, the message will be redrive to the dead-letter queue.
- Based on the existing `recieveMessage` module from the previous section,
  - Remove or comment out the call to the `deleteMessage` method (indicating message has been successfully processed by the consumer)
  - Speed up the process by recieving message with surprisingly small visibility timeout
    - When receiving messages, you can also set a special visibility timeout, `VisibilityTimeout` parameter (seconds), for the returned messages without changing the overall queue timeout.
  - Log the message handle and approximate recieve count
    - The approximate recieve count is obtained by adding `ApproximateReceiveCount` to the list of `AttributeNames` in the request parameters object of recieve message API.
    - For an instance, `console.log("Pass", receiptHandle, approximateReceiveCount)`

**Ensure a test message is available in the source queue**

- If not, send a test message (section #2)

**Run the Node.js module and check the message count in DLQ**

- Run the module by the number of 'maximum recieves' times (per message),
- In each execution, the console should log a unique message handle with its current approximate recieve count,
- Once no message is returned (or when message's approximate recieve count > maximum recieves), all of the message should now be in the DLQ,
  - Check the messages count in the DLQ queue
    - AWS Console > SQS > The DLQ Queue > Details section > More > Messages available

<details>

<summary><b>See Spoilers</b></summary>

**In this example,**

- The `VisibilityTimeout` is explicitly set to `2` (seconds) - After being recieved, the message will stay hidden from other consumers for 2 seconds before being visible again.
  - For optimal performance, set the visibility timeout to be larger than the AWS SDK read timeout.
- Call to `deleteMessage` method was removed - Each message is expected to be deleted after being processed successfully.
- Attribute `ApproximateReceiveCount` was added to the parameter as one of the attribute name.
- Logging was added to see the message handle and its approximate recieve count.

```javascript
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

## 5. Receive messages using long polling consumers

### Background

Amazon SQS provides short polling and long polling to receive messages from a queue. By default, queues use short polling.

When the wait time for the ReceiveMessage API action is greater than 0, long polling is in effect. The maximum long polling wait time, `WaitTimeSeconds`, is 20 seconds.

- Long polling helps reduce the cost of using Amazon SQS by eliminating the number of empty responses (when there are no messages available for a ReceiveMessage request) and false empty responses (when messages are available but aren't included in a response).
- Reduce false empty responses by querying all—rather than a subset of—Amazon SQS servers.
- Return messages as soon as they become available.

### Let's do it

In this example,

- the Node.js module will be modified to **use long-polling** in order to reduce empty responses by allowing Amazon SQS to wait until the messages are available in a queue before sending a response.
- **The recieved messages are then deleted** in batch by calling the `deleteMessageBatch` method.

Notes:

- For recieveMessage API, `WaitTimeSeconds` should be more than `0` seconds to use long polling,
- The maximum number of message, `MaxNumberOfMessages`, to be recieved per request could range from `1` to `10`.

<details>

<summary><b>See Spoilers</b></summary>

``` javascript
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
        for (msg of data.Messages){
          console.log(msg.Body)
          // process msgs
        }


        //once complete delete the msg from q
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

</details>

<hr />

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

--- 

## Step 1: Create a topic
1. Goto the **Amazon SNS** console.
2. On the Topics page, choose Create topic.
3. By default, the console creates a FIFO topic. Choose **Standard**.
4. In the Details section, enter a Name for the topic, such as **MyTopic**.
5. Scroll to the end of the form and choose Create topic.

## Step 2: Create a subscription to the topic
1. In the left navigation pane, choose Subscriptions.
2. On the Subscriptions page, choose Create subscription.
3. On the Create subscription page, choose the Topic ARN field to see a list of the topics in your AWS account.
4. Choose the topic that you created in the previous step.
5. For Protocol, choose Email.
6. For Endpoint, enter an email address that can receive notifications.
7. Choose Create subscription.
8. The console opens the new subscription's Details page.
9. Check your email inbox and choose Confirm subscription in the email from AWS Notifications. The sender ID is usually "no-reply@sns.amazonaws.com".
10. Amazon SNS opens your web browser and displays a subscription confirmation with your subscription ID.

## Step 3: Publish a message to the topic
1. In the left navigation pane, choose Topics.
2. On the Topics page, choose the topic that you created earlier, and then choose Publish message.
3. The console opens the Publish message to topic page.
4. (Optional) In the Message details section, enter a Subject, such as:

``` Hello from Amazon SNS!```

5. In the **Message body** section, choose Identical payload for all delivery protocols, and then enter a message body, such as:

```Publishing a message to an SNS topic.```

6. Choose **Publish message**.
7. The message is published to the topic, and the console opens the topic's Details page.
8. Check your email inbox and verify that you received an email from Amazon SNS with the published message.

## Step 4: Send Message with Node JS SDK

Pass the parameters to the publish method of the AWS.SNS client class. Create a promise for invoking an Amazon SNS service object, passing the parameters object. Then handle the response in the promise callback

``` javascript
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set region
AWS.config.update({region: 'REGION'});

// Create publish parameters
var params = {
  Message: 'MESSAGE_TEXT', /* required */
  TopicArn: 'TOPIC_ARN'
};

// Create promise and SNS service object
var publishTextPromise = new AWS.SNS({apiVersion: '2010-03-31'}).publish(params).promise();

// Handle promise's fulfilled/rejected states
publishTextPromise.then(
  function(data) {
    console.log(`Message ${params.Message} sent to the topic ${params.TopicArn}`);
    console.log("MessageID is " + data.MessageId);
  }).catch(
    function(err) {
    console.error(err, err.stack);
  });
```

## Step 5: Subscribe SQS to a topic

1. In the left navigation pane, choose Subscriptions.
2. On the Subscriptions page, choose Create subscription.
3. On the Create subscription page, choose the Topic ARN field to see a list of the topics in your AWS account.
4. Choose the topic that you created in the previous step.
5. For Protocol, choose **Amazon SQS**.
6. For Endpoint, enter an SQS arn from SQS Lab
7. Choose Create subscription.
8. Go to Topic page copy **Topic ARN** (example ``arn:aws:sns:ap-southeast-1:accid:MyTopic``)

## Step 6 : Give permission to the Amazon SNS topic to send messages to the Amazon SQS queue

1. Go to **Amazon SQS** console page
2. Select the same queue as in step 4
3. In the **Access policy** section, define who can access your queue.
    * Add a condition that allows the action for the topic.
    * Set Principal to be the Amazon SNS service, as shown in the example below.
    * Add this statement to the exsisting policy

```json
{
  "Sid": "AllowMsgFromTopic",
  "Effect": "Allow",
  "Principal": {
      "Service": "sns.amazonaws.com"
  },
  "Action": "sqs:SendMessage",
  "Resource": "arn:aws:sqs:ap-southeast-1:accid:MyQueue",
  "Condition": {
    "ArnEquals": {
        "aws:SourceArn": "arn:aws:sns:ap-southeast-1:accid:MyNotification"
    }
  }
}
```

Example Policy once added new statement
```json
{
    "Version": "2008-10-17",
    "Id": "__default_policy_ID",
    "Statement": [{
        "Sid": "__owner_statement",
        "Effect": "Allow",
        "Principal": {
            "AWS": "arn:aws:iam::accid:root"
        },
        "Action": "SQS:*",
        "Resource": "arn:aws:sqs:ap-southeast-1:accid:MyQueue"
    },
    {
      "Sid": "AllowMsgFromTopic",
      "Effect": "Allow",
      "Principal": {
          "Service": "sns.amazonaws.com"
      },
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:ap-southeast-1:accid:MyQueue",
      "Condition": {
        "ArnEquals": {
            "aws:SourceArn": "arn:aws:sns:ap-southeast-1:accid:MyTopic"
        }
      }
  }]
}
```
4. Push new message to the topic (Step 3: Publish a message to the topic)
5. Check message inside the queue you subscibed.

## Additional Resources

[Amazon SNS Pricing](https://aws.amazon.com/sns/pricing/)

[Publishing Messages in Amazon SNS](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/sns-examples-publishing-messages.html)

[Code examples for Amazon SNS](https://docs.aws.amazon.com/sns/latest/dg/service_code_examples.html)

[Subscribing an Amazon SQS queue to an Amazon SNS topic](https://docs.aws.amazon.com/sns/latest/dg/subscribe-sqs-queue-to-sns-topic.html)