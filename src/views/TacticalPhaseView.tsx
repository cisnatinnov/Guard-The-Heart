import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useChallenges } from '../hooks/useChallenges'
import { useTacticalTeams } from '../hooks/useTacticalTeams'
import { chooseTacticalCard, publishTacticalPhase, readTacticalPhase, setTacticalVisibility, subscribeTacticalPhase, usedTacticalCardIds } from '../services/tacticalPhase'
import { publishPublicDisplay } from '../services/publicDisplay'
import { teamColour } from '../services/defaultTeams'
import { CARD_BACK_IMAGE, cardTitleFor } from '../data/card-pool'
import type { TeamCard } from '../models'
import { CardTile } from './CardTile'
import '../styles/tactical.css'

function TacticalCard({ card }: { card: TeamCard }) {
  return <CardTile name={card.name} type={card.type} effect={card.effect} effect_action={card.effect_action} icon={card.icon} />
}

export function TacticalPhaseView({ admin = false, reveal = false }: { admin?: boolean; reveal?: boolean }) {
  const { challengeId } = useParams()
  const { challenges } = useChallenges()
  const id = challengeId ?? challenges[0]?.id ?? ''
  const navigate = useNavigate()
  const { teams, error } = useTacticalTeams(id)
  const [, refresh] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const [logIndex, setLogIndex] = useState(0)
  useEffect(() => subscribeTacticalPhase(id, () => refresh((value) => value + 1)), [id])
  useEffect(() => {
    if (!reveal) return
    const interval = window.setInterval(() => setLogIndex((value) => value + 1), 5000)
    return () => window.clearInterval(interval)
  }, [reveal, id])
  const phase = readTacticalPhase(id)
  const usedCards = usedTacticalCardIds()
  const resolution = phase.resolution ?? phase.strike
  const locked = phase.revealed || !!resolution
  const revealedCards = teams.flatMap((team) => team.cards.filter((card) => !phase.choices[team.id]?.skipped && phase.choices[team.id]?.cards.includes(card.id)).map((card) => ({ team, card })))
  const currentLog = revealedCards[logIndex % revealedCards.length]
  async function selectChallenge(nextId: string) {
    try {
      await publishPublicDisplay('tactical', nextId)
      navigate(`/admin/tactical/${nextId}`)
      setActionError(null)
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)) }
  }
  function select(teamId: string, cardId: string) {
    try {
      const team = teams.find((entry) => entry.id === teamId)
      publishTacticalPhase(id, chooseTacticalCard(readTacticalPhase(id), teamId, cardId, team?.cards.map((card) => card.id) ?? []))
      setActionError(null)
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)) }
  }
  async function display(showReveal: boolean) {
    try {
      const current = readTacticalPhase(id)
      const choices = current.resolution || current.strike ? current.choices : Object.fromEntries(teams.map((team) => {
        const choice = current.choices[team.id]
        const cards = (choice?.cards ?? []).filter((cardId) => team.cards.some((card) => card.id === cardId)).slice(0, 2)
        return [team.id, { cards, targets: choice?.targets, skipped: choice?.skipped || (showReveal && !cards.length) || false }]
      }))
      publishTacticalPhase(id, setTacticalVisibility({ ...current, choices }, showReveal))
      // Open during the click event so the browser permits the new public tab.
      if (showReveal) window.open(`/card-reveal/${encodeURIComponent(id)}`, '_blank', 'noopener')
      await publishPublicDisplay(showReveal ? 'card-reveal' : 'tactical', id)
      setActionError(null)
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)) }
  }
  if (admin) return <section className="view tactical-admin">
    <header className="view__header"><h2>Tactical Phase</h2><p className="view__hint">Select up to two earned cards per team. Click a card or drag it into that team’s selection, or skip.</p></header>
    <div className="admin-toolbar">
      <label className="field"><span>Challenge</span><select value={id} onChange={(event) => void selectChallenge(event.target.value)}>{challenges.map((challenge) => <option key={challenge.id} value={challenge.id}>{challenge.name}</option>)}</select></label>
      <button className="ghost" onClick={() => void display(false)}>{phase.revealed ? 'Return to Tactical Phase' : 'Show Tactical Phase'}</button><button disabled={!id || !teams.length} onClick={() => void display(true)}>{phase.revealed || resolution ? 'Show Card Reveal' : 'Card Reveal'}</button>
    </div>
    {(actionError || error) && <p className="alert alert--error" role="alert">{actionError || error}</p>}
    {teams.map((team) => <article key={team.id} className={`tactical-admin__team tactical-colour--${teamColour(team.name) ?? 'neutral'}`}>
      <header className="tactical-admin__team-header"><h3>Tim {team.name} · {resolution?.teams.find((entry) => entry.teamId === team.id)?.finalGP ?? team.gp} GP</h3><span className="badge">{phase.choices[team.id]?.skipped ? 'SKIP' : `${phase.choices[team.id]?.cards.length ?? 0}/2 selected`}</span></header>
      <div className="tactical-admin__body"><div><h4>Earned cards</h4>
      <div className="tactical-admin__cards" aria-label={`Earned cards for ${team.name}`}>{team.cards.filter((card) => !usedCards.has(card.id)).map((card) => <button key={card.id} disabled={locked} draggable={!locked} aria-label={`Select ${card.name} for ${team.name}`} aria-pressed={phase.choices[team.id]?.cards.includes(card.id) ?? false} onClick={() => select(team.id, card.id)} onDragStart={(event) => { event.dataTransfer.setData('application/x-guard-card', JSON.stringify({ teamId: team.id, cardId: card.id })) }}><TacticalCard card={card} /></button>)}{!team.cards.some((card) => !usedCards.has(card.id)) && <p>No earned cards</p>}</div>
      </div><div><h4>Selected cards</h4><div className="tactical-admin__selection" aria-label={`Selected cards for ${team.name}`} onDragOver={(event) => { if (!locked) event.preventDefault() }} onDrop={(event) => { event.preventDefault(); if (locked) return; try { const value = JSON.parse(event.dataTransfer.getData('application/x-guard-card')) as { teamId: string; cardId: string }; if (value.teamId !== team.id) throw new Error('Choose a card earned by this team'); if (!phase.choices[team.id]?.cards.includes(value.cardId)) select(team.id, value.cardId) } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)) } }}>
        {team.cards.filter((card) => !phase.choices[team.id]?.skipped && phase.choices[team.id]?.cards.includes(card.id)).map((card) => <button key={card.id} disabled={locked} aria-label={`Remove ${card.name} from ${team.name}`} onClick={() => select(team.id, card.id)}><TacticalCard card={card} /></button>)}
        {!phase.choices[team.id]?.cards.length && <span>{phase.choices[team.id]?.skipped ? 'This team will skip.' : 'Drop up to two cards here.'}</span>}
      </div>
      <button className="ghost" disabled={locked} onClick={() => publishTacticalPhase(id, { ...phase, choices: { ...phase.choices, [team.id]: { cards: [], skipped: true } } })}>Skip {team.name}</button></div></div>
    </article>)}
  </section>
  return <section className={`tactical-stage ${reveal ? 'tactical-stage--reveal' : ''}`} aria-label={reveal ? 'Card Reveal' : 'Tactical Phase'}>
    <img className="tactical-stage__art" src={`/ui/tactical-slide-0${reveal ? 6 : 5}-reference.png`} alt="" />
    <h1 className="sr-only">{reveal ? 'Card Reveal' : 'Tactical Phase'}</h1>
    <div className="tactical-stage__panel">{Array.from({ length: 5 }, (_, index) => {
      const team = teams[index]
      const choice = team ? phase.choices[team.id] : undefined
      const cards = team?.cards.filter((card) => !choice?.skipped && choice?.cards.includes(card.id)) ?? []
      const visible = reveal && (phase.revealed || !!resolution)
      const result = team ? resolution?.teams.find((entry) => entry.teamId === team.id) : undefined
      return <article key={team?.id ?? index} className={`tactical-stage__team tactical-colour--${teamColour(team?.name ?? '') ?? 'neutral'}`} style={{ '--slot': index } as CSSProperties} aria-label={team?.name ?? 'Empty team'}>
        <h2>Tim {team?.name.replace(/^tim\s+/i, '') ?? '—'}</h2><span className="tactical-stage__gp"><svg viewBox="0 0 64 80" aria-hidden="true"><path d="M32 3 61 17 57 54 32 77 7 54 3 17Z" fill="#67dbff" stroke="#0c9edc" strokeWidth="2" /><path d="M32 10 54 21 50 50 32 67 14 50 10 21Z" fill="#0759da" stroke="#b9f5ff" strokeWidth="3" /><text x="32" y="46" textAnchor="middle" fill="white" fontFamily="Arial" fontWeight="bold" fontSize="25">GP</text></svg>{visible ? result?.finalGP ?? team?.gp ?? 0 : team?.gp ?? 0} GP</span>
        {reveal && <p className="tactical-stage__caption">Kartu yang dipakai</p>}
        {!reveal && <div className="tactical-stage__collection">{Array.from({ length: 8 }, (_, slot) => <div className="tactical-stage__slot" key={slot}>{team?.cards.filter((card) => !usedCards.has(card.id))[slot] && <img src={encodeURI(CARD_BACK_IMAGE)} alt="Earned card" />}</div>)}</div>}
        <div className="tactical-stage__selected">{Array.from({ length: 2 }, (_, slot) => <div className="tactical-stage__slot" key={slot}>{cards[slot] && (visible ? <TacticalCard card={cards[slot]} /> : !reveal ? <img src={encodeURI(CARD_BACK_IMAGE)} alt="Selected card" /> : null)}</div>)}</div>
        <p className={`tactical-stage__status ${choice?.skipped ? 'is-skipped' : cards.length ? 'is-ready' : ''}`}>{reveal ? visible ? cards.length ? `Pakai ${cards.length} Kartu` : 'SKIP' : 'Menunggu Card Reveal' : choice?.skipped ? 'SKIP' : cards.length ? `✓ ${cards.length} Kartu siap` : 'Memilih...'}</p>
        {visible && <div className="tactical-stage__effects" aria-label="Resolved card effects">
          {result && <span className={result.gigaRisk > 0 ? 'is-positive' : ''} title="Serangan GigaRisk">GigaRisk {result.gigaRisk > 0 ? '+' : ''}{result.gigaRisk}</span>}
          {(result?.effects ?? cards.map((card) => card.effect_action)).map((effect, effectIndex) => <span key={`${effect}-${effectIndex}`} title={effect}>{effect}</span>)}
        </div>}
      </article>
    })}</div>
    <div className="tactical-stage__footer">{reveal ? phase.revealed || resolution ? 'Card Reveal selesai' : 'Menunggu admin membuka kartu' : 'Maksimal 2 kartu per Tactical Phase'}</div>
    {reveal && <div className="tactical-stage__log">{(phase.revealed || resolution) ? currentLog ? <><span className="tactical-stage__log-count">{logIndex % revealedCards.length + 1}/{revealedCards.length}</span><strong>{cardTitleFor(currentLog.card.name, currentLog.card.type).replace(/ Card$/i, '')}</strong><span>Tim {currentLog.team.name.replace(/^tim\s+/i, '')} memilih {cardTitleFor(currentLog.card.name, currentLog.card.type)}</span></> : 'Semua tim memilih SKIP' : 'Kartu belum dibuka'}</div>}
    {error && <p className="tactical-stage__error" role="alert">{error}</p>}
  </section>
}


