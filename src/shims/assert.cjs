'use strict'

class AssertionError extends Error {
  constructor(options) {
    const message = options && options.message ? options.message : 'Assertion failed'
    super(message)
    this.name = 'AssertionError'
    this.code = 'ERR_ASSERTION'
    if (options) {
      this.actual = options.actual
      this.expected = options.expected
      this.operator = options.operator
    }
  }
}

function fail(message) {
  throw new AssertionError({ message: message || 'Assertion failed' })
}

function ok(value, message) {
  if (!value) fail(message)
}

function equal(actual, expected, message) {
  if (actual != expected) throw new AssertionError({ message, actual, expected, operator: '==' })
}

function notEqual(actual, expected, message) {
  if (actual == expected) throw new AssertionError({ message, actual, expected, operator: '!=' })
}

function strictEqual(actual, expected, message) {
  if (actual !== expected) throw new AssertionError({ message, actual, expected, operator: '===' })
}

function notStrictEqual(actual, expected, message) {
  if (actual === expected) throw new AssertionError({ message, actual, expected, operator: '!==' })
}

function deepEqual(actual, expected, message) {
  try {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(message)
  } catch {
    if (actual !== expected) fail(message)
  }
}

function deepStrictEqual(actual, expected, message) {
  deepEqual(actual, expected, message)
}

function notDeepEqual(actual, expected, message) {
  try {
    if (JSON.stringify(actual) === JSON.stringify(expected)) fail(message)
  } catch {
    if (actual === expected) fail(message)
  }
}

function notDeepStrictEqual(actual, expected, message) {
  notDeepEqual(actual, expected, message)
}

function throws(fn, message) {
  let threw = false
  try {
    fn()
  } catch {
    threw = true
  }
  if (!threw) fail(message || 'Missing expected exception')
}

function doesNotThrow(fn, message) {
  try {
    fn()
  } catch (error) {
    fail(message || `Got unwanted exception: ${error && error.message}`)
  }
}

ok.ok = ok
ok.fail = fail
ok.equal = equal
ok.notEqual = notEqual
ok.strictEqual = strictEqual
ok.notStrictEqual = notStrictEqual
ok.deepEqual = deepEqual
ok.deepStrictEqual = deepStrictEqual
ok.notDeepEqual = notDeepEqual
ok.notDeepStrictEqual = notDeepStrictEqual
ok.throws = throws
ok.doesNotThrow = doesNotThrow
ok.AssertionError = AssertionError

module.exports = ok
module.exports.default = ok
