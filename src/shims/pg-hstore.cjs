'use strict'

// Placeholder for the `pg-hstore` package. Sequelize statically requires the
// PostgreSQL dialect (even when another dialect is selected), so this module
// must exist to keep the browser bundle self-contained. The real parser is
// never invoked because this app talks to SQLite only.

function parse() {
  return {}
}

function stringify(value) {
  if (!value) return ''
  return Object.entries(value)
    .map(([key, entry]) => `${key}=>${entry}`)
    .join(', ')
}

module.exports = { parse, stringify }
module.exports.default = module.exports