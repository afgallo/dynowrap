const Joi = require('joi')
const dynowrap = require('../index')

const { AWS } = dynowrap
AWS.config.loadFromPath(`${process.env.HOME}/.ec2/credentials.json`)

dynowrap.define('example-Account', {
  hashKey: 'name',
  rangeKey: 'email',
  schema: {
    name: Joi.string(),
    email: Joi.string(),
    age: Joi.number()
  },
  indexes: [{ hashKey: 'name', rangeKey: 'age', type: 'local', name: 'NameAgeIndex' }]
})

dynowrap.define('example-GameScore', {
  hashKey: 'userId',
  rangeKey: 'gameTitle',
  schema: {
    userId: Joi.string(),
    gameTitle: Joi.string(),
    topScore: Joi.number(),
    topScoreDateTime: Joi.date(),
    wins: Joi.number(),
    losses: Joi.number()
  },
  indexes: [
    {
      hashKey: 'gameTitle',
      rangeKey: 'topScore',
      type: 'global',
      name: 'GameTitleIndex',
      projection: { NonKeyAttributes: ['wins'], ProjectionType: 'INCLUDE' }
    }
  ]
})

dynowrap.createTables(
  {
    'example-Account': { readCapacity: 1, writeCapacity: 1 },
    'example-GameScore': {
      readCapacity: 1,
      writeCapacity: 1,
      streamSpecification: {
        streamEnabled: true,
        streamViewType: 'NEW_IMAGE'
      }
    }
  },
  (err) => {
    if (err) {
      console.log('Error creating tables', err)
    } else {
      console.log('table are now created and active')
    }
  }
)
