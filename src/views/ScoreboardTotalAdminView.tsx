import { useCallback, useEffect, useState } from 'react'
import { ScoreboardController, type ScoreboardEntry } from '../controllers/ScoreboardController'
import { flushDatabase } from '../db/sequelize-provider'
import { useTeams } from '../hooks/useTeams'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import { DB_EVENTS } from '../hooks/useDbEvents'
import { MAX_TOTAL_CARD } from '../services/rankRules'

export function ScoreboardTotalAdminView() {
  const { teams } = useTeams()
  const [entries, setEntries] = useState<ScoreboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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
        <button type="button" onClick={handleRecalculate} disabled={loading || busy}>
          Recalculate
        </button>
        <button type="button" className="ghost" onClick={handlePersist} disabled={loading || busy}>
          Save offline copy
        </button>
      </div>

      {!loading && entries.length === 0 && <p className="muted">No scores recorded yet.</p>}

      {!loading && entries.length > 0 && (
        <div className="board-panel board-panel--leaderboard">
          <div className="board-banner board-banner--leaderboard">
            <span className="board-banner__title">Leaderboard</span>
          </div>
          <ol className="leaderboard" aria-label="Team leaderboard">
            {entries.map((entry) => (
              <li key={entry.id} className={`leaderboard__card leaderboard__card--${Math.min(entry.rank, 5)}`}>
                <span className="rank-badge rank-badge--large" aria-label={`Rank ${entry.rank}`}>
                  {entry.rank}
                </span>
                <span className="leaderboard__team">
                  {entry.teamRef?.name ?? teamNameById.get(entry.team) ?? '—'}
                </span>
                <span className="leaderboard__flag" aria-hidden="true">
                  <span className="leaderboard__flag-mark">▲</span>
                </span>
                <span className="leaderboard__label">Guard Power</span>
                <span className="leaderboard__gp">
                  {entry.teamRef?.total_gp ?? 0}
                  <small> GP</small>
                </span>
                <span className="leaderboard__cards" title={`Card total, capped at ${MAX_TOTAL_CARD}`}>
                  <span className="leaderboard__deck" aria-hidden="true" />
                  <span className="leaderboard__cards-text">
                    Card:
                    <strong>{entry.total_card}</strong>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}