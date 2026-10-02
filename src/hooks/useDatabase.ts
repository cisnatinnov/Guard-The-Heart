import { useEffect, useState } from 'react'
import { initializeAppDatabase } from '../db/database'

export type DatabaseStatus = 'loading' | 'ready' | 'error'

export interface DatabaseState {
  status: DatabaseStatus
  error: string | null
}

export function useDatabase(): DatabaseState {
  const [state, setState] = useState<DatabaseState>({ status: 'loading', error: null })

  useEffect(() => {
    let cancelled = false

    initializeAppDatabase()
      .then(() => {
        if (!cancelled) setState({ status: 'ready', error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setState({ status: 'error', error: message })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}