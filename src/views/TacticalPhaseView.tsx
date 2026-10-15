import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useChallenges } from '../hooks/useChallenges'
import { useTacticalTeams } from '../hooks/useTacticalTeams'
import { attackTacticalPhaseOnce, chooseTacticalCard, isPassiveCard, isProtectCard, cardTargetCount, selectedCardTargets, validateTacticalAttack, publishTacticalPhase, readTacticalPhase, setTacticalVisibility, subscribeTacticalPhase, usedTacticalCardIds } from '../services/tacticalPhase'
import { recordGigaRiskGP } from '../services/gpTransactions'
import { useTeams } from '../hooks/useTeams'
import { openPublicDisplay } from '../services/publicWindow'
import { publishPublicDisplay } from '../services/publicDisplay'
import { teamColour } from '../services/defaultTeams'
import { cardTitleFor } from '../data/card-pool'
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
  const { teams, error, loading } = useTacticalTeams(id)
  const { teams: allTeams, error: teamError, loading: teamsLoading } = useTeams()
  const [busy, setBusy] = useState(false)
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
  const locked = busy || phase.revealed || !!resolution
  const inputs = allTeams.map((team) => ({ id: team.id, name: team.name, gp: team.total_gp,
    cards: (teams.find((entry) => entry.id === team.id)?.cards ?? []).filter((card) => !usedCards.has(card.id)) }))
  const playedIds = (teamId: string) => resolution?.teams.find((entry) => entry.teamId === teamId)?.usedCardIds ?? (phase.choices[teamId]?.skipped ? [] : phase.choices[teamId]?.cards ?? [])
  const revealedCards = teams.flatMap((team) => team.cards.filter((card) => playedIds(team.id).includes(card.id)).map((card) => ({ team, card })))
  const currentLog = revealedCards[logIndex % revealedCards.length]
  function targetCard(teamId: string, cardId: string, targetId: string, slot: number) {
    const current = readTacticalPhase(id)
    if (busy || current.resolution || current.strike) return
    const choice = current.choices[teamId]
    if (!choice?.cards.includes(cardId)) return
    const card = inputs.find((team) => team.id === teamId)?.cards.find((entry) => entry.id === cardId)
    if (!card) return
    const count = cardTargetCount(card)
    const targets = Array.from({ length:count }, (_, index) => selectedCardTargets(choice, cardId)[index] ?? '')
    targets[slot] = targetId
    publishTacticalPhase(id, { ...current, choices: { ...current.choices,
      [teamId]: { ...choice, targets: { ...choice.targets, [cardId]: count === 1 ? targetId : targets } } } })
    setActionError(null)
  }
  async function attack() {
    if (!id || busy || loading || teamsLoading) return
    try {
      if (error || teamError) throw new Error(error || teamError || '')
      const current = readTacticalPhase(id)
      if (current.resolution || current.strike) return
      validateTacticalAttack(inputs, current)
      openPublicDisplay(`/card-reveal/${encodeURIComponent(id)}`)
      setBusy(true)
      await attackTacticalPhaseOnce(id, inputs, (result) => recordGigaRiskGP(id, result))
      await publishPublicDisplay('card-reveal', id)
      setActionError(null)
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
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
      if (team?.cards.some((card) => card.id === cardId && isPassiveCard(card))) return
      publishTacticalPhase(id, chooseTacticalCard(readTacticalPhase(id), teamId, cardId, team?.cards.filter((card) => !usedCards.has(card.id)).map((card) => card.id) ?? []))
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
      await publishPublicDisplay(showReveal ? 'card-reveal' : 'tactical', id)
      setActionError(null)
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)) }
  }
  if (admin) return <section className="view tactical-admin">
    <header className="view__header"><h2>Tactical Phase</h2><p className="view__hint">Select up to two earned cards per team. Click a card or drag it into that team’s selection, or skip. Second Chance activates automatically at 0 GP and is consumed only when triggered.</p></header>
    <div className="admin-toolbar">
      <label className="field"><span>Challenge</span><select value={id} onChange={(event) => void selectChallenge(event.target.value)}>{challenges.map((challenge) => <option key={challenge.id} value={challenge.id}>{challenge.name}</option>)}</select></label>
      <button className="ghost" onClick={() => void display(false)}>{phase.revealed ? 'Return to Tactical Phase' : 'Show Tactical Phase'}</button><button disabled={!id || !teams.length} onClick={() => void display(true)}>{phase.revealed || resolution ? 'Show Card Reveal' : 'Card Reveal'}</button>
      <button disabled={!id || !allTeams.length || loading || teamsLoading || busy || !!resolution} onClick={() => void attack()}>{resolution ? 'Serangan selesai' : busy ? 'Memproses serangan…' : 'Serang semua tim −2 GP'}</button>
    </div>
    {(actionError || error || teamError) && <p className="alert alert--error" role="alert">{actionError || error || teamError}</p>}
    {revealedCards.length > 0 && <div className="giga-card-actions" aria-label="Selected tactical card actions">{revealedCards.map(({ team, card }) => <article key={card.id}>
      <div><strong>Tim {team.name.replace(/^tim\s+/i, '')} · {card.name}</strong><p>{card.effect_action}</p></div>
      {Array.from({ length:cardTargetCount(card) }, (_, slot) => <label className="field" key={slot}><span>Tim {isProtectCard(card) ? 'target' : 'lawan'}{cardTargetCount(card) === 2 ? ` ${slot + 1}` : ''} untuk {card.name}</span><select aria-label={`Target ${card.name} milik ${team.name}${cardTargetCount(card) === 2 ? ` · ${slot + 1}` : ''}`} value={selectedCardTargets(phase.choices[team.id], card.id)[slot] ?? ''} disabled={busy || !!resolution} onChange={(event) => targetCard(team.id, card.id, event.target.value, slot)}><option value="">Pilih tim {isProtectCard(card) ? 'target' : 'lawan'}</option>{allTeams.filter((opponent) => isProtectCard(card) || opponent.id !== team.id).map((opponent) => <option key={opponent.id} value={opponent.id} disabled={selectedCardTargets(phase.choices[team.id], card.id).some((target, index) => index !== slot && target === opponent.id)}>{opponent.name} · {opponent.total_gp} GP</option>)}</select></label>)}
    </article>)}</div>}
    {teams.map((team) => <article key={team.id} className={`tactical-admin__team tactical-colour--${teamColour(team.name) ?? 'neutral'}`}>
      <header className="tactical-admin__team-header"><h3>Tim {team.name} · {resolution?.teams.find((entry) => entry.teamId === team.id)?.finalGP ?? team.gp} GP</h3><span className="badge">{phase.choices[team.id]?.skipped ? 'SKIP' : `${phase.choices[team.id]?.cards.length ?? 0}/2 selected`}</span></header>
      <div className="tactical-admin__body"><div><h4>Owned cards · {team.cards.length}</h4>
      <div className="tactical-admin__history">{Array.from(new Set(team.cards.map((card) => card.challenge_point))).map((entryId) => <section key={entryId} className="tactical-admin__card-group">
        <h5>{team.cardChallenges[entryId ?? '']?.name ?? 'Other earned cards'}{team.cardChallenges[entryId ?? '']?.id === id && <span className="badge">Current challenge</span>}</h5>
        <div className="tactical-admin__cards" aria-label={`Earned cards for ${team.name}`}>{team.cards.filter((card) => card.challenge_point === entryId).map((card) => <div className={`tactical-admin__owned-card${usedCards.has(card.id) ? ' is-used' : ''}`} key={card.id}>
          <button disabled={locked || usedCards.has(card.id) || isPassiveCard(card)} draggable={!locked && !usedCards.has(card.id) && !isPassiveCard(card)} aria-label={`Select ${card.name} for ${team.name}`} aria-pressed={phase.choices[team.id]?.cards.includes(card.id) ?? false} onClick={() => select(team.id, card.id)} onDragStart={(event) => { event.dataTransfer.setData('application/x-guard-card', JSON.stringify({ teamId: team.id, cardId: card.id })) }}><TacticalCard card={card} /></button>
          <span className="tactical-admin__card-state">{usedCards.has(card.id) ? 'Used' : isPassiveCard(card) ? 'Passive · automatic at 0 GP' : 'Available'}</span>
        </div>)}</div>
      </section>)}{!team.cards.length && <p>No earned cards</p>}</div>
      </div><div><h4>Selected cards</h4><div className="tactical-admin__selection" aria-label={`Selected cards for ${team.name}`} onDragOver={(event) => { if (!locked) event.preventDefault() }} onDrop={(event) => { event.preventDefault(); if (locked) return; try { const value = JSON.parse(event.dataTransfer.getData('application/x-guard-card')) as { teamId: string; cardId: string }; if (value.teamId !== team.id) throw new Error('Choose a card earned by this team'); if (!phase.choices[team.id]?.cards.includes(value.cardId)) select(team.id, value.cardId) } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)) } }}>
        {team.cards.filter((card) => !phase.choices[team.id]?.skipped && phase.choices[team.id]?.cards.includes(card.id)).map((card) => <button key={card.id} disabled={locked} aria-label={`Remove ${card.name} from ${team.name}`} onClick={() => select(team.id, card.id)}><TacticalCard card={card} /></button>)}
        {!phase.choices[team.id]?.cards.length && <span>{phase.choices[team.id]?.skipped ? 'This team will skip.' : 'Drop up to two cards here.'}</span>}
      </div>
      <button className="ghost" disabled={locked} onClick={() => publishTacticalPhase(id, { ...phase, choices: { ...phase.choices, [team.id]: { cards: [], skipped: true } } })}>Skip {team.name}</button></div></div>
    </article>)}
  </section>
  return <section key={`${id}-${resolution?.resolvedAt ?? 'pending'}`} className={`tactical-stage ${reveal ? 'tactical-stage--reveal' : ''}${reveal && resolution ? ' tactical-stage--resolved' : ''}`} aria-label={reveal ? 'Card Reveal' : 'Tactical Phase'}>
    <img className="tactical-stage__art" src={`/ui/tactical-slide-0${reveal ? 6 : 5}-reference.png`} alt="" />
    <h1 className="sr-only">{reveal ? 'Card Reveal' : 'Tactical Phase'}</h1>
    <div className="tactical-stage__challenge" aria-label="Current challenge">{challenges.find((challenge) => challenge.id === id)?.name ?? 'Loading challenge…'}</div>
    <div className="tactical-stage__panel">{Array.from({ length: 5 }, (_, index) => {
      const team = teams[index]
      const choice = team ? phase.choices[team.id] : undefined
      const cards = team?.cards.filter((card) => playedIds(team.id).includes(card.id)) ?? []
      const visible = reveal && (phase.revealed || !!resolution)
      const result = team ? resolution?.teams.find((entry) => entry.teamId === team.id) : undefined
      return <article key={team?.id ?? index} className={`tactical-stage__team tactical-colour--${teamColour(team?.name ?? '') ?? 'neutral'}`} style={{ '--slot': index } as CSSProperties} aria-label={team?.name ?? 'Empty team'}>
        <h2>Tim {team?.name.replace(/^tim\s+/i, '') ?? '—'}</h2><span className="tactical-stage__gp"><svg viewBox="0 0 64 80" aria-hidden="true"><path d="M32 3 61 17 57 54 32 77 7 54 3 17Z" fill="#67dbff" stroke="#0c9edc" strokeWidth="2" /><path d="M32 10 54 21 50 50 32 67 14 50 10 21Z" fill="#0759da" stroke="#b9f5ff" strokeWidth="3" /><text x="32" y="46" textAnchor="middle" fill="white" fontFamily="Arial" fontWeight="bold" fontSize="25">GP</text></svg>{visible ? result?.finalGP ?? team?.gp ?? 0 : team?.gp ?? 0} GP</span>
        {reveal && <p className="tactical-stage__caption">Kartu yang dipakai</p>}
        {!reveal && <div className="tactical-stage__collection" aria-label={`Owned cards for ${team?.name ?? 'empty team'}`}>{Array.from({ length: Math.max(8, team?.cards.length ?? 0) }, (_, slot) => {
          const card = team?.cards[slot]
          const used = !!card && usedCards.has(card.id)
          return <div className={`tactical-stage__slot${used ? ' tactical-stage__owned-used' : ''}`} key={card?.id ?? slot} aria-label={card ? `${card.name} · ${used ? 'Used' : 'Available'}` : undefined}>
            {card && <TacticalCard card={card} />}
            {used && <span className="tactical-stage__used-label">Used</span>}
          </div>
        })}</div>}
        <div className="tactical-stage__selected" style={{ gridTemplateColumns: `repeat(${Math.max(2, cards.length)}, minmax(0, 1fr))` }}>{Array.from({ length: Math.max(2, cards.length) }, (_, slot) => <div className="tactical-stage__slot" key={slot}>{cards[slot] && (visible || !reveal) && <TacticalCard card={cards[slot]} />}</div>)}</div>
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


