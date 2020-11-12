<div align="center">
  <img width="150" height="150" src="logo.png">
</div>

[![Build Status](https://github.com/afgallo/dynowrap/workflows/ci/badge.svg?branch=main)](https://github.com/afgallo/dynowrap/actions)
[![Coverage Status](https://coveralls.io/repos/github/afgallo/dynowrap/badge.svg?branch=main)](https://coveralls.io/github/afgallo/dynowrap?branch=main)

dynowrap is a [DynamoDB][4] data wrapper for [node.js][1]. This project has been forked from
[Dynogels](https://github.com/clarkie/dynogels) with the aim to offer a more modern development approach with up-to-date dependencies and reduced API surface.

## Features
* Simplified data modeling and mapping to DynamoDB types
* Advanced chainable apis for [query](#query) and [scan](#scan) operations
* [Data validation](#data-validation)
* [Autogenerating UUIDs](#uuid)
* [Global Secondary Indexes](#global-indexes)
* [Local Secondary Indexes](#local-secondary-indexes)

## Installation

    npm install dynowrap

## Getting Started
First, you need to configure the [AWS SDK][2] with your credentials.

```js
const dynowrap = require('dynowrap');
dynowrap.AWS.config.loadFromPath('credentials.json');
```

When running on EC2 it's recommended to leverage EC2 IAM roles. If you have configured your instance to use IAM roles,
dynowrap will automatically select these credentials for use in your application,
and you do not need to manually provide credentials in any other format.

If you are running on Lambda, there's nothing else to do besides setting your region as per below:

```js
const dynowrap = require('dynowrap');
dynowrap.AWS.config.update({ region: 'REGION' }); // region must be set
```

You can also directly pass in your access key id, secret and region.
  * It's recommended not to hard-code credentials inside an application.
  Use this method only for small personal scripts or for testing purposes.

```js
const dynowrap = require('dynowrap');
dynowrap.AWS.config.update({ accessKeyId: 'AKID', secretAccessKey: 'SECRET', region: 'REGION' });
```

Currently the following region codes are available in Amazon:

|      Code      |           Name           |
| -------------- | ------------------------ |
| us-east-1       | US East (N. Virginia)
| us-east-2       | US East (Ohio)
| us-west-1       | US West (N. California)
| us-west-2       | US West (Oregon)
| ca-central-1    | Canada (Central)
| eu-north-1      | EU (Stockholm)
| eu-west-3       | EU (Paris)
| eu-west-2       | EU (London)
| eu-west-1       | EU (Ireland)
| eu-central-1    | EU (Frankfurt)
| ap-south-1      | Asia Pacific (Mumbai)
| ap-northeast-1  | Asia Pacific (Tokyo)
| ap-northeast-2  | Asia Pacific (Seoul)
| ap-northeast-3  | Asia Pacific (Osaka-Local)
| ap-southeast-1  | Asia Pacific (Singapore)
| ap-southeast-2  | Asia Pacific (Sydney)
| sa-east-1       | South America (São Paulo)
| cn-north-1      | China (Beijing)
| cn-northwest-1  | China (Ningxia)
| us-gov-east-1   | GovCloud (US-East)
| us-gov-west-1   | GovCloud (US-West)

### Define a Model
Models are defined through the toplevel define method.

```js
const Account = dynowrap.define('Account', {
  hashKey : 'email',

  // add the timestamp attributes (updatedAt, createdAt)
  timestamps : true,

  schema : {
    email   : Joi.string().email(),
    name    : Joi.string(),
    age     : Joi.number(),
    roles   : dynowrap.types.stringSet(),
    settings : {
      nickname      : Joi.string(),
      acceptedTerms : Joi.boolean().default(false)
    }
  }
});
```

Models can also be defined with hash and range keys.

```js
const BlogPost = dynowrap.define('BlogPost', {
  hashKey : 'email',
  rangeKey : 'title',
  schema : {
    email   : Joi.string().email(),
    title   : Joi.string(),
    content : Joi.binary(),
    tags   : dynowrap.types.stringSet(),
  }
});
```

You can pass through validation options to Joi like so:

```js
const BlogPost = dynowrap.define('BlogPost', {
  hashKey : 'email',
  rangeKey : 'title',
  schema : {
    email   : Joi.string().email(),
    title   : Joi.string()
  },
  validation: {
    // allow properties not defined in the schema
    allowUnknown: true
  }
});
```


### Create Tables for all defined models

```js
dynowrap.createTables((err) => {
  if (err) {
    console.log('Error creating tables: ', err);
  } else {
    console.log('Tables have been created');
  }
});
```

When creating tables you can pass specific throughput settings or stream specification for any defined models.

```js
dynowrap.createTables({
  BlogPost: { readCapacity: 5, writeCapacity: 10 },
  Account: {
    readCapacity: 20,
    writeCapacity: 4,
    streamSpecification: {
      streamEnabled: true,
      streamViewType: 'NEW_IMAGE'
    }
  }
}, (err) => {
  if (err) {
    console.log('Error creating tables: ', err);
  } else {
    console.log('Tables has been created');
  }
});
```

You can also pass operational options using the `$dynowrap` key:

* `pollingInterval`: When creating a table, dynowrap must poll the DynamoDB server to detect when table creation has completed.  This option specifies the *minimum* poll interval, in milliseconds.  (Default: 1000)

```js
dynowrap.createTables({
  $dynowrap: { pollingInterval: 100 }
}, (err) => {
  if (err) {
    console.log('Error creating tables: ', err);
  } else {
    console.log('Tables has been created');
  }
});
```

### Delete Table

```js
BlogPost.deleteTable((err) => {
  if (err) {
    console.log('Error deleting table: ', err);
  } else {
    console.log('Table has been deleted');
  }
});
```

### Get Dynamo API Parameters
You can get the raw parameters needed for the DynamoDB [CreateTable API](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_CreateTable.html):

```js
const parameters = BlogPost.dynamoCreateTableParams();
const dynamodb = new AWS.DynamoDB();
dynamodb.createTable(params, (err) => { ... });
```

### Schema Types
dynowrap provides the following schema types:

* String
* Number
* StringSet
* NumberSet
* Boolean
* Date
* UUID
* TimeUUID

#### UUID
UUIDs can be declared for any attributes, including hash and range keys. By
Default, the uuid will be automatically generated when attempting to create
the model in DynamoDB.

```js
const Tweet = dynowrap.define('Tweet', {
  hashKey : 'TweetID',
  timestamps : true,
  schema : {
    TweetID : dynowrap.types.uuid(),
    content : Joi.string(),
  }
});
```

#### Data Validation
dynowrap automatically validates the model against the schema before attempting to save it, but you can also call the `validate` method to validate an object before saving it. This can be helpful for a handler to validate input.

```js
const Tweet = dynowrap.define('Tweet', {
  hashKey : 'TweetID',
  timestamps : true,
  schema : {
    TweetID : dynowrap.types.uuid(),
    content : Joi.string(),
  }
});

const tweet = new Tweet({ content: 123 })
const fail_result = Tweet.validate(tweet)
console.log(fail_result.error.name) // ValidationError

tweet.set('content', 'This is the content')
const pass_result = Tweet.validate(tweet)
console.log(pass_result.error) // null
```

### Configuration
You can configure dynowrap to automatically add `createdAt` and `updatedAt` timestamp attributes when
saving and updating a model. `updatedAt` will only be set when updating a record
and will not be set on initial creation of the model.

```js
const Account = dynowrap.define('Account', {
  hashKey : 'email',

  // add the timestamp attributes (updatedAt, createdAt)
  timestamps : true,

  schema : {
    email : Joi.string().email(),
  }
});
```

If you want dynowrap to handle timestamps, but only want some of them, or want your
timestamps to be called something else, you can override each attribute individually:

```js
const Account = dynowrap.define('Account', {
  hashKey : 'email',

  // enable timestamps support
  timestamps : true,

  // I don't want createdAt
  createdAt: false,

  // I want updatedAt to actually be called updateTimestamp
  updatedAt: 'updateTimestamp'

  schema : {
    email : Joi.string().email(),
  }
});
```

You can override the table name the model will use.

```js
const Event = dynowrap.define('Event', {
  hashKey : 'name',
  schema : {
    name : Joi.string(),
    total : Joi.number()
  },

  tableName: 'deviceEvents'
});
```

if you set the tableName to a function, dynowrap will use the result of the function as the active table to use.
Useful for storing time series data.

```js
const Event = dynowrap.define('Event', {
  hashKey : 'name',
  schema : {
    name : Joi.string(),
    total : Joi.number()
  },

  // store monthly event data
  tableName: function () {
    const d = new Date();
    return ['events', d.getFullYear(), d.getMonth() + 1].join('_');
  }
});
```

After you've defined your model you can configure the table name to use.
By default, the table name used will be the lowercased and pluralized version
of the name you provided when defining the model.

```js
Account.config({ tableName: 'AccountsTable' });
```

You can also pass in a custom instance of the aws-sdk DynamoDB client
```js
const dynamodb = new AWS.DynamoDB();
Account.config({ dynamodb: dynamodb });

// or globally use custom DynamoDB instance
// all defined models will now use this driver
dynowrap.dynamoDriver(dynamodb);
```

### Saving Models to DynamoDB
With your models defined, we can start saving them to DynamoDB.

```js
Account.create({ email: 'foo@example.com', name: 'Foo Bar', age: 21 }, (err, acc) => {
  console.log('created account in DynamoDB', acc.get('email'));
});
```

You can also first instantiate a model and then save it.

```js
const acc = new Account({ email: 'test@example.com', name: 'Test Example'v });
acc.save((err) => {
  console.log('created account in DynamoDB', acc.get('email'));
});
```

Saving models that require range and hashkeys are identical to ones with only
hashkeys.

```js
BlogPost.create({
  email: 'werner@example.com',
  title: 'Expanding the Cloud',
  content: 'Today, we are excited to announce the limited preview...'
  }, (err, post) => {
    console.log('created blog post', post.get('title'));
  });
```

Pass an array of items and they will be saved in parallel to DynamoDB.

```js
const item1 = { email: 'foo1@example.com', name: 'Foo 1', age: 10 };
const item2 = { email: 'foo2@example.com', name: 'Foo 2', age: 20 };
const item3 = { email: 'foo3@example.com', name: 'Foo 3', age: 30 };

Account.create([item1, item2, item3], (err, acccounts) => {
  console.log('created 3 accounts in DynamoDB', accounts);
});
```

Use expressions api to do conditional writes

```js
  const params = {};
  params.ConditionExpression = '#i <> :x';
  params.ExpressionAttributeNames = { '#i' : 'id' };
  params.ExpressionAttributeValues = { ':x' : 123};

  User.create({ id : 123, name : 'Kurt Warner' }, params, (error, acc) => { ... });
```

Use the `overwrite` option to prevent over writing of existing records.
  * By default `overwrite` is set to true, allowing create operations to overwrite existing records
```js
  // setting overwrite to false will generate
  // the same Condition Expression as in the previous example
  User.create({ id : 123, name : 'Kurt Warner' }, { overwrite : false }, (error, acc) => { ... });
```

### Updating

When updating a model the hash and range key attributes must be given, all
other attributes are optional

```js
// update the name of the foo@example.com account
Account.update({ email: 'foo@example.com', name: 'Bar Tester' }, (err, acc) => {
  console.log('update account', acc.get('name'));
});
```

`Model.update` accepts options to pass to DynamoDB when making the updateItem request

```js
Account.update({ email: 'foo@example.com', name: 'Bar Tester' }, { ReturnValues: 'ALL_OLD' }, (err, acc) => {
  console.log('update account', acc.get('name')); // prints the old account name
});

// Only update the account if the current age of the account is 22
Account.update({ email: 'foo@example.com', name: 'Bar Tester' }, { expected: { age: 22 } }, (err, acc) => {
  console.log('update account', acc.get('name'));
});

// setting an attribute to null will delete the attribute from DynamoDB
Account.update({ email: 'foo@example.com', age: null }, (err, acc) => {
  console.log('update account', acc.get('age')); // prints null
});
```

To ensure that an item exists before updating, use the `expected` parameter to check the existence of the hash key.  The hash key must exist for every DynamoDB item. This will return an error if the item does not exist.
```js
Account.update(
  { email: 'foo@example.com', name: 'FooBar Testers' },
  { expected: { email: { Exists: true } } },
  (err, acc) => {
    console.log(acc.get('name')); // FooBar Testers
  }
);

Account.update(
  { email: 'baz@example.com', name: 'Bar Tester' },
  { expected: { email: { Exists: true } } },
  (err, acc) => {
    console.log(err); // Condition Expression failed: no Account with that hash key
  }
);
```

This is essentially short-hand for:
```js
const params = {};
    params.ConditionExpression = 'attribute_exists(#hashKey)';
    params.ExpressionAttributeNames = { '#hashKey' : 'email' };
```

You can also pass what action to perform when updating a given attribute
Use $add to increment or decrement numbers and add values to sets

```js
Account.update({ email : 'foo@example.com', age : { $add : 1 } }, (err, acc) => {
  console.log('incremented age by 1', acc.get('age'));
});

BlogPost.update({
  email : 'werner@example.com',
  title : 'Expanding the Cloud',
  tags  : { $add : 'cloud' }
}, (err, post) => {
  console.log('added single tag to blog post', post.get('tags'));
});

BlogPost.update({
  email : 'werner@example.com',
  title : 'Expanding the Cloud',
  tags  : { $add : ['cloud', 'dynamodb'] }
}, (err, post) => {
  console.log('added tags to blog post', post.get('tags'));
});
```

$del will remove values from a given set

```js
BlogPost.update({
  email : 'werner@example.com',
  title : 'Expanding the Cloud',
  tags  : { $del : 'cloud' }
}, (err, post) => {
  console.log('removed cloud tag from blog post', post.get('tags'));
});

BlogPost.update({
  email : 'werner@example.com',
  title : 'Expanding the Cloud',
  tags  : { $del : ['aws', 'node'] }
}, (err, post) => {
  console.log('removed multiple tags', post.get('tags'));
});
```

Use the expressions api to update nested documents

```js
const params = {};
  params.UpdateExpression = 'SET #year = #year + :inc, #dir.titles = list_append(#dir.titles, :title), #act[0].firstName = :firstName ADD tags :tag';
  params.ConditionExpression = '#year = :current';
  params.ExpressionAttributeNames = {
    '#year' : 'releaseYear',
    '#dir' : 'director',
    '#act' : 'actors'
  };

  params.ExpressionAttributeValues = {
    ':inc' : 1,
    ':current' : 2001,
    ':title' : ['The Man'],
    ':firstName' : 'Rob',
    ':tag' : dynowrap.Set(['Sports', 'Horror'], 'S')
  };

Movie.update({ title : 'Movie 0', description : 'This is a description' }, params, (err, mov) => {});
```

### Deleting
You delete items in DynamoDB using the hashkey of model
If your model uses both a hash and range key, then both need to be provided

```js
Account.destroy('foo@example.com', (err) => {
  console.log('account deleted');
});

// Destroy model using hash and range key
BlogPost.destroy('foo@example.com', 'Hello World!', (err) => {
  console.log('post deleted')
});

BlogPost.destroy({ email: 'foo@example.com', title: 'Another Post' }, (err) => {
  console.log('another post deleted')
});
```

`Model.destroy` accepts options to pass to DynamoDB when making the deleteItem request

```js
Account.destroy('foo@example.com', {ReturnValues: 'ALL_OLD' }, (err, acc) => {
  console.log('account deleted');
  console.log('deleted account name', acc.get('name'));
});

Account.destroy('foo@example.com', {expected: {age: 22}}, (err) => {
  console.log('account deleted if the age was 22');
});
```


Use expression apis to perform conditional deletes

```js
const params = {};
params.ConditionExpression = '#v = :x';
params.ExpressionAttributeNames = { '#v' : 'version' };
params.ExpressionAttributeValues = { ':x' : '2' };

User.destroy({ id : 123}, params, (err, acc) => {});
```

### Loading models from DynamoDB
The simpliest way to get an item from DynamoDB is by hashkey.

```js
Account.get('test@example.com', (err, acc) => {
  console.log('got account', acc.get('email'));
});
```

Perform the same get request, but this time peform a consistent read.

```js
Account.get('test@example.com', { ConsistentRead: true }, (err, acc) => {
  console.log('got account', acc.get('email'));
});
```

`Model.get` accepts any options that DynamoDB getItem request supports. For
example:

```js
Account.get('test@example.com', { ConsistentRead: true, AttributesToGet : ['name','age'] }, (err, acc) => {
  console.log('got account', acc.get('email'))
  console.log(acc.get('name'));
  console.log(acc.get('age'));
  console.log(acc.get('email')); // prints null
});
```

Get a model using hash and range key.

```js
// load up blog post written by Werner, titled DynamoDB Keeps Getting Better and cheaper
BlogPost.get('werner@example.com', 'dynamodb-keeps-getting-better-and-cheaper', (err, post) => {
  console.log('loaded post by range and hash key', post.get('content'));
});
```

`Model.get` also supports passing an object which contains hash and range key
attributes to load up a model

```js
BlogPost.get({ email: 'werner@example.com', title: 'Expanding the Cloud' }, (err, post) => {
  console.log('loded post', post.get('content'));
});
```

Use expressions api to select which attributes you want returned

```js
  User.get({ id : '123456789' },{ ProjectionExpression : 'email, age, settings.nickname' }, (err, acc) => {});
```

### Query
For models that use hash and range keys dynowrap provides a flexible and
chainable query api

```js
// query for blog posts by werner@example.com
BlogPost
  .query('werner@example.com')
  .exec(callback);

// same as above, but load all results
BlogPost
  .query('werner@example.com')
  .loadAll()
  .exec(callback);

// only load the first 5 posts by werner
BlogPost
  .query('werner@example.com')
  .limit(5)
  .exec(callback);

// query for posts by werner where the tile begins with 'Expanding'
BlogPost
  .query('werner@example.com')
  .where('title').beginsWith('Expanding')
  .exec(callback);

// return only the count of documents that begin with the title Expanding
BlogPost
  .query('werner@example.com')
  .where('title').beginsWith('Expanding')
  .select('COUNT')
  .exec(callback);

// query the first 10 posts by werner@example.com but only return
// the title and content from posts where the title starts with 'Expanding'
// WARNING: See notes below on the implementation of limit in DynamoDB
BlogPost
  .query('werner@example.com')
  .where('title').beginsWith('Expanding')
  .attributes(['title', 'content'])
  .limit(10)
  .exec(callback);

// sorting by title ascending
BlogPost
  .query('werner@example.com')
  .ascending()
  .exec(callback)

// sorting by title descending
BlogPost
  .query('werner@example.com')
  .descending()
  .exec(callback)

// All query options are chainable
BlogPost
  .query('werner@example.com')
  .where('title').gt('Expanding')
  .attributes(['title', 'content'])
  .limit(10)
  .ascending()
  .loadAll()
  .exec(callback);

// Traversing Map Data Types
Account
  .query('werner@example.com')
  .filter('settings.acceptedTerms').equals(true)
  .exec(callback);
```

**Warning, limit is applied first before the where filter. The limit value limits the scanned count,
not the number of returned items. See #12**

dynowrap supports all the possible KeyConditions that DynamoDB currently
supports.

```js
BlogPost
  .query('werner@example.com')
  .where('title').equals('Expanding')
  .exec();

// less than equals
BlogPost
  .query('werner@example.com')
  .where('title').lte('Expanding')
  .exec();

// less than
BlogPost
  .query('werner@example.com')
  .where('title').lt('Expanding')
  .exec();

// greater than
BlogPost
  .query('werner@example.com')
  .where('title').gt('Expanding')
  .exec();

// greater than equals
BlogPost
  .query('werner@example.com')
  .where('title').gte('Expanding')
  .exec();

// attribute doesn't exist
BlogPost
  .query('werner@example.com')
  .where('title').null()
  .exec();

// attribute exists
BlogPost
  .query('werner@example.com')
  .where('title').exists()
  .exec();

BlogPost
  .query('werner@example.com')
  .where('title').beginsWith('Expanding')
  .exec();

BlogPost
  .query('werner@example.com')
  .where('title').between('foo@example.com', 'test@example.com')
  .exec();
```

Query Filters allow you to further filter results on non-key attributes.

```js
BlogPost
  .query('werner@example.com')
  .where('title').equals('Expanding')
  .filter('tags').contains('cloud')
  .exec();
```

Expression Filters also allow you to further filter results on non-key attributes.

```javascript
BlogPost
  .query('werner@example.com')
  .filterExpression('#title < :t')
  .expressionAttributeValues({ ':t' : 'Expanding' })
  .expressionAttributeNames({ '#title' : 'title' })
  .projectionExpression('#title, tag')
  .exec();
```

See the queryFilter.js [example][0] for more examples of using query filters

#### Global Indexes

First, define a model with a global secondary index.

```js
const GameScore = dynowrap.define('GameScore', {
  hashKey : 'userId',
  rangeKey : 'gameTitle',
  schema : {
    userId           : Joi.string(),
    gameTitle        : Joi.string(),
    topScore         : Joi.number(),
    topScoreDateTime : Joi.date(),
    wins             : Joi.number(),
    losses           : Joi.number()
  },
  indexes : [{
    hashKey : 'gameTitle', rangeKey : 'topScore', name : 'GameTitleIndex', type : 'global'
  }]
});
```

Now we can query against the global index

```js
GameScore
  .query('Galaxy Invaders')
  .usingIndex('GameTitleIndex')
  .descending()
  .exec(callback);
```

When can also configure the attributes projected into the index.
By default all attributes will be projected when no Projection pramater is
present

```js
const GameScore = dynowrap.define('GameScore', {
  hashKey : 'userId',
  rangeKey : 'gameTitle',
  schema : {
    userId           : Joi.string(),
    gameTitle        : Joi.string(),
    topScore         : Joi.number(),
    topScoreDateTime : Joi.date(),
    wins             : Joi.number(),
    losses           : Joi.number()
  },
  indexes : [{
    hashKey : 'gameTitle',
    rangeKey : 'topScore',
    name : 'GameTitleIndex',
    type : 'global',
    projection: { NonKeyAttributes: [ 'wins' ], ProjectionType: 'INCLUDE' } //optional, defaults to ALL

  }]
});
```

Filter items against the configured rangekey for the global index.

```js
GameScore
  .query('Galaxy Invaders')
  .usingIndex('GameTitleIndex')
  .where('topScore').gt(1000)
  .descending()
  .exec(function (err, data) {
    console.log(_.map(data.Items, JSON.stringify));
  });
```

#### Local Secondary Indexes
First, define a model using a local secondary index

```js
const BlogPost = dynowrap.define('Account', {
  hashKey : 'email',
  rangeKey : 'title',
  schema : {
    email             : Joi.string().email(),
    title             : Joi.string(),
    content           : Joi.binary(),
    PublishedDateTime : Joi.date()
  },

  indexes : [{
    hashKey : 'email', rangeKey : 'PublishedDateTime', type : 'local', name : 'PublishedIndex'
  }]
});
```

Now we can query for blog posts using the secondary index

```js
BlogPost
  .query('werner@example.com')
  .usingIndex('PublishedIndex')
  .descending()
  .exec(callback);
```

Could also query for published posts, but this time return oldest first

```js
BlogPost
  .query('werner@example.com')
  .usingIndex('PublishedIndex')
  .ascending()
  .exec(callback);
```

Finally lets load all published posts sorted by publish date
```js
BlogPost
  .query('werner@example.com')
  .usingIndex('PublishedIndex')
  .descending()
  .loadAll()
  .exec(callback);
```

Learn more about [secondary indexes][3]

### Scan
dynowrap provides a flexible and chainable api for scanning over all your items
This api is very similar to the query api.

```js
// scan all accounts, returning the first page or results
Account.scan().exec(callback);

// scan all accounts, this time loading all results
// note this will potentially make several calls to DynamoDB
// in order to load all results
Account
  .scan()
  .loadAll()
  .exec(callback);

// Load 20 accounts
Account
  .scan()
  .limit(20)
  .exec();

// Load All accounts, 20 at a time per request
Account
  .scan()
  .limit(20)
  .loadAll()
  .exec();

// Load accounts which match a filter
// only return email and created attributes
// and return back the consumed capacity the request took
Account
  .scan()
  .where('email').gte('f@example.com')
  .attributes(['email','created'])
  .returnConsumedCapacity()
  .exec();

// Load All accounts, if settings.acceptedTerms is true
Account
  .scan()
  .where('settings.acceptedTerms').equals(true)
  .exec();

// Returns number of matching accounts, rather than the matching accounts themselves
Account
  .scan()
  .where('age').gte(21)
  .select('COUNT')
  .exec();

// Start scan using start key
Account
  .scan()
  .where('age').notNull()
  .startKey('foo@example.com')
  .exec()
```

dynowrap supports all the possible Scan Filters that DynamoDB currently supports.

```js
// equals
Account
  .scan()
  .where('name').equals('Werner')
  .exec();

// not equals
Account
  .scan()
  .where('name').ne('Werner')
  .exec();

// less than equals
Account
  .scan()
  .where('name').lte('Werner')
  .exec();

// less than
Account
  .scan()
  .where('name').lt('Werner')
  .exec();

// greater than equals
Account
  .scan()
  .where('name').gte('Werner')
  .exec();

// greater than
Account
  .scan()
  .where('name').gt('Werner')
  .exec();

// name attribute doesn't exist
Account
  .scan()
  .where('name').null()
  .exec();

// name attribute exists
Account
  .scan()
  .where('name').notNull()
  .exec();

// contains
Account
  .scan()
  .where('name').contains('ner')
  .exec();

// not contains
Account
  .scan()
  .where('name').notContains('ner')
  .exec();

// in
Account
  .scan()
  .where('name').in(['foo@example.com', 'bar@example.com'])
  .exec();

// begins with
Account
  .scan()
  .where('name').beginsWith('Werner')
  .exec();

// between
Account
  .scan()
  .where('name').between('Bar', 'Foo')
  .exec();

// multiple filters
Account
  .scan()
  .where('name').equals('Werner')
  .where('age').notNull()
  .exec();
```

You can also use the new expressions api when filtering scans

```javascript
User.scan()
  .filterExpression('#age BETWEEN :low AND :high AND begins_with(#email, :e)')
  .expressionAttributeValues({ ':low' : 18, ':high' : 22, ':e' : 'test1' })
  .expressionAttributeNames({ '#age' : 'age', '#email' : 'email' })
  .projectionExpression('#age, #email')
  .exec();
```

### Batch Get Items
`Model.getItems` allows you to load multiple models with a single request to DynamoDB.

DynamoDB limits the number of items you can get to 100 or 1MB of data for a single request.
dynowrap automatically handles splitting up into multiple requests to load all
items.

```js
Account.getItems(['foo@example.com','bar@example.com', 'test@example.com'], function (err, accounts) {
  console.log('loaded ' + accounts.length + ' accounts'); // prints loaded 3 accounts
});

// For models with range keys you must pass in objects of hash and range key attributes
const postKey1 = { email : 'test@example.com', title : 'Hello World!' };
const postKey2 = { email : 'test@example.com', title : 'Another Post' };

BlogPost.getItems([postKey1, postKey2], function (err, posts) {
  console.log('loaded posts');
});
```

`Model.getItems` accepts options which will be passed to DynamoDB when making the batchGetItem request

```js
// Get both accounts, using a consistent read
Account.getItems(['foo@example.com','bar@example.com'], {ConsistentRead: true}, function (err, accounts) {
  console.log('loaded ' + accounts.length + ' accounts'); // prints loaded 2 accounts
});
```

### Streaming api
dynowrap supports a basic streaming api in addition to the callback
api for `query` and `scan` operations.

```js
const querystream = BlogPost.query('werner@dynowrap.com').loadAll().exec();

querystream.on('readable', function () {
  console.log('single query response', stream.read());
});

querystream.on('end', function () {
  console.log('query for blog posts finished');
});
```

### Dynamic Table Names
dynowrap supports dynamic table names, useful for storing time series data.

```js
const Event = dynowrap.define('Event', {
  hashKey : 'name',
  schema : {
    name : Joi.string(),
    total : Joi.number()
  },

  // store monthly event data
  tableName: function () {
    const d = new Date();
    return ['events', d.getFullYear(), d.getMonth() + 1].join('_');
  }
});
```

### Logging
A [Bunyan](https://www.npmjs.com/package/bunyan) logger instance can be provided to either dynowrap itself or individual models.  dynowrap requests are logged at the `info` level.
Other loggers that implement `info` and `warn` methods can also be used. However, [Winston](https://www.npmjs.com/package/winston) uses a different parameter signature than bunyan so the log messages are improperly formatted when using Winston.

```js
const bunyan = require('bunyan');
const logger = bunyan.createLogger(
  {
    name: 'globalLogger',
    level:'info'
  })

dynowrap.log = logger;
```


```js
const bunyan = require('bunyan');
const accountLogger = bunyan.createLogger(
  {
    name: 'modelLogger',
    level:'info'
  })

const Account = dynowrap.define('Account', {
  hashKey: 'email',
  log: accountLogger
}); // INFO level on account table
```

* [Bunyan log levels](https://github.com/trentm/node-bunyan#levels)

## Examples

```js
const dynowrap = require('dynowrap');

const Account = dynowrap.define('Account', {
  hashKey : 'email',

  // add the timestamp attributes (updatedAt, createdAt)
  timestamps : true,

  schema : {
    email   : Joi.string().email(),
    name    : Joi.string().required(),
    age     : Joi.number(),
  }
});

Account.create({ email: 'test@example.com', name : 'Test Account' }, (err, acc) => {
  console.log('created account at', acc.get('created')); // prints created Date

  acc.set({age: 22});

  acc.update((err) => {
    console.log('updated account age');
  });

});
```

See the [examples][0] for more working sample code.

### Support

dynowrap is provided as-is, free of charge. For support, you have a few choices:

- Ask your support question on [stackoverflow.com](https://stackoverflow.com), and tag your question with **dynowrap**.
- If you believe you have found a bug in dynowrap, please submit a support ticket on
 the [Github Issues page for dynowrap](https://github.com/afgallo/dynowrap/issues). We'll get to them as soon as we can.
- For general feedback message me on [twitter](https://twitter.com/andre__gallo)

### Maintainers

- [Andre Gallo](https://github.com/afgallo) ([@andre__gallo](https://twitter.com/andre__gallo))

### License
The MIT License

Copyright (c) 2016 Ryan Fitzgerald

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[0]: https://github.com/afgallo/dynowrap/tree/main/examples
[1]: https://nodejs.org
[2]: https://aws.amazon.com/sdkfornodejs
[3]: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html
[4]: https://aws.amazon.com/dynamodb
