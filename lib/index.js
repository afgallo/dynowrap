const _ = require('lodash')
const util = require('util')
const AWS = require('aws-sdk')
const Table = require('./table')
const Schema = require('./schema')
const serializer = require('./serializer')
const batch = require('./batch')
const Item = require('./item')
const createTables = require('./createTables')

const DocClient = AWS.DynamoDB.DocumentClient
const dynowrap = module.exports

dynowrap.AWS = AWS

const internals = {}

dynowrap.log = dynowrap.log || {
  info: () => null,
  warn: () => null
}

dynowrap.dynamoDriver = internals.dynamoDriver = (driver) => {
  if (driver) {
    internals.dynamodb = driver

    const docClient = internals.loadDocClient(driver)
    internals.updateDynamoDBDocClientForAllModels(docClient)
  } else {
    internals.dynamodb = internals.dynamodb || new dynowrap.AWS.DynamoDB({ apiVersion: '2012-08-10' })
  }

  return internals.dynamodb
}

dynowrap.documentClient = internals.documentClient = (docClient) => {
  if (docClient) {
    internals.docClient = docClient
    internals.dynamodb = docClient.service
    internals.updateDynamoDBDocClientForAllModels(docClient)
  } else {
    internals.loadDocClient()
  }

  return internals.docClient
}

internals.updateDynamoDBDocClientForAllModels = (docClient) => {
  _.each(dynowrap.models, (model) => {
    model.config({ docClient })
  })
}

internals.loadDocClient = (driver) => {
  if (driver) {
    internals.docClient = new DocClient({ service: driver })
  } else {
    internals.docClient = internals.docClient || new DocClient({ service: internals.dynamoDriver() })
  }

  return internals.docClient
}

internals.compileModel = (name, schema, log) => {
  const tableName = name.toLowerCase()

  const table = new Table(tableName, schema, serializer, internals.loadDocClient(), log)

  const Model = function model(attrs) {
    Item.call(this, attrs, table)
  }

  util.inherits(Model, Item)

  Model.get = _.bind(table.get, table)
  Model.create = _.bind(table.create, table)
  Model.update = _.bind(table.update, table)
  Model.destroy = _.bind(table.destroy, table)
  Model.query = _.bind(table.query, table)
  Model.scan = _.bind(table.scan, table)
  Model.validate = _.bind(table.validate, table)

  Model.getItems = batch(table, serializer).getItems
  Model.batchGetItems = batch(table, serializer).getItems

  // table ddl methods
  Model.createTable = _.bind(table.createTable, table)
  Model.updateTable = _.bind(table.updateTable, table)
  Model.describeTable = _.bind(table.describeTable, table)
  Model.deleteTable = _.bind(table.deleteTable, table)
  Model.tableName = _.bind(table.tableName, table)
  Model.dynamoCreateTableParams = _.bind(table.dynamoCreateTableParams, table)

  table.itemFactory = Model

  Model.log = log

  // hooks
  Model.after = _.bind(table.after, table)
  Model.before = _.bind(table.before, table)

  Object.defineProperties(Model, {
    docClient: { get: () => table.docClient },
    schema: { get: () => table.schema }
  })

  Model.config = (config) => {
    const options = config || {}

    if (options.tableName) {
      table.config.name = options.tableName
    }

    if (options.docClient) {
      table.docClient = options.docClient
    } else if (options.dynamodb) {
      table.docClient = new DocClient({ service: options.dynamodb })
    }

    return table.config
  }

  return dynowrap.model(name, Model)
}

internals.addModel = (name, model) => {
  dynowrap.models[name] = model

  return dynowrap.models[name]
}

dynowrap.reset = () => {
  dynowrap.models = {}
}

dynowrap.Set = function set() {
  return internals.docClient.createSet.apply(internals.docClient, arguments)
}

dynowrap.define = (modelName, config) => {
  if (_.isFunction(config)) {
    throw new Error('define no longer accepts schema callback, migrate to new api')
  }

  const schema = new Schema(config)

  const compiledTable = internals.compileModel(modelName, schema, config.log || dynowrap.log)

  return compiledTable
}

dynowrap.model = (name, model) => {
  if (model) {
    internals.addModel(name, model)
  }

  return dynowrap.models[name] || null
}

dynowrap.createTables = (options, callback) => {
  if (typeof options === 'function' && !callback) {
    callback = options
    options = {}
  }

  callback = callback || _.noop
  options = options || {}

  return createTables(dynowrap.models, options, callback)
}

dynowrap.types = Schema.types

dynowrap.reset()
