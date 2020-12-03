const {DynamoDBClient, GetItemCommand} = require('@aws-sdk/client-dynamodb')
const {strict: assert} = require('assert')

exports.register = function () {
  this.client = new DynamoDBClient()
  this.tableName = this.config.get('rcpt-dynamo.table-name')
  this.hashKeyName = this.config.get('rcpt-dynamo.hash-key-name')
  assert(this.tableName, 'rcpt-dynamo.table-name must be configured')
  assert(this.hashKeyName, 'rcpt-dynamo.hash-key-name must be configured')
  this.register_hook('rcpt', 'rcpt')
}

exports.rcpt = async function (next, connection, params) {
  // Not sure why we need to do this check, but seems the default plugins do it so we will too
  // https://github.com/haraka/Haraka/blob/v2.8.19/plugins/rcpt_to.in_host_list.js#L22-L23
  // https://github.com/haraka/haraka-plugin-rcpt-ldap/blob/7f51384aa/index.js#L33-L34
  const txn = connection.transaction
  if (!txn) return

  const address = params[0].address().toLowerCase()
  connection.logdebug(this, `Checking dynamo for '${address}'`)

  const cmd = new GetItemCommand({
    TableName: this.tableName,
    Key: {[this.hashKeyName]: {S: address}},
    ProjectionExpression: this.hashKeyName,
  })

  let Item
  try {
    Item = await this.client.send(cmd).then(({Item}) => Item)
  } catch (err) {
    connection.logerror(this, `Rejecting rctp '${address}', dynamo query error: '${err}'`)
    txn.results.add(this, {err: err})
    return next()
  }

  if (Item) {
    connection.loginfo(this, `Accepting rcpt found in dynamo: '${address}'`)
    txn.results.add(this, {pass: 'address-found'})
    return next(OK)
  } else {
    connection.loginfo(this, `Rejecting rcpt not found in dynamo: '${address}'`)
    txn.results.add(this, {fail: 'address-not-found'})
    return next()
  }
}
