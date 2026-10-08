import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { TeamController } from '../controllers/TeamController'
import { useTeams } from '../hooks/useTeams'
import { BASE_TEAM_GUARD_POWER } from '../services/rankRules'

const PAGE_SIZE_OPTIONS = [5, 10, 20, 25, 50, 100] as const
type TeamStatusFilter = 'active' | 'inactive' | 'all'

export function TeamView() {
  const { teams, loading, error: loadError, reload } = useTeams({ includeInactive: true })
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [nameFilter, setNameFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<TeamStatusFilter>('active')

  const error = actionError ?? loadError
  const filteredTeams = useMemo(() => {
    const normalizedFilter = nameFilter.trim().toLocaleLowerCase()
    return teams.filter((team) => {
      const matchesName = team.name.toLocaleLowerCase().includes(normalizedFilter)
      const matchesStatus = statusFilter === 'all' || team.status === statusFilter
      return matchesName && matchesStatus
    })
  }, [nameFilter, statusFilter, teams])
  const pageCount = Math.max(1, Math.ceil(filteredTeams.length / pageSize))
  const visibleTeams = filteredTeams.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const firstVisibleTeam = filteredTeams.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const lastVisibleTeam = Math.min(currentPage * pageSize, filteredTeams.length)

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount))
  }, [pageCount])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      await reload()
      setActionError(null)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await run(async () => {
      await TeamController.create(trimmed)
      setName('')
    })
  }

  async function handleRename(event: FormEvent, id: string) {
    event.preventDefault()
    const trimmed = editingName.trim()
    if (!trimmed) return
    await run(async () => {
      await TeamController.rename(id, trimmed)
      setEditingId(null)
      setEditingName('')
    })
  }

  return (
    <section className="view">
      <header className="view__header">
        <h2>Teams</h2>
        <p className="view__hint">
          Create the teams that compete across every challenge. Each team starts with{' '}
          {BASE_TEAM_GUARD_POWER} GP and earns more from its challenge ranks.
        </p>
      </header>

      <form className="row-form" onSubmit={handleCreate}>
        <input
          type="text"
          value={name}
          maxLength={225}
          placeholder="New team name"
          aria-label="New team name"
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" disabled={busy || !name.trim()}>
          Add team
        </button>
      </form>

      {error && <p className="alert alert--error">{error}</p>}

      {loading && <p className="muted">Loading teams…</p>}

      {!loading && teams.length === 0 && (
        <p className="muted">No teams yet. Add your first one above.</p>
      )}

      {!loading && teams.length > 0 && (
        <div className="team-list-toolbar">
          <label className="field team-list-toolbar__filter">
            <span>Filter by name</span>
            <input
              type="search"
              value={nameFilter}
              placeholder="Search teams"
              aria-label="Filter teams by name"
              onChange={(event) => {
                setNameFilter(event.target.value)
                setCurrentPage(1)
              }}
            />
          </label>
          <label className="field team-list-toolbar__status">
            <span>Status</span>
            <select
              value={statusFilter}
              aria-label="Filter teams by status"
              onChange={(event) => {
                const status = event.target.value
                if (status === 'active' || status === 'inactive' || status === 'all') {
                  setStatusFilter(status)
                }
                setCurrentPage(1)
              }}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All teams</option>
            </select>
          </label>
          <label className="field team-list-toolbar__page-size">
            <span>Items per page</span>
            <select
              value={pageSize}
              aria-label="Items per page"
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setCurrentPage(1)
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {!loading && teams.length > 0 && filteredTeams.length === 0 && (
        <p className="muted">No teams match the current filters.</p>
      )}

      {!loading && visibleTeams.length > 0 && (
        <ul className="card-list">
          {visibleTeams.map((team) => (
            <li key={team.id} className="card">
              {editingId === team.id ? (
                <form className="row-form" onSubmit={(event) => handleRename(event, team.id)}>
                  <input
                    type="text"
                    value={editingName}
                    maxLength={225}
                    aria-label={`Rename ${team.name}`}
                    onChange={(event) => setEditingName(event.target.value)}
                  />
                  <button type="submit" disabled={busy || !editingName.trim()}>
                    Save
                  </button>
                  <button type="button" className="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="card__body">
                  <span className="card__title">{team.name}</span>
                  <div className="card__actions">
                    <span className={team.status === 'active' ? 'badge' : 'badge badge--muted'}>
                      {team.status}
                    </span>
                    <span className="badge" title="Guard power: 5 base plus challenge rewards">
                      GP {team.total_gp}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => TeamController.toggleStatus(team.id))}
                    >
                      {team.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setEditingId(team.id)
                        setEditingName(team.name)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy}
                      onClick={() => run(() => TeamController.remove(team.id))}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && teams.length > 0 && (
        <nav className="pagination" aria-label="Team list pages">
          <span className="pagination__summary" aria-live="polite">
            Showing {firstVisibleTeam}–{lastVisibleTeam} of {filteredTeams.length} teams
          </span>
          {pageCount > 1 && (
            <div className="pagination__controls">
              <button
                type="button"
                className="ghost"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                aria-label="Previous team page"
              >
                Previous
              </button>
              <div className="pagination__pages" aria-label="Select team page">
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={page === currentPage ? 'pagination__page pagination__page--active' : 'pagination__page'}
                    aria-label={`Page ${page}`}
                    aria-current={page === currentPage ? 'page' : undefined}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ghost"
                onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                disabled={currentPage === pageCount}
                aria-label="Next team page"
              >
                Next
              </button>
            </div>
          )}
        </nav>
      )}
    </section>
  )
}