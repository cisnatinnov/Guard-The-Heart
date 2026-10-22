import { PublicRankingBoard } from './PublicRankingBoard'
import { displayPath, publishPublicDisplay } from '../services/publicDisplay'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChallengePointController } from '../controllers/ChallengePointController'
import { CardController } from '../controllers/CardController'
import { useChallenges } from '../hooks/useChallenges'
import { useTeams } from '../hooks/useTeams'
import type { ChallengePointEntry } from '../controllers/ChallengePointController'
import type { Card } from '../models'
import { MAX_ENTRIES_PER_CHALLENGE } from '../services/rankRules'

const EMPTY_FORM = { team: '', score: '' }
const EMPTY_ENTRIES: ChallengePointEntry[] = []

export function ChallengePointAdminView() {
  const { challenges } = useChallenges()
  const { teams } = useTeams()
  const params = useParams<{ challengeId?: string }>()
  const navigate = useNavigate()
  const [entriesByChallenge, setEntriesByChallenge] = useState<Record<string, ChallengePointEntry[]>>({})
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drawnCards, setDrawnCards] = useState<Card[]>([])
  const [isDrawn, setIsDrawn] = useState(false)
  const [checkingDraw, setCheckingDraw] = useState(false)

  const activeId = params.challengeId ?? challenges[0]?.id ?? null
  const entries = activeId ? (entriesByChallenge[activeId] ?? EMPTY_ENTRIES) : EMPTY_ENTRIES
  const isFull = entries.length >= MAX_ENTRIES_PER_CHALLENGE
  const activeChallenge = challenges.find((challenge) => challenge.id === activeId)

  const load = useCallback(async (challengeId: string | null) => {
    if (!challengeId) return
    try {
      const rows = await ChallengePointController.listByChallenge(challengeId)
      setEntriesByChallenge((current) => ({ ...current, [challengeId]: rows }))
      
      // Check if cards are drawn for this challenge
      const drawn = await CardController.isChallengeCardsDrawn(challengeId)
      setIsDrawn(drawn)
      if (drawn) {
        const cards = await CardController.listChallengeBonusCards(challengeId)
        setDrawnCards(cards)
      } else {
        setDrawnCards([])
      }
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
        await ChallengePointController.update(editingId, {
          score: Number(form.score) || 0,
        })
      } else {
        await ChallengePointController.create({
          challenge: activeId,
          team: form.team,
          score: Number(form.score) || 0,
        })
      }
      setForm(EMPTY_FORM)
      setEditingId(null)
    })
  }

  function handleSelectChallenge(challengeId: string) {
    setEditingId(null)
    setForm(EMPTY_FORM)
    void publishPublicDisplay('scoreboard', challengeId).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
    navigate(`/admin/scoreboard/${challengeId}`)
  }

  function startEdit(entry: ChallengePointEntry) {
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
      await ChallengePointController.remove(id)
      if (editingId === id) cancelEdit()
    })
  }

  async function handleDrawCards() {
    if (!activeId) return
    setCheckingDraw(true)
    setError(null)
    try {
      const cards = await CardController.drawBonusCards(activeId)
      setDrawnCards(cards)
      setIsDrawn(true)
      await load(activeId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setCheckingDraw(false)
    }
  }

  async function claimRewards() {
    if (!activeId) return
    await run(async () => {
      if (isFull && !(await CardController.isChallengeCardsDrawn(activeId))) {
        await CardController.drawBonusCards(activeId)
      }
      await publishPublicDisplay('rewards', activeId)
      navigate(displayPath({ stage: 'rewards', challengeId: activeId }, true))
    })
  }

  const updateField = (key: keyof typeof EMPTY_FORM) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const scoredTeamIds = new Set(entries.map((entry) => entry.team))
  const availableTeams = teams.filter(
    (team) => !scoredTeamIds.has(team.id) || team.id === form.team,
  )

  const header = (
    <header className="view__header view__header--split">
      <div>
        <h2>Scoreboard per challenge (Adm)</h2>
        <p className="view__hint">
          Rank is determined by score. Challenge points and GP are awarded by rank. Up to {MAX_ENTRIES_PER_CHALLENGE} teams per challenge.
        </p>
      </div>
    </header>
  )

  if (challenges.length === 0) {
    return (
      <section className="view">
        {header}
        <p className="muted">No challenges are available yet.</p>
      </section>
    )
  }

  return (
    <section className="view">
      {header}

      {teams.length === 0 && <p className="muted">Create a team first to record challenge points.</p>}

      {teams.length > 0 && (
        <>
          <div className="row-form">
            <label className="field">
              <span>Challenge</span>
              <select value={activeId ?? ''} onChange={(event) => handleSelectChallenge(event.target.value)}>
                {challenges.map((challenge) => (
                  <option key={challenge.id} value={challenge.id}>
                    {challenge.name}
                  </option>
                ))}
              </select>
            </label>
            {activeId && <>
              <button type="button" disabled={busy || checkingDraw || !entries.length} onClick={claimRewards}>Claim Rewards</button>
            </>}
          </div>

          {activeId && isFull && !isDrawn && (
            <div className="row-form">
              <button
                type="button"
                className="grid-form__submit"
                onClick={handleDrawCards}
                disabled={busy || checkingDraw}
              >
                {checkingDraw ? 'Drawing…' : 'Draw Bonus Cards'}
              </button>
            </div>
          )}

          {activeId && isDrawn && (
            <p className="alert alert--info">
              Bonus cards already drawn for this challenge. <strong>{drawnCards.length}</strong> card(s) added to pool.
              <br />
              Available rewards are assigned automatically. Open <strong>Claim Rewards</strong>, then <strong>Tactical Phase</strong> to choose cards.
            </p>
          )}

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
                min={-999}
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
        </>
      )}

      {error && <p className="alert alert--error">{error}</p>}

      <PublicRankingBoard
        variant="scoreboard"
        guardPoints={teams.map(team=>({id:team.id,team:team.name,guardPower:team.total_gp}))}
        challenge={activeChallenge?.name}
        rows={entries.map((entry) => ({ id: entry.id, rank: entry.rank, team: entry.teamRef?.name ?? '—', points: entry.score }))}
      />
      {entries.length > 0 && <div className="scoreboard-admin-actions" aria-label="Edit challenge results">
        {entries.map((entry) => <div className="board__row" key={entry.id}>
          <span>{entry.teamRef?.name ?? '—'} · {entry.score} score · {entry.challenge_point} CP · {entry.guard_power} GP</span>
          <button type="button" className="ghost" disabled={busy} onClick={() => startEdit(entry)}>Edit Score</button>
          <button type="button" className="danger" disabled={busy} onClick={() => handleDelete(entry.id)}>Delete</button>
        </div>)}
      </div>}
    </section>
  )
}
