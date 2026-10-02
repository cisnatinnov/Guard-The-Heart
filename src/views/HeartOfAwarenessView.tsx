import { useEffect, useState } from 'react'
import { TeamController, type HeartTowerColumn } from '../controllers/TeamController'
import { flushDatabase } from '../db/sequelize-provider'
import { BASE_TEAM_GUARD_POWER } from '../services/rankRules'

const EMPTY_TOWER: HeartTowerColumn[] = []

/** Solid base every team starts from, drawn under the earned segments. */
const BASE_SEGMENTS = 3
const MAX_EARNED_SEGMENTS = 30

function segmentsFor(column: HeartTowerColumn): number {
  return BASE_SEGMENTS + Math.min(MAX_EARNED_SEGMENTS, column.earned)
}

export function HeartOfAwarenessView() {
  const [columns, setColumns] = useState<HeartTowerColumn[]>(EMPTY_TOWER)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // State is only written after the awaited query resolves.
  useEffect(() => {
    let active = true

    async function load() {
      try {
        const rows = await TeamController.heartTower()
        if (active) {
          setColumns(rows)
          setError(null)
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  async function handleRefresh() {
    setLoading(true)
    try {
      setColumns(await TeamController.heartTower())
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }

  async function handlePersist() {
    setLoading(true)
    await flushDatabase()
    await handleRefresh()
  }

  const totalGuardPower = columns.reduce((sum, column) => sum + column.team.total_gp, 0)
  const tallest = columns.reduce((max, column) => Math.max(max, segmentsFor(column)), 0)

  return (
    <section className="view">
      <header className="view__header">
        <h2>Heart of Awareness</h2>
        <p className="view__hint">
          The tower rises with the guard power of active teams. Every team stands on{' '}
          {BASE_TEAM_GUARD_POWER} GP; inactive teams drop out of the tower.
        </p>
      </header>

      {error && <p className="alert alert--error">{error}</p>}
      {loading && <p className="muted">Reading guard power…</p>}

      {!loading && columns.length === 0 && (
        <p className="muted">No active teams to raise. Add one on the Team tab.</p>
      )}

      {!loading && columns.length > 0 && (
        <>
          <div className="hero-stat">
            <span className="hero-stat__label">Total guard power</span>
            <span className="hero-stat__value">{totalGuardPower}</span>
            <span className="muted">
              across {columns.length} active {columns.length === 1 ? 'team' : 'teams'}
            </span>
          </div>

          <div className="tower" role="list" aria-label="Guard power tower by team">
            {columns.map((column) => {
              const { team, earned } = column
              const earnedSegments = Math.min(MAX_EARNED_SEGMENTS, earned)
              return (
                <div
                  key={team.id}
                  role="listitem"
                  className="tower__column"
                  // Columns share one scale so the tallest tower defines the height.
                  style={{ height: `${(segmentsFor(column) / Math.max(1, tallest)) * 100}%` }}
                >
                  <div className="tower__beacon">{team.total_gp}</div>
                  <div className="tower__stack">
                    {Array.from({ length: earnedSegments }, (_, index) => (
                      <span
                        key={index}
                        className="tower__block"
                        style={{ opacity: 1 - index / (earnedSegments + 2) }}
                      />
                    ))}
                    {Array.from({ length: BASE_SEGMENTS }, (_, index) => (
                      <span key={`base-${index}`} className="tower__block tower__block--base" />
                    ))}
                  </div>
                  <span className="tower__label">{team.name}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="row-form">
        <button type="button" onClick={handleRefresh} disabled={loading}>
          Recalculate
        </button>
        <button type="button" className="ghost" onClick={handlePersist} disabled={loading}>
          Save offline copy
        </button>
      </div>
    </section>
  )
}
