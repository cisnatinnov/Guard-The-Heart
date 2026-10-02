'use strict'

// The browser build only ever uses Sequelize's in-memory SQLite storage, so the
// filesystem is intentionally inert. These no-ops keep the module importable.

function notAvailable(name) {
  return function unavailable() {
    throw new Error(`fs.${name} is not available in the browser build`)
  }
}

module.exports = {
  existsSync: () => false,
  mkdirSync: () => undefined,
  mkdtempSync: notAvailable('mkdtempSync'),
  readFileSync: notAvailable('readFileSync'),
  writeFileSync: notAvailable('writeFileSync'),
  promises: {
    readFile: () => Promise.reject(new Error('fs.promises.readFile is not available')),
    writeFile: () => Promise.reject(new Error('fs.promises.writeFile is not available')),
    mkdir: () => Promise.resolve(),
  },
}
module.exports.default = module.exports
