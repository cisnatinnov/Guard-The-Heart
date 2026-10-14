import { useCallback, useEffect, useState } from 'react'
import { TeamController } from '../controllers/TeamController'
import type { Team } from '../models'
import { useDbEventRefresh } from './useDbEventRefresh'
import { DB_EVENTS } from './useDbEvents'
const TEAM_REFRESH_EVENTS = [DB_EVENTS.TEAMS_CHANGED, DB_EVENTS.GP_TRANSACTIONS_CHANGED]

export function useTeams(options: { includeInactive?: boolean } = {}) {
  const { includeInactive = false } = options
  const [teams, setTeams] = useState<Team[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // State updates only happen after the awaited query resolves.
  const reload = useCallback(async () => {
    try {
      setTeams(await TeamController.list({ includeInactive }))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [includeInactive])

  useEffect(() => {
    void reload()
  }, [reload])

  useDbEventRefresh(TEAM_REFRESH_EVENTS, () => { void reload() })

  return { teams, loading, error, reload }
}
