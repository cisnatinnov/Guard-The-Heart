import { useCallback, useEffect, useState } from 'react'
import { ScoreboardController, type ScoreboardEntry } from '../controllers/ScoreboardController'
import { flushDatabase } from '../db/sequelize-provider'
import { useTeams } from '../hooks/useTeams'
import { MAX_TOTAL_CARD } from '../services/rankRules'

export function ScoreboardTotalView() {
  const { teams } = useTeams()
  const [entries, setEntries] = useState<ScoreboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // State is only written after the awaited query resolves.
  const load = useCallback(async () => {
    try {
      setEntries(await ScoreboardController.recalculate())
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleRecalculate() {
    setLoading(true)
    await load()
  }

  async function handlePersist() {
    setLoading(true)
    await flushDatabase()
    await load()
  }

  const teamNameById = new Map(teams.map((team) => [team.id, team.name]))

  return (
    <section className="view">
      <header className="view__header">
        <h2>Scoreboard total</h2>
        <p className="view__hint">
          Aggregated from every per-challenge entry, per team. Cards are capped at {MAX_TOTAL_CARD}.
        </p>
      </header>

      {error && <p className="alert alert--error">{error}</p>}
      {loading && <p className="muted">Calculating…</p>}

      {!loading && entries.length === 0 && <p className="muted">No scores recorded yet.</p>}

      {!loading && entries.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Total score</th>
                <th>CP</th>
                <th title={`Card total, capped at ${MAX_TOTAL_CARD}`}>Card / {MAX_TOTAL_CARD}</th>
                <th>GP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.rank}</td>
                  <td>{entry.teamRef?.name ?? teamNameById.get(entry.team) ?? '—'}</td>
                  <td>{entry.total_score}</td>
                  <td>{entry.total_cp}</td>
                  <td>{entry.total_card}</td>
                  <td>{entry.teamRef?.total_gp ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row-form">
        <button type="button" onClick={handleRecalculate} disabled={loading}>
          Recalculate
        </button>
        <button type="button" className="ghost" onClick={handlePersist} disabled={loading}>
          Save offline copy
        </button>
      </div>
    </section>
  )
}