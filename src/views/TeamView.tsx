import { useState, type FormEvent } from 'react'
import { TeamController } from '../controllers/TeamController'
import { useTeams } from '../hooks/useTeams'
import { BASE_TEAM_GUARD_POWER } from '../services/rankRules'

interface TeamViewProps {
  onOpenTeamCards: (teamId: string) => void
}

export function TeamView({ onOpenTeamCards }: TeamViewProps) {
  const { teams, loading, error: loadError, reload } = useTeams()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const error = actionError ?? loadError

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

      {teams.length > 0 && (
        <ul className="card-list">
          {teams.map((team) => (
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
                      onClick={() => onOpenTeamCards(team.id)}
                    >
                      View Cards
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
    </section>
  )
}