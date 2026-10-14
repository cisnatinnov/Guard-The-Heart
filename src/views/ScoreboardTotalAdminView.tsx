import { competitionRanks } from '../services/rankRules'
import { useCallback, useEffect, useState } from 'react'
import { ScoreboardController, type ScoreboardEntry } from '../controllers/ScoreboardController'
import { flushDatabase } from '../db/sequelize-provider'
import { useTeams } from '../hooks/useTeams'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import { DB_EVENTS } from '../hooks/useDbEvents'
import { MAX_TOTAL_CARD } from '../services/rankRules'
import { useChallenges } from '../hooks/useChallenges'
import { latestTacticalResolution } from '../services/tacticalPhase'
import { PublicRankingBoard } from './PublicRankingBoard'
import { publishPublicDisplay } from '../services/publicDisplay'

export function ScoreboardTotalAdminView() {
  const { challenges } = useChallenges()
  const { teams } = useTeams()
  const [entries, setEntries] = useState<ScoreboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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

  async function handleRecalculate() {
    setBusy(true)
    setNotice(null)
    await load(() => ScoreboardController.recalculate())
    setNotice('Leaderboard recalculated.')
    setBusy(false)
  }

  async function handlePersist() {
    setBusy(true)
    setNotice(null)
    try {
      await flushDatabase()
      setNotice('Offline copy saved.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
    await load(() => ScoreboardController.recalculate())
    setBusy(false)
  }

  const teamNameById = new Map(teams.map((team) => [team.id, team.name]))
  const resolution = latestTacticalResolution(challenges.map((challenge) => challenge.id))
  const results = new Map((resolution?.teams ?? []).map((result) => [result.teamId, result]))
  const entryByTeam = new Map(entries.map((entry) => [entry.team, entry]))
  const rows = teams.map((team) => {
    const entry = entryByTeam.get(team.id)
    const result = results.get(team.id)
    return {
      id: entry?.id ?? team.id,
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
    <section className="view">
      <header className="view__header">
        <h2>Leaderboard (Adm)</h2>
        <p className="view__hint">Aggregated from every per-challenge entry, per team. Cards are capped at {MAX_TOTAL_CARD}.</p>
      </header>

      {error && <p className="alert alert--error">{error}</p>}
      {notice && <p className="alert alert--info">{notice}</p>}
      {loading && <p className="muted">Loading leaderboard…</p>}

      <div className="row-form">
        <button type="button" disabled={loading || busy} onClick={() => { window.open('/leaderboard', '_blank', 'noopener'); void publishPublicDisplay('leaderboard', '').catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause))) }}>Show Leaderboard (Public)</button>
        <button type="button" onClick={handleRecalculate} disabled={loading || busy}>
          Recalculate
        </button>
        <button type="button" className="ghost" onClick={handlePersist} disabled={loading || busy}>
          Save offline copy
        </button>
      </div>

      {!loading && entries.length === 0 && <p className="muted">No scores recorded yet.</p>}

      {!loading && <div className="scoreboard-admin-reference"><PublicRankingBoard variant="leaderboard"
        rows={rows.map((row, index) => ({ ...row, rank: ranks[index] }))}
        message={error ?? (rows.length === 0 ? 'No scores recorded yet.' : undefined)}
      /></div>}
    </section>
  )
}
