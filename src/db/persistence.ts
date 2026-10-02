const DB_NAME = 'guard-the-heart'
const STORE_NAME = 'sqlite'
const DB_VERSION = 1
const DB_FILE_KEY = 'database'

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })
}

export async function loadDatabaseBytes(): Promise<Uint8Array | null> {
  if (!hasIndexedDb()) return null
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(DB_FILE_KEY)
    request.onsuccess = () => {
      const value = request.result
      if (value instanceof Uint8Array) resolve(value)
      else if (value instanceof ArrayBuffer) resolve(new Uint8Array(value))
      else if (ArrayBuffer.isView(value)) resolve(new Uint8Array((value as ArrayBufferView).buffer))
      else resolve(null)
    }
    request.onerror = () => reject(request.error ?? new Error('Failed to read SQLite database'))
    tx.oncomplete = () => db.close()
  })
}

export async function saveDatabaseBytes(bytes: Uint8Array): Promise<void> {
  if (!hasIndexedDb()) return
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(bytes, DB_FILE_KEY)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error ?? new Error('Failed to persist SQLite database'))
  })
}

export async function clearDatabaseBytes(): Promise<void> {
  if (!hasIndexedDb()) return
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(DB_FILE_KEY)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error ?? new Error('Failed to clear SQLite database'))
  })
}
