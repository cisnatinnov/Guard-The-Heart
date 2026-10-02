// Provides the `Buffer` global that Sequelize's data types expect. This module
// must be imported before anything that pulls in Sequelize so the global exists
// while those modules initialise.
import { Buffer } from 'buffer'

const globalWithBuffer = globalThis as typeof globalThis & { Buffer?: typeof Buffer }

if (typeof globalWithBuffer.Buffer === 'undefined') {
  globalWithBuffer.Buffer = Buffer
}

export {}