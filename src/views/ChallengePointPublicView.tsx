import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChallengePointController } from '../controllers/ChallengePointController'
import { useChallenges } from '../hooks/useChallenges'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import type { ChallengePointEntry } from '../controllers/ChallengePointController'
import { DB_EVENTS } from '../hooks/useDbEvents'

const EMPTY_ENTRIES: ChallengePointEntry[] = []

export function ChallengePointPublicView() {
  const { challenges } = useChallenges()
  const params = useParams<{ challengeId?: string }>()
  const navigate = useNavigate()
  const [entriesByChallenge, setEntriesByChallenge] = useState<Record<string, ChallengePointEntry[]>>({})
  const [error, setError] = useState<string | null>(null)

  const activeId = params.challengeId ?? challenges[0]?.id ?? null
  const entries = activeId ? (entriesByChallenge[activeId] ?? EMPTY_ENTRIES) : EMPTY_ENTRIES
  const activeChallenge = challenges.find((challenge) => challenge.id === activeId)

  const load = useCallback(async (challengeId: string | null) => {
    if (!challengeId) return
    try {
      const rows = await ChallengePointController.listByChallenge(challengeId)
      setEntriesByChallenge((current) => ({ ...current, [challengeId]: rows }))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [])

  useEffect(() => {
    void load(activeId)
  }, [activeId, load])

  // Real-time updates
  useDbEventRefresh([DB_EVENTS.CHALLENGE_POINTS_CHANGED, DB_EVENTS.SCOREBOARD_CHANGED], () => {
    void load(activeId)
  })

  function handleSelectChallenge(challengeId: string) {
    navigate(`/scoreboard/${challengeId}`)
  }

  const header = (
    <header className="view__header view__header--split">
      <div>
        <h2>Scoreboard per challenge</h2>
        <p className="view__hint">Live ranking for the selected challenge.</p>
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

      {error && <p className="alert alert--error">{error}</p>}

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
      </div>

      {entries.length === 0 ? (
        <p className="muted">No entries for this challenge yet.</p>
      ) : (
        <div className="board-panel">
          <div className="board-banner">
            <span className="board-banner__title">Score Board</span>
            <span className="board-banner__sub">{activeChallenge?.name ?? 'Challenge'}</span>
          </div>
          <div className="board-medals" aria-hidden="true">
            <span className="board-medals__item board-medals__item--sword">⚔</span>
            <span className="board-medals__item board-medals__item--shield">🛡</span>
            <span className="board-medals__item board-medals__item--star">★</span>
          </div>
          <ol className="board board--public" aria-label="Challenge ranking">
            {entries.map((entry) => (
              <li key={entry.id} className={`board__row board__row--${Math.min(entry.rank, 5)}`}>
                <span className="rank-badge" aria-label={`Rank ${entry.rank}`}>
                  {entry.rank}
                </span>
                <span className="board__team">{entry.teamRef?.name ?? '—'}</span>
                <span className="board__points" title="Challenge point">
                  {entry.challenge_point}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}