import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { TeamController, type HeartTowerColumn } from '../controllers/TeamController'
import { BASE_TEAM_GUARD_POWER } from '../services/rankRules'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import { DB_EVENTS } from '../hooks/useDbEvents'

const EMPTY_TOWER: HeartTowerColumn[] = []
const TEAMS_PER_PAGE = 5
const CRYSTAL_COLORS = ['#007ff2', '#a34cf0', '#f258a2', '#15b9aa', '#e5a01b']

function crystalColor(teamId: string): string {
  const hash = Array.from(teamId).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
  return CRYSTAL_COLORS[hash % CRYSTAL_COLORS.length]
}

export function HeartOfAwarenessView() {
  const [columns, setColumns] = useState<HeartTowerColumn[]>(EMPTY_TOWER)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    console.log('[HeartOfAwareness] Loading data...')
    try {
      const rows = await TeamController.heartTower()
      console.log('[HeartOfAwareness] Loaded rows:', rows)
      setColumns(rows)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function runLoad() {
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

    void runLoad()
    return () => {
      active = false
    }
  }, [])

  // Real-time updates
  useDbEventRefresh([DB_EVENTS.TEAMS_CHANGED, DB_EVENTS.SCOREBOARD_CHANGED], () => {
    console.log('[HeartOfAwareness] Event received, triggering load')
    void load()
  })

  const totalGuardPower = columns.reduce((sum, column) => sum + column.team.total_gp, 0)
  const pageCount = Math.ceil(columns.length / TEAMS_PER_PAGE)
  const currentPage = Math.min(page, Math.max(1, pageCount))
  const visibleColumns = columns.slice((currentPage - 1) * TEAMS_PER_PAGE, currentPage * TEAMS_PER_PAGE)

  return (
    <section className="view heart-view">
      <header className="view__header heart-view__header">
        <h2>Heart of Awareness</h2>
        <p className="view__hint">
          The crystal heart shines for every active team. Each team begins with{' '}
          {BASE_TEAM_GUARD_POWER} GP.
        </p>
      </header>

      {error && <p className="alert alert--error">{error}</p>}
      {loading && <p className="muted">Reading guard power…</p>}

      {!loading && columns.length === 0 && (
        <p className="muted">No active teams yet. Add one on the Team tab.</p>
      )}

      {!loading && columns.length > 0 && (
        <>
          <div className="heart-scene" aria-hidden="true">
            <div className="heart-scene__art" />
            <div className="heart-scene__slots">
              {Array.from({ length: TEAMS_PER_PAGE }, (_, index) => {
                const column = visibleColumns[index]
                const scoreLength = String(column?.team.total_gp ?? '').length
                const scoreClassName =
                  scoreLength > 3
                    ? 'heart-scene__score heart-scene__score--small'
                    : scoreLength > 2
                      ? 'heart-scene__score heart-scene__score--compact'
                      : 'heart-scene__score'
                return (
                  <div
                    key={index}
                    className="heart-scene__slot"
                    style={
                      column
                        ? ({ '--crystal-color': crystalColor(column.team.id) } as CSSProperties)
                        : undefined
                    }
                  >
                    {column && <span className="heart-scene__gem heart-scene__gem--top" />}
                    <span className={scoreClassName}>{column?.team.total_gp}</span>
                    {column && <span className="heart-scene__gem heart-scene__gem--bottom" />}
                  </div>
                )
              })}
            </div>
          </div>

          <ol className="heart-roster" aria-label="Active team guard power">
            {visibleColumns.map(({ team, earned }) => (
              <li
                key={team.id}
                className="heart-roster__team"
                style={{ '--crystal-color': crystalColor(team.id) } as CSSProperties}
              >
                <span className="heart-roster__name">{team.name}</span>
                <span className="heart-roster__detail">5 GP · +{earned} earned</span>
              </li>
            ))}
          </ol>

          {pageCount > 1 && (
            <nav className="heart-view__pages" aria-label="Heart of Awareness pages">
              <button
                type="button"
                className="ghost"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>
                Teams {(currentPage - 1) * TEAMS_PER_PAGE + 1}–
                {Math.min(currentPage * TEAMS_PER_PAGE, columns.length)} of {columns.length}
              </span>
              <button
                type="button"
                className="ghost"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === pageCount}
              >
                Next
              </button>
            </nav>
          )}

          <p className="heart-view__total">
            <strong>{totalGuardPower} GP</strong> total across {columns.length} active{' '}
            {columns.length === 1 ? 'team' : 'teams'}
          </p>
        </>
      )}
    </section>
  )
}
