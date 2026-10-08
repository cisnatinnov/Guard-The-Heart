import { useCallback, useEffect, useState } from 'react'
import { CardController } from '../controllers/CardController'
import { useTeams } from '../hooks/useTeams'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import { DB_EVENTS } from '../hooks/useDbEvents'
import type { TeamCard } from '../models'
import { CardTile } from './CardTile'

const BANNER_COLORS = ['red', 'blue', 'green', 'purple', 'gold'] as const

export function CardRevealPublicView() {
  const { teams } = useTeams({ includeInactive: true })
  const [cardsByTeam, setCardsByTeam] = useState<Record<string, TeamCard[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCards = useCallback(async () => {
    setLoading(true)
    try {
      const entries = await Promise.all(
        teams.map(async (team) => [team.id, await CardController.listTeamCardsPermanent(team.id)] as const)
      )
      setCardsByTeam(Object.fromEntries(entries))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [teams])

  useEffect(() => {
    void loadCards()
  }, [loadCards])

  // Real-time updates
  useDbEventRefresh([DB_EVENTS.CARDS_CHANGED, DB_EVENTS.TEAMS_CHANGED], () => {
    void loadCards()
  })

  const revealTeams = teams.filter((team) => (cardsByTeam[team.id] ?? []).length > 0)

  return (
    <section className="view">
      <header className="view__header">
        <h2>Card Reveal</h2>
        <p className="view__hint">Permanent collection of cards earned from challenge bonuses.</p>
      </header>

      {error && <p className="alert alert--error">{error}</p>}
      {loading && <p className="muted">Loading cards…</p>}

      {!loading && revealTeams.length === 0 && <p className="muted">No cards collected yet.</p>}

      {!loading && revealTeams.length > 0 && (
        <section className="board-panel card-reveal" aria-labelledby="card-reveal-heading">
          <div className="board-banner">
            <span id="card-reveal-heading" className="board-banner__title">Card Reveal</span>
          </div>
          <ul className="card-reveal__teams">
            {revealTeams.map((team, index) => {
              const cards = cardsByTeam[team.id] ?? []
              const color = BANNER_COLORS[index % BANNER_COLORS.length]
              return (
                <li key={team.id} className={`card-reveal__team card-reveal__team--${color}`}>
                  <span className="card-reveal__flag" aria-hidden="true">△</span>
                  <h3 className="card-reveal__name">{team.name}</h3>
                  <div className="card-reveal__cards">
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
                  <div className="card-reveal__count">
                    <span>Cards: <strong>{cards.length}</strong> / 8</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </section>
  )
}