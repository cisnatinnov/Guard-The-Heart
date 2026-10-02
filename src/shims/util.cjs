'use strict'

function format(f, ...args) {
  if (typeof f !== 'string') {
    return [f, ...args]
      .map((value) => inspect(value))
      .join(' ')
  }
  let index = 0
  const formatted = f.replace(/%[sdifjoOc%]/g, (token) => {
    if (token === '%%') return '%'
    if (index >= args.length) return token
    const value = args[index]
    index += 1
    switch (token) {
      case '%s':
        return typeof value === 'string' ? value : inspect(value)
      case '%d':
      case '%i':
        return String(Number(value))
      case '%f':
        return String(parseFloat(value))
      case '%j':
        try {
          return JSON.stringify(value)
        } catch {
          return '[Circular]'
        }
      case '%o':
      case '%O':
      case '%c':
        return inspect(value)
      default:
        return token
    }
  })
  const remaining = args.slice(index)
  if (remaining.length === 0) return formatted
  return [formatted, ...remaining.map((value) => inspect(value))].join(' ')
}

function inspect(value, options) {
  if (value === null) return 'null'
  const type = typeof value
  if (type === 'string') return options && options.quoteStrings ? `'${value}'` : value
  if (type !== 'object') return String(value)
  if (value instanceof Error) return value.stack || value.message
  if (value instanceof Date) return value.toISOString()
  try {
    const depth = options && typeof options.depth === 'number' ? options.depth : 2
    return JSON.stringify(value, (_key, nested, level) => {
      if (level > depth) return '[Object]'
      if (typeof nested === 'bigint') return nested.toString()
      if (nested instanceof Map) return Object.fromEntries(nested)
      if (nested instanceof Set) return [...nested]
      return nested
    })
  } catch {
    return String(value)
  }
}

function deprecate(fn, message) {
  let warned = false
  function deprecated(...args) {
    if (!warned) {
      warned = true
      if (typeof console !== 'undefined' && console.warn) console.warn(message)
    }
    return fn.apply(this, args)
  }
  Object.defineProperty(deprecated, 'name', { value: fn.name ? `deprecated_${fn.name}` : 'deprecated' })
  return deprecated
}

function promisify(original) {
  if (typeof original !== 'function') throw new TypeError('The "original" argument must be of type function')
  function fn(...args) {
    return new Promise((resolve, reject) => {
      original.call(this, ...args, (error, value) => {
        if (error) reject(error)
        else resolve(value)
      })
    })
  }
  Object.defineProperty(fn, 'name', { value: original.name || 'promisified' })
  return fn
}

function inherits(constructor, superConstructor) {
  constructor.super_ = superConstructor
  constructor.prototype = Object.create(superConstructor.prototype, {
    constructor: { value: constructor, enumerable: false, writable: true, configurable: true },
  })
}

const types = {
  isDate: (value) => value instanceof Date,
  isRegExp: (value) => value instanceof RegExp,
  isNativeError: (value) => value instanceof Error,
  isPromise: (value) => value instanceof Promise,
  isArrayBuffer: (value) => value instanceof ArrayBuffer,
  isTypedArray: (value) => ArrayBuffer.isView(value),
}

module.exports = { format, inspect, deprecate, promisify, inherits, types }
module.exports.default = module.exports
