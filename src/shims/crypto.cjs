'use strict'

function randomFill(target) {
  const view = target instanceof Uint8Array ? target : new Uint8Array(target)
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(view)
  } else {
    for (let i = 0; i < view.length; i += 1) view[i] = Math.floor(Math.random() * 256)
  }
  return view
}

function randomBytes(size, callback) {
  if (typeof size === 'function') {
    callback = size
    size = undefined
  }
  const length = typeof size === 'number' ? size : 0
  const bytes = randomFill(new Uint8Array(length))
  if (callback) {
    callback(null, bytes)
    return
  }
  return bytes
}

function randomInt(min, max, callback) {
  let low = min
  let high = max
  if (typeof low !== 'number') low = 0
  if (high === undefined || typeof high === 'function') high = low + 1
  const value = Math.floor(Math.random() * (high - low)) + low
  if (typeof callback === 'function') {
    callback(null, value)
    return
  }
  return value
}

function randomUUID() {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID()
  return Array.from(randomFill(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

module.exports = {
  randomBytes,
  randomFillSync: randomFill,
  randomInt,
  randomUUID,
  createHash() {
    throw new Error('crypto.createHash is not available in the browser build')
  },
}
module.exports.default = module.exports
