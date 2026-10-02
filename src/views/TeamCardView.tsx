import { useCallback, useEffect, useState } from 'react'
import { CardController } from '../controllers/CardController'
import type { TeamCard } from '../models'

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
        <div className="card-list">
          {cards.map((card) => (
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
              </div>
            </div>
          ))}
        </div>
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