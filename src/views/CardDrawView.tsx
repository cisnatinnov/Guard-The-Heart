import { useCallback, useEffect, useState } from 'react'
import { CardController } from '../controllers/CardController'
import { useChallenges } from '../hooks/useChallenges'
import { useTeams } from '../hooks/useTeams'
import type { Card } from '../models'
import { CARD_TYPES, type CardPoolStatus } from '../services/cardDraw'
import { CardTile } from './CardTile'

interface ChallengeOption {
  id: string
  name: string
  complete: boolean
  eligibleTeams: number
}

const EMPTY_POOL: CardPoolStatus = {
  total: 0,
  drawn: 0,
  remaining: 0,
  byType: {
    Normal: { total: 0, drawn: 0, remaining: 0 },
    Rare: { total: 0, drawn: 0, remaining: 0 },
    Epic: { total: 0, drawn: 0, remaining: 0 },
  },
}

export function CardDrawView() {
  const { challenges } = useChallenges()
  const { teams } = useTeams()
  const [challengeOptions, setChallengeOptions] = useState<ChallengeOption[]>([])
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null)
  const [drawnCards, setDrawnCards] = useState<Card[]>([])
  const [pool, setPool] = useState<CardPoolStatus>(EMPTY_POOL)
  const [error, setError] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)

  const loadPoolStatus = useCallback(async () => {
    setPool(await CardController.getPoolStatus())
  }, [])

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
    void loadPoolStatus()
  }, [loadChallengeOptions, loadPoolStatus])

  async function handleDrawCards(challengeId: string) {
    setDrawing(true)
    setError(null)
    try {
      const cards = await CardController.drawBonusCards(challengeId)
      setDrawnCards(cards)
      await loadChallengeOptions()
      await loadPoolStatus()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setDrawing(false)
    }
  }

  const poolExhausted = pool.remaining === 0

  return (
    <section className="view">
      <header className="view__header">
        <h2>Card Draw Bonus</h2>
        <p className="view__hint">
          After a challenge ends with 5 teams, teams that earned card rewards can draw bonus cards. Cards are
          taken from a finite pool, so every draw reduces what is left.
        </p>
      </header>

      {error && <p className="alert alert--error">{error}</p>}

      <section className="card-pool" aria-labelledby="card-pool-heading">
        <h3 id="card-pool-heading">Card Pool</h3>
        <div className="stat-grid">
          <div className="stat">
            <span className="stat__label">Pool Size</span>
            <span className="stat__value">{pool.total}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Cards Drawn</span>
            <span className="stat__value">{pool.drawn}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Remaining</span>
            <span className="stat__value">{pool.remaining}</span>
          </div>
        </div>
        <div className="card-pool__breakdown">
          {CARD_TYPES.map((type) => (
            <span key={type} className={`badge badge--${type.toLowerCase()}`}>
              {type} {pool.byType[type].remaining}/{pool.byType[type].total}
            </span>
          ))}
        </div>
        {poolExhausted && (
          <p className="alert alert--info">Every card in the pool has been drawn. No bonus cards left to award.</p>
        )}
      </section>

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
            disabled={drawing || poolExhausted}
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
        <section className="card-collection" aria-labelledby="drawn-cards-heading">
          <h3 id="drawn-cards-heading">Drawn Cards</h3>
          <div className="card-collection__grid">
            {drawnCards.map((card) => (
              <CardTile
                key={card.id}
                name={card.name}
                type={card.type}
                effect={card.effect}
                icon={card.icon}
                owner={teams.find((team) => team.id === card.team)?.name ?? 'Unknown team'}
              />
            ))}
          </div>
        </section>
      )}

      {selectedChallengeId && drawnCards.length === 0 && challengeOptions.find((o) => o.id === selectedChallengeId)?.complete && !drawing && (
        <p className="muted">No cards drawn yet. Click "Draw Bonus Cards" to draw.</p>
      )}
    </section>
  )
}