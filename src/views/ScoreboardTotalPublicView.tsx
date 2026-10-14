import { competitionRanks } from '../services/rankRules'
import { useCallback, useEffect, useState } from 'react'
import { ScoreboardController, type ScoreboardEntry } from '../controllers/ScoreboardController'
import { useTeams } from '../hooks/useTeams'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import { DB_EVENTS } from '../hooks/useDbEvents'
import { PublicRankingBoard } from './PublicRankingBoard'
import { useChallenges } from '../hooks/useChallenges'
import { latestTacticalResolution } from '../services/tacticalPhase'

export function ScoreboardTotalPublicView() {
  const { challenges } = useChallenges()
  const { teams } = useTeams()
  const [entries, setEntries] = useState<ScoreboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, refreshTactical] = useState(0)

  useEffect(() => {
    const refresh = () => refreshTactical((value) => value + 1)
    window.addEventListener('guard-the-heart:tactical', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('guard-the-heart:tactical', refresh); window.removeEventListener('storage', refresh) }
  }, [])

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
  const resolution = latestTacticalResolution(challenges.map((challenge) => challenge.id))
  const results = new Map((resolution?.teams ?? []).map((result) => [result.teamId, result]))
  const entryByTeam = new Map(entries.map((entry) => [entry.team, entry]))
  const rows = teams.map((team) => {
    const entry = entryByTeam.get(team.id)
    const result = results.get(team.id)
    return {
      id: entry?.id ?? team.id,
      teamId: team.id,
      team: team.name ?? teamNameById.get(team.id) ?? '—',
      points: entry?.total_cp ?? 0,
      initialGP: result?.initialGP ?? team.total_gp ?? 0,
      guardPower: team.total_gp ?? 0,
      gigaRisk: result?.gigaRisk ?? 0,
      effects: result?.effects ?? [],
      remainingCards: entry?.total_card ?? 0,
    }
  }).sort((a, b) => b.guardPower - a.guardPower || a.team.localeCompare(b.team))

  const ranks = competitionRanks(rows.map((row) => row.guardPower))

  return (
    <section className="view view--public-ranking">
      <PublicRankingBoard
        variant="leaderboard"
        rows={rows.map((row, index) => ({ ...row, rank: ranks[index] }))}
        message={error ?? (loading ? 'Loading leaderboard…' : entries.length === 0 ? 'No scores recorded yet.' : undefined)}
      />
    </section>
  )
}
