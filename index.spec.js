/* eslint-env jest */
jest.mock('@aws-sdk/client-dynamodb')
const {DynamoDBClient, GetItemCommand} = require('@aws-sdk/client-dynamodb')
const {rcpt, register} = require('.')
const {AssertionError} = require('assert')

const getRandomString = () => Math.random().toString(36).substring(4)

describe('register()', () => {
  const getThisMock = (configMock) => {
    return {
      config: {get: (key) => configMock[key]},
      register_hook: jest.fn(),
    }
  }

  it('throws if rcpt-dynamo.table-name is not set', () => {
    const thisMock = getThisMock({'rcpt-dynamo.hash-key-name': getRandomString()})
    expect(() => register.call(thisMock)).toThrow(AssertionError)
    expect(() => register.call(thisMock)).toThrow(/rcpt-dynamo.table-name/)
    expect(thisMock.register_hook).not.toHaveBeenCalled()
  })

  it('throws if rcpt-dynamo.hash-key-name is not set', () => {
    const thisMock = getThisMock({'rcpt-dynamo.table-name': getRandomString()})
    expect(() => register.call(thisMock)).toThrow(AssertionError)
    expect(() => register.call(thisMock)).toThrow(/rcpt-dynamo.hash-key-name/)
    expect(thisMock.register_hook).not.toHaveBeenCalled()
  })

  it('sets rcpt-dynamo.table-name and rcpt-dynamo.hash-key-name to plugin object', () => {
    const tableName = getRandomString()
    const hashKeyName = getRandomString()
    const thisMock = getThisMock({
      'rcpt-dynamo.table-name': tableName,
      'rcpt-dynamo.hash-key-name': hashKeyName,
    })
    register.call(thisMock)
    expect(thisMock.tableName).toBe(tableName)
    expect(thisMock.hashKeyName).toBe(hashKeyName)
    expect(thisMock.register_hook).toHaveBeenCalled()
  })

  it('initializes the aws dynamo client', () => {
    const thisMock = getThisMock({
      'rcpt-dynamo.table-name': getRandomString(),
      'rcpt-dynamo.hash-key-name': getRandomString(),
    })
    const client = {}
    DynamoDBClient.mockReturnValue(client)
    register.call(thisMock)
    expect(DynamoDBClient).toHaveBeenCalledTimes(1)
    expect(DynamoDBClient).toHaveBeenCalledWith()
    expect(thisMock.client).toBe(client)
  })

  it('registers rcpt hook correctly', () => {
    const thisMock = getThisMock({
      'rcpt-dynamo.table-name': getRandomString(),
      'rcpt-dynamo.hash-key-name': getRandomString(),
    })
    register.call(thisMock)
    expect(thisMock.register_hook).toHaveBeenCalledTimes(1)
    expect(thisMock.register_hook).toHaveBeenCalledWith('rcpt', 'rcpt')
  })
})

describe('rcpt()', () => {
  const next = jest.fn()
  const connection = {
    logdebug: jest.fn(),
    loginfo: jest.fn(),
    logerror: jest.fn(),
    transaction: {
      results: {
        add: jest.fn(),
      },
    },
  }
  let address
  let params
  let thisMock

  beforeEach(() => {
    address = getRandomString()
    params = [{address: () => address}]
    thisMock = {
      client: new DynamoDBClient(),
      tableName: getRandomString(),
      hashKeyName: getRandomString(),
    }
  })

  it('returns without doing anything if the connection has no transaction', async () => {
    const {transaction, ...connectionNoTxn} = connection
    await rcpt.call(thisMock, next, connectionNoTxn, params)
    expect(next).not.toHaveBeenCalled()
    expect(connection.logdebug).not.toHaveBeenCalled()
    expect(thisMock.client.send).not.toHaveBeenCalled()
  })

  it('sends the correct query to dynamo', async () => {
    // configure
    const cmd = {}
    GetItemCommand.mockReturnValue(cmd)
    thisMock.client.send.mockResolvedValue({})
    // execute
    await rcpt.call(thisMock, next, connection, params)
    // verify
    expect(GetItemCommand).toHaveBeenCalledTimes(1)
    expect(GetItemCommand).toHaveBeenCalledWith({
      TableName: thisMock.tableName,
      Key: {[thisMock.hashKeyName]: {S: address}},
      ProjectionExpression: thisMock.hashKeyName,
    })
    expect(thisMock.client.send).toHaveBeenCalledTimes(1)
    expect(thisMock.client.send.mock.calls[0]).toHaveLength(1)
    expect(thisMock.client.send.mock.calls[0][0]).toBe(cmd)
  })

  it('accepts an address found in dynamo', async () => {
    // configure
    global.OK = {}
    thisMock.client.send.mockResolvedValue({Item: true})
    // execute
    await rcpt.call(thisMock, next, connection, params)
    // verify
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(global.OK)
    expect(connection.loginfo).toHaveBeenLastCalledWith(
      thisMock,
      `Accepting rcpt found in dynamo: '${address}'`,
    )
    expect(connection.transaction.results.add).toHaveBeenCalledTimes(1)
    expect(connection.transaction.results.add).toHaveBeenCalledWith(thisMock, {
      pass: 'address-found',
    })
  })

  it('rejects an address not found in dynamo', async () => {
    // configure
    thisMock.client.send.mockResolvedValue({})
    // execute
    await rcpt.call(thisMock, next, connection, params)
    // verify
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
    expect(connection.loginfo).toHaveBeenLastCalledWith(
      thisMock,
      `Rejecting rcpt not found in dynamo: '${address}'`,
    )
    expect(connection.transaction.results.add).toHaveBeenCalledTimes(1)
    expect(connection.transaction.results.add).toHaveBeenCalledWith(thisMock, {
      fail: 'address-not-found',
    })
  })

  it('rejects address and records error if dynamo throws an error', async () => {
    // configure
    const err = new Error(getRandomString())
    thisMock.client.send.mockRejectedValue(err)
    // execute
    await rcpt.call(thisMock, next, connection, params)
    // verify
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
    expect(connection.logerror).toHaveBeenLastCalledWith(
      thisMock,
      `Rejecting rctp '${address}', dynamo query error: '${err}'`,
    )
    expect(connection.transaction.results.add).toHaveBeenCalledTimes(1)
    expect(connection.transaction.results.add).toHaveBeenCalledWith(thisMock, {err: err})
  })
})
