import { useCallback, useEffect, useState } from 'react'
import { ScoreboardController, type ScoreboardEntry } from '../controllers/ScoreboardController'
import { useTeams } from '../hooks/useTeams'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import { DB_EVENTS } from '../hooks/useDbEvents'
import { PublicRankingBoard } from './PublicRankingBoard'

export function ScoreboardTotalPublicView() {
  const { teams } = useTeams()
  const [entries, setEntries] = useState<ScoreboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (action: () => Promise<ScoreboardEntry[]>) => {
    try {
      setEntries(await action())
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(() => ScoreboardController.recalculate())
  }, [load])

  // Real-time updates
  useDbEventRefresh([DB_EVENTS.SCOREBOARD_CHANGED, DB_EVENTS.TEAMS_CHANGED], () => {
    void load(() => ScoreboardController.recalculate())
  })

  const teamNameById = new Map(teams.map((team) => [team.id, team.name]))

  return (
    <section className="view view--public-ranking">
      <PublicRankingBoard
        variant="leaderboard"
        rows={entries.map((entry) => ({
          id: entry.id,
          rank: entry.rank,
          team: entry.teamRef?.name ?? teamNameById.get(entry.team) ?? '—',
          points: entry.total_cp,
          guardPower: entry.teamRef?.total_gp ?? 0,
        }))}
        message={error ?? (loading ? 'Loading leaderboard…' : entries.length === 0 ? 'No scores recorded yet.' : undefined)}
      />
    </section>
  )
}
