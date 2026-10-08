import { useCallback, useEffect, useMemo, useState } from 'react'
import { CardController } from '../controllers/CardController'
import { useChallenges } from '../hooks/useChallenges'
import { useTeams } from '../hooks/useTeams'
import type { Card, TeamCard } from '../models'
import { CARD_TYPES, type CardPoolStatus, type TeamCardReward } from '../services/cardDraw'
import { CardTile } from './CardTile'

const EMPTY_POOL: CardPoolStatus = {
  total: 0,
  drawn: 0,
  remaining: 0,
  byType: {
    Normal: { total: 0, drawn: 0, remaining: 0 },
    Rare: { total: 0, drawn: 0, remaining: 0 },
    Epic: { total: 0, drawn: 0, remaining: 0 },
    Legendary: { total: 0, drawn: 0, remaining: 0 },
  },
}

interface AvailableCardWithChallenge extends Card {
  challengeRef?: { id: string; name: string }
}

interface TeamWithCards {
  teamId: string
  teamName: string
  cards: TeamCard[]
  cardCount: number
  cardsByChallenge: Record<string, TeamCard[]>
  eligibleForChallenges: Record<string, TeamCardReward>
}

export function CardRevealAdminView() {
  const { challenges } = useChallenges()
  const { teams } = useTeams({ includeInactive: true })
  const [pool, setPool] = useState<CardPoolStatus>(EMPTY_POOL)
  const [availableCards, setAvailableCards] = useState<AvailableCardWithChallenge[]>([])
  const [teamCards, setTeamCards] = useState<Record<string, TeamCard[]>>({})
  const [eligibleTeamsByChallenge, setEligibleTeamsByChallenge] = useState<Record<string, TeamCardReward[]>>({})
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [dragOverTeamId, setDragOverTeamId] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [selectedCardChallenge, setSelectedCardChallenge] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const loadPoolStatus = useCallback(async () => {
    setPool(await CardController.getPoolStatus())
  }, [])

  const loadAvailableCards = useCallback(async () => {
    const cards = await CardController.getAllAvailableDrawnCards()
    setAvailableCards(cards)
  }, [])

  const loadTeamCards = useCallback(async () => {
    const entries = await Promise.all(
      teams.map(async (team) => [team.id, await CardController.listTeamCardsPermanent(team.id)] as const)
    )
    setTeamCards(Object.fromEntries(entries))
  }, [teams])

  const loadEligibleTeams = useCallback(async () => {
    const eligible = await CardController.getEligibleTeamsForAllChallenges()
    setEligibleTeamsByChallenge(eligible)
  }, [])

  useEffect(() => {
    void loadPoolStatus()
    void loadAvailableCards()
    void loadTeamCards()
    void loadEligibleTeams()
  }, [loadPoolStatus, loadAvailableCards, loadTeamCards, loadEligibleTeams])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      await loadPoolStatus()
      await loadAvailableCards()
      await loadTeamCards()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  function handleDragStart(cardId: string) {
    if (busy) return
    setDraggedCardId(cardId)
  }

  function handleDragEnd() {
    setDraggedCardId(null)
    setDragOverTeamId(null)
  }

  function handleDragOver(e: React.DragEvent, teamId: string) {
    e.preventDefault()
    if (!busy && draggedCardId) {
      const card = availableCards.find((c) => c.id === draggedCardId)
      if (card?.challenge) {
        const eligible = eligibleTeamsByChallenge[card.challenge]?.find((t) => t.teamId === teamId)
        if (eligible && eligible.cardCount > 0) {
          setDragOverTeamId(teamId)
        }
      }
    }
  }

  function handleDragLeave() {
    setDragOverTeamId(null)
  }

  function handleDrop(e: React.DragEvent, teamId: string) {
    e.preventDefault()
    if (!busy && draggedCardId) {
      const card = availableCards.find((c) => c.id === draggedCardId)
      if (card?.challenge) {
        const eligible = eligibleTeamsByChallenge[card.challenge]?.find((t) => t.teamId === teamId)
        if (eligible && eligible.cardCount > 0) {
          run(async () => {
            await CardController.assignCardToTeam(draggedCardId!, teamId)
            setNotice(`Card assigned to ${eligible.teamName ?? teamId}`)
          })
        } else {
          setError('Team is not eligible for this challenge\'s cards')
        }
      }
    }
    setDraggedCardId(null)
    setDragOverTeamId(null)
  }

  function handleCardClick(cardId: string, challengeId: string | null) {
    if (busy) return
    if (selectedCardId === cardId) {
      setSelectedCardId(null)
      setSelectedCardChallenge(null)
    } else {
      setSelectedCardId(cardId)
      setSelectedCardChallenge(challengeId ?? null)
    }
  }

  function handleTeamClick(teamId: string) {
    if (busy || !selectedCardId || !selectedCardChallenge) return
    
    const eligible = eligibleTeamsByChallenge[selectedCardChallenge]?.find((t) => t.teamId === teamId)
    if (eligible && eligible.cardCount > 0) {
      run(async () => {
        await CardController.assignCardToTeam(selectedCardId!, teamId)
        setNotice(`Card assigned to ${eligible.teamName ?? teamId}`)
      })
      setSelectedCardId(null)
      setSelectedCardChallenge(null)
    } else {
      setError('Team is not eligible for this challenge\'s cards')
    }
  }

  function isTeamEligibleForSelectedCard(teamId: string): boolean {
    if (!selectedCardChallenge) return false
    const eligible = eligibleTeamsByChallenge[selectedCardChallenge]?.find((t) => t.teamId === teamId)
    return Boolean(eligible && eligible.cardCount > 0)
  }

  const teamCardsMemo = useMemo((): TeamWithCards[] => {
    return teams.map((team) => {
      const cards = teamCards[team.id] ?? []
      
      const eligibleForChallenges: Record<string, TeamCardReward> = {}
      for (const [challengeId, eligibleList] of Object.entries(eligibleTeamsByChallenge)) {
        const found = eligibleList.find((t) => t.teamId === team.id)
        if (found) eligibleForChallenges[challengeId] = found
      }
      return {
        teamId: team.id,
        teamName: team.name,
        cards,
        cardCount: cards.length,
        cardsByChallenge: {},
        eligibleForChallenges,
      }
    })
  }, [teams, teamCards, eligibleTeamsByChallenge])

  const availableByChallenge = useMemo(() => {
    const map = new Map<string, AvailableCardWithChallenge[]>()
    for (const card of availableCards) {
      const challengeId = card.challenge ?? 'unknown'
      const arr = map.get(challengeId) ?? []
      arr.push(card)
      map.set(challengeId, arr)
    }
    return map
  }, [availableCards])

  const challengeNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const challenge of challenges) {
      map.set(challenge.id, challenge.name)
    }
    return map
  }, [challenges])

  return (
    <section className="view">
      <header className="view__header">
        <h2>Card Reveal (Adm)</h2>
        <p className="view__hint">Click a card to select it, then click a team to assign. Or drag & drop cards to eligible teams.</p>
      </header>

      {error && <p className="alert alert--error">{error}</p>}
      {notice && <p className="alert alert--info">{notice}</p>}

      {/* Card Pool Status */}
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
      </section>

      {/* Available Drawn Cards by Challenge */}
      {availableCards.length > 0 && (
        <section className="board-panel" aria-labelledby="available-cards-heading">
          <div className="board-banner">
            <span id="available-cards-heading" className="board-banner__title">
              Available Drawn Cards (Unassigned)
            </span>
            <span className="board-banner__sub">{availableCards.length} card(s) waiting to be assigned</span>
          </div>
          <div className="available-cards-grid">
            {Array.from(availableByChallenge.entries()).map(([challengeId, cards]) => {
              const challengeName = challengeNames.get(challengeId) ?? challengeId
              const eligibleTeams = eligibleTeamsByChallenge[challengeId]?.filter((t) => t.cardCount > 0) ?? []
              return (
                <div key={challengeId} className="available-cards__challenge">
                  <div className="available-cards__challenge-header">
                    <h4 className="available-cards__challenge-name">{challengeName}</h4>
                    <div className="available-cards__eligible-teams">
                      {eligibleTeams.map((et) => (
                        <span key={et.teamId} className="badge badge--eligible" title={`Rank ${et.rank}: ${et.cardCount} cards`}>
                          {et.teamName ?? et.teamId.slice(0, 8)} ({et.cardCount})
                        </span>
                      ))}
                      {eligibleTeams.length === 0 && <span className="muted">No eligible teams</span>}
                    </div>
                  </div>
                  <div className="available-cards__list">
                    {cards.map((card) => (
                      <div
                        key={card.id}
                        className={`available-card ${draggedCardId === card.id ? 'available-card--dragging' : ''} ${selectedCardId === card.id ? 'available-card--selected' : ''}`}
                        draggable={!busy}
                        onDragStart={() => handleDragStart(card.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleCardClick(card.id, card.challenge)}
                      >
                        <CardTile
                          variant="reward"
                          name={card.name}
                          type={card.type}
                          effect={card.effect}
                          effect_action={card.effect_action}
                          icon={card.icon}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Team Card Collections - Side by side layout */}
      <section className="board-panel card-reveal" aria-labelledby="card-reveal-heading">
        <div className="board-banner">
          <span id="card-reveal-heading" className="board-banner__title">Team Card Collections</span>
        </div>
        
        {selectedCardId && (
          <div className="card-reveal__selection-banner">
            <span>Selected card: </span>
            <strong>{availableCards.find(c => c.id === selectedCardId)?.name}</strong>
            <span> - Click a team below to assign, or click the card again to cancel.</span>
          </div>
        )}

        <ul className="card-reveal__teams">
          {teamCardsMemo.map((teamData, index) => {
            const teamColors = ['red', 'blue', 'green', 'purple', 'gold']
            const isDragTarget = draggedCardId && dragOverTeamId === teamData.teamId
            const isClickTarget = selectedCardId && isTeamEligibleForSelectedCard(teamData.teamId)
            const isDisabled = selectedCardId && !isClickTarget
            return (
              <li
                key={teamData.teamId}
                className={`card-reveal__team card-reveal__team--${teamColors[index % 5]} ${isDragTarget ? 'card-reveal__team--drag-target' : ''} ${isClickTarget ? 'card-reveal__team--click-target' : ''} ${isDisabled ? 'card-reveal__team--disabled' : ''}`}
                onDragOver={(e) => handleDragOver(e, teamData.teamId)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, teamData.teamId)}
                onClick={() => handleTeamClick(teamData.teamId)}
                style={{ cursor: isClickTarget ? 'pointer' : isDisabled ? 'not-allowed' : 'default' }}
              >
                <span className="card-reveal__flag" aria-hidden="true">△</span>
                <h3 className="card-reveal__name">{teamData.teamName}</h3>
                
                {/* Show eligible challenges for this team */}
                <div className="card-reveal__eligibility">
                  {Object.entries(teamData.eligibleForChallenges).map(([challengeId, reward]) => {
                    const challengeName = challengeNames.get(challengeId) ?? challengeId
                    const isSelectedChallenge = selectedCardChallenge === challengeId
                    return (
                      <span key={challengeId} className={`badge ${reward.cardCount === 0 ? 'badge--muted' : ''} ${isSelectedChallenge ? 'badge--selected-challenge' : ''}`} title={challengeName}>
                        {challengeName}: {reward.cardCount}
                      </span>
                    )
                  })}
                  {Object.keys(teamData.eligibleForChallenges).length === 0 && <span className="muted">No eligible challenges</span>}
                </div>

                <div className="card-reveal__cards">
                  {teamData.cards.length === 0 && <p className="card-reveal__empty">No cards yet. Drag or click cards from above.</p>}
                  {teamData.cards.map((card) => (
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
                  <span>Cards: <strong>{teamData.cardCount}</strong> / 8</span>
                </div>
              </li>
            )
          })}
        </ul>
        {teamCardsMemo.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
            No teams have cards yet. Assign available drawn cards to teams.
          </p>
        )}
      </section>
    </section>
  )
}