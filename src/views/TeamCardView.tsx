import { useCallback, useEffect, useState } from 'react'
import { CardController } from '../controllers/CardController'
import type { TeamCard } from '../models'
import { CardTile } from './CardTile'

interface TeamCardViewProps {
  teamId: string
  teamName: string
  onClose: () => void
}

export function TeamCardView({ teamId, teamName, onClose }: TeamCardViewProps) {
  const [cards, setCards] = useState<TeamCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCards = useCallback(async () => {
    setLoading(true)
    try {
      const teamCards = await CardController.listTeamCardsPermanent(teamId)
      setCards(teamCards)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    void loadCards()
  }, [loadCards])

  return (
    <section className="view">
      <header className="view__header">
        <div className="row-form">
          <h2>{teamName}'s Cards</h2>
          <button type="button" className="ghost" onClick={onClose}>
            Back to Teams
          </button>
        </div>
        <p className="view__hint">
          Permanent collection of cards earned from challenge bonuses.
        </p>
      </header>

      {error && <p className="alert alert--error">{error}</p>}
      {loading && <p className="muted">Loading cards…</p>}

      {!loading && cards.length === 0 && (
        <p className="muted">No cards collected yet.</p>
      )}

      {!loading && cards.length > 0 && (
        <div className="card-collection__grid">
          {cards.map((card) => (
            <CardTile
              key={card.id}
              name={card.name}
              type={card.type}
              effect={card.effect}
              effect_action={card.effect_action}
              icon={card.icon}
            />
          ))}
        </div>
      )}
    </section>
  )
}