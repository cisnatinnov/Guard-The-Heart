'use strict'

const sep = '/'
const delimiter = ':'

function normalize(path) {
  if (!path) return '.'
  const isAbsolute = path.startsWith('/')
  const parts = path.split('/').filter((part) => part && part !== '.')
  const stack = []
  for (const part of parts) {
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  let result = stack.join('/')
  if (isAbsolute) result = `/${result}`
  return result || (isAbsolute ? '/' : '.')
}

function join(...segments) {
  return normalize(segments.filter((segment) => typeof segment === 'string' && segment.length > 0).join('/'))
}

function dirname(path) {
  if (!path) return '.'
  const trimmed = path.replace(/\/+$/, '')
  const index = trimmed.lastIndexOf('/')
  if (index === -1) return '.'
  if (index === 0) return '/'
  return trimmed.slice(0, index)
}

function basename(path, ext) {
  const trimmed = String(path).replace(/\/+$/, '')
  const index = trimmed.lastIndexOf('/')
  let base = index === -1 ? trimmed : trimmed.slice(index + 1)
  if (ext && base.endsWith(ext)) base = base.slice(0, -ext.length)
  return base
}

function extname(path) {
  const base = basename(path)
  const index = base.lastIndexOf('.')
  return index <= 0 ? '' : base.slice(index)
}

function resolve(...segments) {
  let resolved = ''
  let absolute = false
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i]
    if (typeof segment !== 'string' || segment.length === 0) continue
    resolved = `${segment}/${resolved}`
    if (segment.startsWith('/')) {
      absolute = true
      break
    }
  }
  const normalized = normalize(resolved)
  return absolute || normalized.startsWith('/') ? normalized : `/${normalized}`
}

function isAbsolute(path) {
  return typeof path === 'string' && path.startsWith('/')
}

function relative(from, to) {
  const fromParts = normalize(from).split('/').filter(Boolean)
  const toParts = normalize(to).split('/').filter(Boolean)
  let i = 0
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i += 1
  const up = fromParts.slice(i).map(() => '..')
  return [...up, ...toParts.slice(i)].join('/') || ''
}

const posix = { sep, delimiter, normalize, join, dirname, basename, extname, resolve, isAbsolute, relative }

module.exports = { sep, delimiter, normalize, join, dirname, basename, extname, resolve, isAbsolute, relative, posix }
module.exports.default = module.exports
