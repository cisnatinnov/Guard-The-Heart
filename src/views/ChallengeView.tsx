import { useState, type FormEvent } from 'react'
import { ChallengeController } from '../controllers/ChallengeController'
import { useChallenges } from '../hooks/useChallenges'

interface ChallengeViewProps {
  onOpenScoreboard: (challengeId: string) => void
}

export function ChallengeView({ onOpenScoreboard }: ChallengeViewProps) {
  const { challenges, loading, error: loadError, reload } = useChallenges()
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
      await ChallengeController.create(trimmed)
      setName('')
    })
  }

  async function handleRename(event: FormEvent, id: string) {
    event.preventDefault()
    const trimmed = editingName.trim()
    if (!trimmed) return
    await run(async () => {
      await ChallengeController.rename(id, trimmed)
      setEditingId(null)
      setEditingName('')
    })
  }

  return (
    <section className="view">
      <header className="view__header">
        <h2>Challenges</h2>
        <p className="view__hint">Create a challenge, then record its scoreboard.</p>
      </header>

      <form className="row-form" onSubmit={handleCreate}>
        <input
          type="text"
          value={name}
          maxLength={225}
          placeholder="New challenge name"
          aria-label="New challenge name"
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" disabled={busy || !name.trim()}>
          Add challenge
        </button>
      </form>

      {error && <p className="alert alert--error">{error}</p>}

      {loading && <p className="muted">Loading challenges…</p>}

      {!loading && challenges.length === 0 && (
        <p className="muted">No challenges yet. Add your first one above.</p>
      )}

      {challenges.length > 0 && (
        <ul className="card-list">
          {challenges.map((challenge) => (
            <li key={challenge.id} className="card">
              {editingId === challenge.id ? (
                <form className="row-form" onSubmit={(event) => handleRename(event, challenge.id)}>
                  <input
                    type="text"
                    value={editingName}
                    maxLength={225}
                    aria-label={`Rename ${challenge.name}`}
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
                  <span className="card__title">{challenge.name}</span>
                  <div className="card__actions">
                    <button type="button" onClick={() => onOpenScoreboard(challenge.id)}>
                      Scoreboard
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setEditingId(challenge.id)
                        setEditingName(challenge.name)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy}
                      onClick={() => run(() => ChallengeController.remove(challenge.id))}
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