const pending = new Map<string, Promise<unknown>>()

/** Serialize physical moves across host/public tabs, then read the latest board. */
export async function withPlayLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(`fight-the-dragon-play:${key}`, action)
  }
  const previous = pending.get(key) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(action)
  pending.set(key, next)
  try { return await next }
  finally { if (pending.get(key) === next) pending.delete(key) }
}
