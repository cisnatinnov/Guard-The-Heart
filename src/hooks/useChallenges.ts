import { useCallback, useEffect, useState } from 'react'
import { ChallengeController } from '../controllers/ChallengeController'
import type { Challenge } from '../models'

export function useChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // The first state update always happens after the awaited query, so the
  // effect never triggers a synchronous cascading render.
  const reload = useCallback(async () => {
    try {
      const list = await ChallengeController.list()
      setChallenges(list)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { challenges, loading, error, reload }
}