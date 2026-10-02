import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

export type SqlJsStatic = Awaited<ReturnType<typeof initSqlJs>>
export type SqlJsDatabase = InstanceType<SqlJsStatic['Database']>
export type SqlValue = number | string | Uint8Array | null

let sqlJsPromise: Promise<SqlJsStatic> | null = null

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

export function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    // In the browser the bundle cannot resolve its own sibling assets, so the
    // emitted wasm URL is supplied. Under Node, sql.js resolves the wasm that
    // ships next to its own entry point.
    sqlJsPromise = isBrowserRuntime()
      ? initSqlJs({ locateFile: () => sqlWasmUrl })
      : initSqlJs()
  }
  return sqlJsPromise
}

type ErrorCallback = (err: Error | null) => void
type QueryCallback = (this: Sqlite3Connection, err: Error | null, rows?: Record<string, SqlValue>[]) => void

/**
 * Translates a raw sql.js/SQLite error into the `code`-tagged shape that
 * Sequelize's SQLite dialect expects when mapping constraint failures.
 */
function tagError(raw: unknown): Error {
  const error = raw instanceof Error ? raw : new Error(String(raw))
  const withCode = error as Error & { code?: string }
  if (withCode.code) return error
  const message = error.message
  if (/UNIQUE constraint failed/i.test(message)) withCode.code = 'SQLITE_CONSTRAINT_UNIQUE'
  else if (/FOREIGN KEY constraint failed/i.test(message)) withCode.code = 'SQLITE_CONSTRAINT_FOREIGNKEY'
  else if (/NOT NULL constraint failed/i.test(message)) withCode.code = 'SQLITE_CONSTRAINT_NOTNULL'
  else if (/CHECK constraint failed/i.test(message)) withCode.code = 'SQLITE_CONSTRAINT_CHECK'
  else if (/constraint failed/i.test(message)) withCode.code = 'SQLITE_CONSTRAINT'
  else if (/database is locked/i.test(message)) withCode.code = 'SQLITE_BUSY'
  return error
}

function rowsFromExec(result: { columns: string[]; values: SqlValue[][] }[]): Record<string, SqlValue>[] {
  const rows: Record<string, SqlValue>[] = []
  for (const chunk of result) {
    if (!chunk) continue
    const { columns, values } = chunk
    for (const valueRow of values) {
      const row: Record<string, SqlValue> = {}
      for (let i = 0; i < columns.length; i += 1) {
        row[columns[i]] = valueRow[i]
      }
      rows.push(row)
    }
  }
  return rows
}

export interface Sqlite3Connection {
  run(sql: string, ...args: unknown[]): Sqlite3Connection
  all(sql: string, ...args: unknown[]): Sqlite3Connection
  exec(sql: string, ...args: unknown[]): Sqlite3Connection
  serialize(callback: () => void): Sqlite3Connection
  close(callback?: ErrorCallback): Sqlite3Connection
  readonly filename: string
  lastID: number
  changes: number
}

export interface Sqlite3DriverModule {
  Database: new (filename: string, mode: number, callback?: (err: Error | null) => void) => Sqlite3Connection
  OPEN_READWRITE: number
  OPEN_CREATE: number
}

export interface SqlJsEngine {
  driver: Sqlite3DriverModule
  export(): Uint8Array
  setMutationListener(listener: (() => void) | null): void
}

/**
 * Builds a `sqlite3`-compatible driver backed by an in-memory sql.js/WASM
 * database. Sequelize's stock SQLite connection manager drives this module,
 * so every query still flows through Sequelize's ORM and query generator.
 */
export function createSqlJsEngine(SQL: SqlJsStatic, initialData?: Uint8Array | null): SqlJsEngine {
  let activeDb: SqlJsDatabase | null = null
  let mutationListener: (() => void) | null = null

  function registerActive(db: SqlJsDatabase): void {
    activeDb = db
  }

  function releaseActive(db: SqlJsDatabase): void {
    if (activeDb === db) activeDb = null
  }

  class SqlConnection implements Sqlite3Connection {
    readonly filename: string
    lastID = 0
    changes = 0

    private db: SqlJsDatabase

    constructor(filename: string, _mode: number, callback?: (err: Error | null) => void) {
      this.filename = filename
      this.db =
        initialData && initialData.length > 0 ? new SQL.Database(initialData) : new SQL.Database()
      initialData = null
      registerActive(this.db)
      // Defer so Sequelize can store the connection before the callback fires,
      // matching the asynchronous native sqlite3 driver contract.
      if (callback) queueMicrotask(() => callback(null))
    }

    exportBytes(): Uint8Array {
      return this.db.export()
    }

    private refreshMeta() {
      this.changes = this.db.getRowsModified()
      try {
        const rows = rowsFromExec(this.db.exec('SELECT last_insert_rowid() AS id'))
        const value = rows[0]?.id
        this.lastID = typeof value === 'number' ? value : 0
      } catch {
        this.lastID = 0
      }
    }

    run(sql: string, ...args: unknown[]): this {
      const callback = typeof args[args.length - 1] === 'function' ? (args.pop() as QueryCallback) : undefined
      const parameters = args.length > 0 && args[0] != null ? (args[0] as object | unknown[]) : []
      try {
        this.db.run(sql, parameters as never)
        this.refreshMeta()
        if (callback) callback.call(this, null)
        mutationListener?.()
      } catch (raw) {
        const error = tagError(raw)
        this.refreshMeta()
        if (callback) callback.call(this, error)
        else throw error
      }
      return this
    }

    all(sql: string, ...args: unknown[]): this {
      const callback = typeof args[args.length - 1] === 'function' ? (args.pop() as QueryCallback) : undefined
      const parameters = args.length > 0 && args[0] != null ? (args[0] as object | unknown[]) : undefined
      try {
        const rows = rowsFromExec(this.db.exec(sql, parameters as never))
        if (callback) callback.call(this, null, rows)
        return this
      } catch (raw) {
        const error = tagError(raw)
        if (callback) callback.call(this, error)
        else throw error
      }
      return this
    }

    exec(sql: string, ...args: unknown[]): this {
      const callback = typeof args[args.length - 1] === 'function' ? (args.pop() as ErrorCallback) : undefined
      try {
        this.db.run(sql)
        this.refreshMeta()
        if (callback) callback.call(this, null)
        mutationListener?.()
      } catch (raw) {
        const error = tagError(raw)
        if (callback) callback.call(this, error)
        else throw error
      }
      return this
    }

    serialize(callback: () => void): this {
      callback()
      return this
    }

    close(callback?: ErrorCallback): this {
      const db = this.db
      try {
        db.close()
        if (callback) callback.call(this, null)
      } catch (raw) {
        if (callback) callback.call(this, tagError(raw))
      }
      releaseActive(db)
      return this
    }
  }

  const driver: Sqlite3DriverModule = {
    Database: SqlConnection as unknown as Sqlite3DriverModule['Database'],
    OPEN_READWRITE: 2,
    OPEN_CREATE: 4,
  }

  return {
    driver,
    export() {
      if (!activeDb) throw new Error('No active SQLite connection to export')
      return activeDb.export()
    },
    setMutationListener(listener) {
      mutationListener = listener
    },
  }
}
