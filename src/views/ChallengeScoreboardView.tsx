import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ChallengeScoreboardController } from '../controllers/ChallengeScoreboardController'
import { useChallenges } from '../hooks/useChallenges'
import { useTeams } from '../hooks/useTeams'
import type { ChallengeScoreEntry } from '../controllers/ChallengeScoreboardController'
import { MAX_ENTRIES_PER_CHALLENGE } from '../services/rankRules'

const EMPTY_FORM = { team: '', score: '' }
const EMPTY_ENTRIES: ChallengeScoreEntry[] = []

interface ChallengeScoreboardViewProps {
  selectedChallengeId: string | null
  onSelectChallenge: (challengeId: string) => void
}

export function ChallengeScoreboardView({
  selectedChallengeId,
  onSelectChallenge,
}: ChallengeScoreboardViewProps) {
  const { challenges } = useChallenges()
  const { teams } = useTeams()
  const [entriesByChallenge, setEntriesByChallenge] = useState<Record<string, ChallengeScoreEntry[]>>({})
  const [form, setForm] = useState(EMPTY_FORM)
  // The entry currently being corrected, or null when adding a new one.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeId = selectedChallengeId ?? challenges[0]?.id ?? null
  const entries = activeId ? (entriesByChallenge[activeId] ?? EMPTY_ENTRIES) : EMPTY_ENTRIES
  const isFull = entries.length >= MAX_ENTRIES_PER_CHALLENGE

  // Rows are cached per challenge, so switching challenges never shows stale
  // data and the effect writes state only after the awaited query resolves.
  const load = useCallback(async (challengeId: string | null) => {
    if (!challengeId) return
    try {
      const rows = await ChallengeScoreboardController.listByChallenge(challengeId)
      setEntriesByChallenge((current) => ({ ...current, [challengeId]: rows }))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [])

  useEffect(() => {
    void load(activeId)
  }, [activeId, load])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      await load(activeId)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!activeId || !form.team) return
    await run(async () => {
      if (editingId) {
        // Correcting an existing entry keeps the team and its rank in place, so
        // the rewards and bonus cards are recalculated rather than revoked.
        await ChallengeScoreboardController.update(editingId, {
          score: Number(form.score) || 0,
        })
      } else {
        await ChallengeScoreboardController.create({
          challenge: activeId,
          team: form.team,
          score: Number(form.score) || 0,
        })
      }
      setForm(EMPTY_FORM)
      setEditingId(null)
    })
  }

  // Switching challenge abandons an in-progress correction.
  function handleSelectChallenge(challengeId: string) {
    setEditingId(null)
    setForm(EMPTY_FORM)
    onSelectChallenge(challengeId)
  }

  function startEdit(entry: ChallengeScoreEntry) {
    setEditingId(entry.id)
    setForm({ team: entry.team, score: String(entry.score) })
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleDelete(id: string) {
    await run(async () => {
      await ChallengeScoreboardController.remove(id)
      if (editingId === id) cancelEdit()
    })
  }

  const updateField = (key: keyof typeof EMPTY_FORM) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const scoredTeamIds = new Set(entries.map((entry) => entry.team))
  const availableTeams = teams.filter(
    (team) => !scoredTeamIds.has(team.id) || team.id === form.team,
  )

  if (challenges.length === 0) {
    return (
      <section className="view">
        <header className="view__header">
          <h2>Scoreboard per challenge</h2>
          <p className="view__hint">Every entry feeds the overall scoreboard total.</p>
        </header>
        <p className="muted">No challenges are available yet.</p>
      </section>
    )
  }

  return (
    <section className="view">
      <header className="view__header">
        <h2>Scoreboard per challenge</h2>
        <p className="view__hint">
          Rank and points are derived from the score. Up to {MAX_ENTRIES_PER_CHALLENGE} teams per
          challenge.
        </p>
      </header>

      {teams.length === 0 ? (
        <p className="muted">Create a team first to record scores.</p>
      ) : (
        <>
          <div className="row-form">
            <label className="field">
              <span>Challenge</span>
              <select
                value={activeId ?? ''}
                onChange={(event) => handleSelectChallenge(event.target.value)}
              >
                {challenges.map((challenge) => (
                  <option key={challenge.id} value={challenge.id}>
                    {challenge.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="alert alert--error">{error}</p>}

          {isFull && !editingId && (
            <p className="alert alert--info">
              This challenge already holds the maximum of {MAX_ENTRIES_PER_CHALLENGE} entries.
              Delete one to make room.
            </p>
          )}

          <form className="grid-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>{editingId ? 'Team (correcting)' : 'Team'}</span>
              <select
                value={form.team}
                onChange={updateField('team')}
                required
                disabled={busy || editingId !== null}
              >
                <option value="">Select team…</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Score</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={999}
                value={form.score}
                onChange={updateField('score')}
                disabled={busy}
              />
            </label>
            <button type="submit" className="grid-form__submit" disabled={busy || !form.team}>
              {editingId ? 'Update score' : 'Add entry'}
            </button>
            {editingId && (
              <button type="button" className="ghost" onClick={cancelEdit} disabled={busy}>
                Cancel
              </button>
            )}
          </form>

          {entries.length === 0 ? (
            <p className="muted">No entries for this challenge yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Score</th>
                    <th>CP</th>
<th title="Guard power earned in this challenge">GP earned</th>
                    <th title="Team total guard power">GP total</th>
                    <th>Card</th>
                    <th aria-label="Row actions" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.rank}</td>
                      <td>{entry.teamRef?.name ?? '—'}</td>
                      <td>{entry.score}</td>
                      <td>{entry.challenge_point}</td>
                      <td>{entry.guard_power}</td>
                      <td>{entry.teamRef?.total_gp ?? 0}</td>
                      <td>{entry.card}</td>
                      <td className="table-wrap__actions">
                        <button
                          type="button"
                          className="ghost"
                          disabled={busy}
                          onClick={() => startEdit(entry)}
                        >
                          Edit score
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={busy}
                          onClick={() => handleDelete(entry.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}