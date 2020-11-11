const fs = require('fs')
const Joi = require('joi')
const dynowrap = require('../index')

const { AWS } = dynowrap
AWS.config.loadFromPath(`${process.env.HOME}/.ec2/credentials.json`)

const BinModel = dynowrap.define('example-binary', {
  hashKey: 'name',
  timestamps: true,
  schema: {
    name: Joi.string(),
    data: Joi.binary()
  }
})

const printFileInfo = (err, file) => {
  if (err) {
    console.log('got error', err)
  } else if (file) {
    console.log('got file', file.get())
  } else {
    console.log('file not found')
  }
}

dynowrap.createTables((err) => {
  if (err) {
    console.log('Error creating tables', err)
    process.exit(1)
  }

  fs.readFile(`${__dirname}/basic.js`, (err, data) => {
    if (err) {
      throw err
    }

    BinModel.create({ name: 'basic.js', data }, printFileInfo)
  })
})
