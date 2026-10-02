import { useCallback, useEffect, useState } from 'react'
import { CardController } from '../controllers/CardController'
import { useChallenges } from '../hooks/useChallenges'
import { useTeams } from '../hooks/useTeams'
import type { Card } from '../models'

interface ChallengeOption {
  id: string
  name: string
  complete: boolean
  eligibleTeams: number
}

export function CardDrawView() {
  const { challenges } = useChallenges()
  const { teams } = useTeams()
  const [challengeOptions, setChallengeOptions] = useState<ChallengeOption[]>([])
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null)
  const [drawnCards, setDrawnCards] = useState<Card[]>([])
  const [error, setError] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)

  const loadChallengeOptions = useCallback(async () => {
    if (challenges.length === 0) {
      setChallengeOptions([])
      return
    }
    const options = await Promise.all(
      challenges.map(async (challenge) => {
        const complete = await CardController.checkChallengeComplete(challenge.id)
        const eligibleTeams = complete ? (await CardController.getTeamsEligibleForBonus(challenge.id)).length : 0
        return {
          id: challenge.id,
          name: challenge.name,
          complete,
          eligibleTeams,
        }
      })
    )
    setChallengeOptions(options)
  }, [challenges])

  useEffect(() => {
    void loadChallengeOptions()
  }, [loadChallengeOptions])

  async function handleDrawCards(challengeId: string) {
    setDrawing(true)
    setError(null)
    try {
      const cards = await CardController.drawBonusCards(challengeId)
      setDrawnCards(cards)
      await loadChallengeOptions()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setDrawing(false)
    }
  }

  

  return (
    <section className="view">
      <header className="view__header">
        <h2>Card Draw Bonus</h2>
        <p className="view__hint">
          After a challenge ends with 5 teams, teams that earned card rewards can draw bonus cards.
        </p>
      </header>

      {error && <p className="alert alert--error">{error}</p>}

      <div className="grid-form">
        <label className="field">
          <span>Select Challenge</span>
          <select
            value={selectedChallengeId ?? ''}
            onChange={(e) => setSelectedChallengeId(e.target.value || null)}
            disabled={drawing}
          >
            <option value="">Select a challenge…</option>
            {challengeOptions.map((opt) => (
              <option key={opt.id} value={opt.id} disabled={!opt.complete}>
                {opt.name} {opt.complete ? '✓ Complete' : '⏳ Incomplete'} ({opt.eligibleTeams} eligible)
              </option>
            ))}
          </select>
        </label>

        {selectedChallengeId && challengeOptions.find((o) => o.id === selectedChallengeId)?.complete && (
          <button
            type="button"
            className="grid-form__submit"
            onClick={() => handleDrawCards(selectedChallengeId)}
            disabled={drawing}
          >
            {drawing ? 'Drawing…' : 'Draw Bonus Cards'}
          </button>
        )}

        {selectedChallengeId && !challengeOptions.find((o) => o.id === selectedChallengeId)?.complete && (
          <p className="alert alert--info" style={{ gridColumn: '1 / -1' }}>
            This challenge is not yet complete. All 5 teams must participate first.
          </p>
        )}
      </div>

      {drawnCards.length > 0 && (
        <div className="card-list">
          <h3>Drawn Cards</h3>
          {drawnCards.map((card) => (
            <div key={card.id} className="card" style={{ borderLeft: `4px solid ${getCardTypeColor(card.type)}` }}>
              <div className="card__body">
                <div>
                  <span className="card__title" style={{ fontSize: '1.2rem' }}>
                    {card.icon} {card.name}
                  </span>
                  <span className="badge" style={{ marginLeft: '0.5rem', background: getCardTypeColor(card.type), color: '#fff' }}>
                    {card.type}
                  </span>
                  <span className="badge badge--muted" style={{ marginLeft: '0.25rem' }}>
                    {card.effect}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  Team: {teams.find((t) => t.id === card.team)?.name ?? 'Unknown'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedChallengeId && drawnCards.length === 0 && challengeOptions.find((o) => o.id === selectedChallengeId)?.complete && !drawing && (
        <p className="muted">No cards drawn yet. Click "Draw Bonus Cards" to draw.</p>
      )}
    </section>
  )
}

function getCardTypeColor(type: string): string {
  switch (type) {
    case 'Normal':
      return '#9ca3af'
    case 'Rare':
      return '#3b82f6'
    case 'Epic':
      return '#a855f7'
    default:
      return '#6b7280'
  }
}