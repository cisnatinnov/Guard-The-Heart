import { Sequelize } from 'sequelize'
import { createSqlJsEngine, loadSqlJs, type SqlJsEngine } from './sqljs-engine'
import { loadDatabaseBytes, saveDatabaseBytes } from './persistence'

let sequelizeInstance: Sequelize | null = null
let engineInstance: SqlJsEngine | null = null
let initializePromise: Promise<Sequelize> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let databaseDirty = false
let saveQueue: Promise<void> = Promise.resolve()

const SAVE_DEBOUNCE_MS = 150

/** Serialize startup, card-pool operations and combat across tabs. */
export async function withDatabaseWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('guard-the-heart-database-write', operation)
  }
  return operation()
}

async function flushToStorage(): Promise<void> {
  if (!engineInstance || !databaseDirty) return saveQueue
  const bytes = engineInstance.export()
  databaseDirty = false
  saveQueue = saveQueue.then(() => saveDatabaseBytes(bytes)).catch((error: unknown) => {
    databaseDirty = true
    console.error('Failed to persist SQLite database', error)
  })
  await saveQueue
}

function scheduleSave(): void {
  databaseDirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void flushToStorage()
  }, SAVE_DEBOUNCE_MS)
}

function createSequelize(): Sequelize {
  if (sequelizeInstance) return sequelizeInstance
  if (!engineInstance) throw new Error('SQLite engine not ready')

  // Sequelize's stock SQLite connection manager drives this module instead of
  // the native `sqlite3` package, which cannot run inside a browser.
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
    define: {
      freezeTableName: true,
    },
    dialectModule: engineInstance.driver,
  } as never)

  sequelizeInstance = sequelize
  return sequelize
}

export function getSequelize(): Sequelize {
  if (!sequelizeInstance) throw new Error('Database has not been initialized yet')
  return sequelizeInstance
}

export async function initDatabase(): Promise<Sequelize> {
  if (sequelizeInstance) return sequelizeInstance
  if (initializePromise) return initializePromise

  initializePromise = (async () => {
    const [sqlJs, persisted] = await Promise.all([loadSqlJs(), loadDatabaseBytes()])
    engineInstance = createSqlJsEngine(sqlJs, persisted)
    engineInstance.setMutationListener(scheduleSave)

    const sequelize = createSequelize()
    await sequelize.authenticate()
    return sequelize
  })()

  try {
    return await initializePromise
  } finally {
    initializePromise = null
  }
}

export async function flushDatabase(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  await flushToStorage()
}

/** Replace this tab's in-memory SQLite contents with the latest saved copy. */
export async function refreshDatabaseFromStorage(): Promise<void> {
  // A late public-window notification must not discard local uncommitted writes.
  if (databaseDirty) return
  await saveQueue
  const [persisted] = await Promise.all([loadDatabaseBytes()])
  if (!persisted?.length || !engineInstance || databaseDirty) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  engineInstance.reload(persisted)
}
