import { rankGuardPointStandings } from '../services/rankRules'
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
  const { teams } = useTeams({ includeInactive: true })
  const [entries, setEntries] = useState<ScoreboardEntry[]>([])
  const [cardCounts, setCardCounts] = useState(new Map<string, number>())
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
      const [scores, cards] = await Promise.all([action(), ScoreboardController.availableCardCounts()])
      setEntries(scores)
      setCardCounts(cards)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(() => ScoreboardController.list())
  }, [load])

  // Real-time updates
  useDbEventRefresh([DB_EVENTS.SCOREBOARD_CHANGED, DB_EVENTS.TEAMS_CHANGED, DB_EVENTS.CARDS_CHANGED], () => {
    void load(() => ScoreboardController.list())
  })

  const teamNameById = new Map(teams.map((team) => [team.id, team.name]))
  const resolution = latestTacticalResolution(challenges.map((challenge) => challenge.id), true)
  const results = new Map((resolution?.teams ?? []).map((result) => [result.teamId, result]))
  const entryByTeam = new Map(entries.map((entry) => [entry.team, entry]))
  const rows = rankGuardPointStandings(teams.map((team) => {
    const entry = entryByTeam.get(team.id)
    const result = results.get(team.id)
    return {
      id: entry?.id ?? team.id,
      teamId: team.id,
      team: team.name ?? teamNameById.get(team.id) ?? '—',
      status: team.status,
      points: entry?.total_cp ?? 0,
      initialGP: result?.initialGP ?? team.total_gp ?? 0,
      guardPower: team.total_gp ?? 0,
      gigaRisk: result?.gigaRisk ?? 0,
      effects: result?.effects ?? [],
      remainingCards: cardCounts.get(team.id) ?? 0,
    }
  }))



  return (
    <section className="view view--public-ranking">
      <PublicRankingBoard
        variant="leaderboard"
        rows={rows}
        message={error ?? (loading ? 'Loading leaderboard…' : entries.length === 0 ? 'No scores recorded yet.' : undefined)}
      />
    </section>
  )
}
