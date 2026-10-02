'use strict'

// Minimal legacy `url` surface. Sequelize only touches `url.parse` when a
// connection string is supplied, which this app never does; the rest keeps the
// module importable and safe.

function parse(urlString, parseQueryString) {
  const result = {
    href: String(urlString),
    protocol: null,
    host: null,
    hostname: null,
    port: null,
    pathname: null,
    search: null,
    query: parseQueryString ? {} : null,
    hash: null,
  }
  try {
    const parsed = new URL(String(urlString))
    result.protocol = parsed.protocol
    result.host = parsed.host
    result.hostname = parsed.hostname
    result.port = parsed.port || null
    result.pathname = parsed.pathname
    result.search = parsed.search || null
    result.hash = parsed.hash || null
    result.query = parseQueryString ? Object.fromEntries(parsed.searchParams.entries()) : parsed.search
  } catch {
    // fall through with defaults
  }
  return result
}

function format(urlObject) {
  if (typeof urlObject === 'string') return urlObject
  const protocol = urlObject.protocol || ''
  const slashes = protocol ? '//' : ''
  const auth = urlObject.auth ? `${urlObject.auth}@` : ''
  const host = urlObject.host || urlObject.hostname || ''
  const pathname = urlObject.pathname || ''
  let query = ''
  if (urlObject.query && typeof urlObject.query === 'object') {
    const params = new URLSearchParams(urlObject.query)
    query = params.toString() ? `?${params.toString()}` : ''
  } else if (typeof urlObject.search === 'string') {
    query = urlObject.search
  }
  const hash = urlObject.hash || ''
  return `${protocol}${slashes}${auth}${host}${pathname}${query}${hash}`
}

function resolve(from, to) {
  return new URL(to, from).href
}

module.exports = { parse, format, resolve, URL: globalThis.URL, URLSearchParams: globalThis.URLSearchParams }
module.exports.default = module.exports
