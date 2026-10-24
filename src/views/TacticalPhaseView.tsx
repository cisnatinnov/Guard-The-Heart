import { englishText } from '../services/english'
import { AnimatedTeamGP } from './AnimatedTeamGP'
import { cardGPPreview } from '../services/cardGPPreview'
import { resolvedCardEffects } from '../services/cardEffectSummary'
import { prepareFortuneOptions } from '../services/fortuneDraw'
import { hasDistinctFortuneEffects, isFortuneCard } from '../services/tacticalPhase'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useChallenges } from '../hooks/useChallenges'
import { useTacticalTeams } from '../hooks/useTacticalTeams'
import { assignTacticalCard, attackTacticalPhaseOnce, type TacticalPhase, chooseTacticalCard, isPassiveCard, isProtectCard, cardTargetCount, selectedCardTargets, validateTacticalAttack, publishTacticalPhase, readTacticalPhase, setTacticalVisibility, subscribeTacticalPhase, usedTacticalCardIds } from '../services/tacticalPhase'
import { commitTacticalAssignment, recordGigaRiskGP, type FortuneSelection } from '../services/gpTransactions'
import { useTeams } from '../hooks/useTeams'
import { openPublicDisplay } from '../services/publicWindow'
import { publishPublicDisplay } from '../services/publicDisplay'
import { teamColour } from '../services/defaultTeams'
import { cardTitleFor } from '../data/card-pool'
import type { TeamCard } from '../models'
import { CardTile } from './CardTile'
import { FortuneReveal } from './FortuneReveal'
import { CardEffectAnimation } from './CardEffectAnimation'
import '../styles/tactical.css'

function TacticalCard({ card }: { card: TeamCard }) {
  return <CardTile name={card.name} type={card.type} effect={card.effect} effect_action={englishText(card.effect_action)} icon={card.icon} />
}

export function TacticalPhaseView({ admin = false, reveal = false }: { admin?: boolean; reveal?: boolean }) {
  const { challengeId } = useParams()
  const { challenges } = useChallenges()
  const id = challengeId ?? challenges[0]?.id ?? ''
  const navigate = useNavigate()
  const phase = readTacticalPhase(id)
  const resolution = phase.resolution ?? phase.strike
  const { teams, error, loading } = useTacticalTeams(id, { includeInactive: !!resolution || !!phase.assignment })
  const { teams: teamRecords, error: teamError, loading: teamsLoading } = useTeams({ includeInactive:true })
  const allTeams = teamRecords.filter((team) => team.status === 'active' || (resolution ?? phase.assignment)?.teams.some((entry) => entry.teamId === team.id))
  const [busy, setBusy] = useState(false)
  const [, refresh] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const [logIndex, setLogIndex] = useState(0)
  const [hoveredCard, setHoveredCard] = useState<{ challengeId: string; cardId: string } | null>(null)
  const [fortunePreview, setFortunePreview] = useState<{ challengeId: string; cardId: string } | null>(null)
  const [dismissedFortunes, setDismissedFortunes] = useState<string[]>([])
  useEffect(() => subscribeTacticalPhase(id, () => refresh((value) => value + 1)), [id])
  useEffect(() => {
    if (!reveal || hoveredCard?.challengeId === id) return
    const interval = window.setInterval(() => setLogIndex((value) => value + 1), 5000)
    return () => window.clearInterval(interval)
  }, [reveal, id, hoveredCard])
  const usedCards = usedTacticalCardIds(id)
  const locked = busy || phase.revealed || phase.cardsRevealed || !!resolution
  const deferredRewards = new Set((phase.assignment?.teams ?? []).flatMap((team) => team.fortuneDraws?.flatMap((draw) => draw.rewardId ? [draw.rewardId] : []) ?? []))
  const inputs = allTeams.map((team) => ({ id: team.id, name: team.name, gp: team.total_gp,
    cards: (teams.find((entry) => entry.id === team.id)?.cards ?? []).filter((card) => !usedCards.has(card.id) && !deferredRewards.has(card.id)) }))
  function availablePhase(): TacticalPhase {
    const current = readTacticalPhase(id)
    if (current.resolution || current.strike) return current
    return { ...current, choices: Object.fromEntries(Object.entries(current.choices)
      .filter(([teamId]) => inputs.some((team) => team.id === teamId))
      .map(([teamId, choice]) => [teamId, { ...choice, cards: choice.cards.filter((cardId) => inputs.find((team) => team.id === teamId)?.cards.some((card) => card.id === cardId)) }])) }
  }
  const playedIds = (teamId: string) => {
    const ids = resolution?.teams.find((entry) => entry.teamId === teamId)?.usedCardIds ?? (phase.choices[teamId]?.skipped ? [] : phase.choices[teamId]?.cards ?? [])
    return resolution ? ids : ids.filter((cardId) => !usedCards.has(cardId))
  }
  const selectedCardsFor = (teamId: string) => teams.find((team) => team.id === teamId)?.cards.filter((card) => playedIds(teamId).includes(card.id)) ?? []
  const revealedCards = teams.flatMap((team) => team.cards.filter((card) => playedIds(team.id).includes(card.id)).map((card) => ({ team, card })))
  const availableTeams = teams.map((team) => ({ ...team, cards: team.cards.filter((card) => !usedCards.has(card.id)) }))
  const hoveredLog = hoveredCard?.challengeId === id ? revealedCards.find(({ card }) => card.id === hoveredCard.cardId) : undefined
  const currentLog = hoveredLog ?? revealedCards[logIndex % revealedCards.length]
  const activeLogIndex = currentLog ? revealedCards.findIndex(({ card }) => card.id === currentLog.card.id) : 0
  const gpPreviews = hoveredLog ? cardGPPreview(hoveredLog.team.id, hoveredLog.card, teams, phase) : {}
  const currentLogEffects = currentLog ? resolvedCardEffects((resolution ?? (phase.assignment?.revealApplied ? phase.assignment : undefined))?.teams.find((entry) => entry.teamId === currentLog.team.id), selectedCardsFor(currentLog.team.id), currentLog.card.id) : []
  const activeFortune = reveal && (phase.revealed || resolution) ? revealedCards.find(({ card }) =>
    isFortuneCard(card) && (fortunePreview?.challengeId === id ? card.id === fortunePreview.cardId
      : card.id === currentLog?.card.id && !dismissedFortunes.includes(`${id}:${card.id}`))) : undefined
  const fortuneOffer = activeFortune ? phase.choices[activeFortune.team.id]?.fortune?.[activeFortune.card.id] : undefined
  const fortuneSelected = activeFortune ? (resolution ?? phase.assignment)?.teams.find((entry) => entry.teamId === activeFortune.team.id)?.fortuneDraws?.find((draw) => draw.cardId === activeFortune.card.id)?.selected || fortuneOffer?.selected : undefined
  const repair = admin && !resolution ? revealedCards.find(({ team, card }) => {
    const offer = phase.choices[team.id]?.fortune?.[card.id]
    return isFortuneCard(card) && offer && (offer.rulesVersion !== 2 || !hasDistinctFortuneEffects(offer.options))
  }) : undefined
  const repairOffer = repair ? phase.choices[repair.team.id]?.fortune?.[repair.card.id] : undefined
  const repairKey = repair && repairOffer ? `${id}:${repair.card.id}:${repairOffer.options.map((option) => `${option.id}:${option.name}:${option.effect}`).join(',')}` : ''
  const repairsAttempted = useRef(new Set<string>())
  async function saveChoices(next: TacticalPhase, fortuneSelection?: FortuneSelection) {
    setBusy(true)
    try {
      await commitTacticalAssignment(id, inputs, next, fortuneSelection)
      setActionError(null)
    } catch (cause) { setActionError(englishText(cause instanceof Error ? cause.message : String(cause))) }
    finally { setBusy(false) }
  }
  useEffect(() => {
    if (!repair || !repairKey || busy || loading || teamsLoading || repairsAttempted.current.has(repairKey)) return
    repairsAttempted.current.add(repairKey)
    void saveChoices(readTacticalPhase(id), { teamId: repair.team.id, cardId: repair.card.id, selected: repairOffer?.selected })
  })
  function assign(teamId: string, cardId: string, targetId: string, slot?: number) {
    if (locked) return
    try {
      void saveChoices(assignTacticalCard(availablePhase(), inputs, teamId, cardId, targetId, slot))
      setActionError(null)
    } catch (cause) { setActionError(englishText(cause instanceof Error ? cause.message : String(cause))) }
  }
  function dropCard(event: React.DragEvent, targetId: string) {
    event.preventDefault()
    if (locked) return
    try {
      const value = JSON.parse(event.dataTransfer.getData('application/x-guard-card')) as { teamId: string; cardId: string }
      const card = inputs.find((team) => team.id === value.teamId)?.cards.find((entry) => entry.id === value.cardId)
      if (card && cardTargetCount(card)) assign(value.teamId, value.cardId, targetId)
      else {
        if (value.teamId !== targetId) throw new Error('Choose a card earned by this team')
        if (!readTacticalPhase(id).choices[targetId]?.cards.includes(value.cardId)) void select(targetId, value.cardId)
      }
    } catch (cause) { setActionError(englishText(cause instanceof Error ? cause.message : String(cause))) }
  }
  async function attack() {
    if (!id || busy || loading || teamsLoading) return
    try {
      if (error || teamError) throw new Error(error || teamError || '')
      const current = availablePhase()
      if (current.resolution || current.strike) return
      publishTacticalPhase(id, current)
      validateTacticalAttack(inputs, current)
      if (!current.assignment?.revealApplied) await commitTacticalAssignment(id,inputs,current,undefined,true)
      openPublicDisplay(`/card-reveal/${encodeURIComponent(id)}`)
      setBusy(true)
      await attackTacticalPhaseOnce(id, inputs, (result) => recordGigaRiskGP(id, result))
      await publishPublicDisplay('card-reveal', id)
      setActionError(null)
    } catch (cause) { setActionError(englishText(cause instanceof Error ? cause.message : String(cause))) }
    finally { setBusy(false) }
  }
  async function selectChallenge(nextId: string) {
    try {
      await publishPublicDisplay('tactical', nextId)
      navigate(`/admin/tactical/${nextId}`)
      setActionError(null)
    } catch (cause) { setActionError(englishText(cause instanceof Error ? cause.message : String(cause))) }
  }
  async function select(teamId: string, cardId: string) {
    try {
      if (busy) return
      if (deferredRewards.has(cardId)) throw new Error('Fortune Draw cards are available next challenge.')
      const team = teams.find((entry) => entry.id === teamId)
      let next = chooseTacticalCard(availablePhase(), teamId, cardId, team?.cards.filter((card) => !usedCards.has(card.id)).map((card) => card.id) ?? [])
      const card = team?.cards.find((entry) => entry.id === cardId)
      if (card && isFortuneCard(card) && next.choices[teamId].cards.includes(cardId) && !next.choices[teamId].fortune?.[cardId]) {
        setBusy(true)
        const options = await prepareFortuneOptions(teamId,undefined,id)
        // Recheck the phase after loading; never overwrite another screen's completed attack.
        next = chooseTacticalCard(availablePhase(), teamId, cardId, team?.cards.filter((entry) => !usedCards.has(entry.id)).map((entry) => entry.id) ?? [])
        next.choices[teamId].fortune = { ...next.choices[teamId].fortune, [cardId]: { options, rulesVersion:2 } }
      }
      await saveChoices(next)
    } catch (cause) { setActionError(englishText(cause instanceof Error ? cause.message : String(cause))) }
    finally { setBusy(false) }
  }
  async function display(showReveal: boolean) {
    if (busy) return
    setBusy(true)
    try {
      const current = availablePhase()
      const choices = current.resolution || current.strike ? current.choices : Object.fromEntries(availableTeams.map((team) => {
        const choice = current.choices[team.id]
        const cards = (choice?.cards ?? []).filter((cardId) => team.cards.some((card) => card.id === cardId)).slice(0, 2)
        return [team.id, { ...choice, cards, targets: choice?.targets, skipped: choice?.skipped || (showReveal && !cards.length) || false }]
      }))
      publishTacticalPhase(id, setTacticalVisibility({ ...current, choices }, showReveal))
      if (showReveal && !resolution) await commitTacticalAssignment(id,inputs,readTacticalPhase(id),undefined,true)
      await publishPublicDisplay(showReveal ? 'card-reveal' : 'tactical', id)
      setActionError(null)
    } catch (cause) { setActionError(englishText(cause instanceof Error ? cause.message : String(cause))) }
    finally {setBusy(false)}
  }
  if (admin) return <section className="view tactical-admin">
    <header className="view__header">
      <h2>Tactical Phase</h2>
      <p className="view__hint">Select up to two earned cards per team, or skip. Click a card or drag it into the team’s selection.</p>
      <details className="tactical-help">
        <summary>Card timing and targeting rules</summary>
        <ul>
          <li><strong>On attack:</strong> Heal, Thief, Reverse and Gardian Unity change GP once on Card Reveal. Selecting or retargeting cards does not change GP. Fortune Draw grants the chosen card for another challenge.</li>
          <li><strong>After damage:</strong> Gardian Unity and Protect prevent damage. Shield reduces damage to −1 GP. Swallow prevents damage and adds +4 GP. Second Chance revives automatically once at 0 GP.</li>
          <li><strong>Shield:</strong> Blocks damage when GigaRisk attacks.</li>
          <li><strong>Protect target:</strong> Select the card, then choose its owner or another team in the owner's panel; or drag it onto that team’s selection.</li>
          <li><strong>Thief target:</strong> Select the card, then choose an opponent in the owner's panel; or drag it onto an opponent’s selection. Epic Thief accepts one or two different opponents.</li>
          <li><strong>Second Chance:</strong> Passive card; cannot be selected. It activates automatically after damage at 0 GP and is consumed only once.</li>
        </ul>
      </details>
    </header>
    <div className="admin-toolbar">
      <label className="field"><span>Challenge</span><select value={id} onChange={(event) => void selectChallenge(event.target.value)}>{challenges.map((challenge) => <option key={challenge.id} value={challenge.id}>{challenge.name}</option>)}</select></label>
      <button className="ghost" disabled={busy} onClick={() => void display(false)}>{phase.revealed ? 'Return to Tactical Phase' : 'Show Tactical Phase'}</button><button disabled={!id || !teams.length || busy} onClick={() => void display(true)}>{phase.revealed || resolution ? 'Show Card Reveal' : 'Card Reveal'}</button>
      <button disabled={!id || !allTeams.length || loading || teamsLoading || busy || !!resolution} onClick={() => void attack()}>{resolution ? 'Attack complete' : busy ? 'Processing attack…' : 'Attack all teams −2 GP'}</button>
    </div>
    {(actionError || error || teamError) && <p className="alert alert--error" role="alert">{actionError || error || teamError}</p>}
    {phase.cardsRevealed && !resolution && <p className="alert alert--info">Card Reveal is complete. Cards and targets are locked. Choose any pending Fortune Draw rewards, then continue with the GigaRisk attack.</p>}
      {!resolution && revealedCards.some(({ card }) => isFortuneCard(card)) && <div className="giga-card-actions" aria-label="Selected tactical card actions">{revealedCards.filter(({ card }) => isFortuneCard(card)).map(({ team, card }) => { const offer = phase.choices[team.id]?.fortune?.[card.id]; const validOffer = !!offer && hasDistinctFortuneEffects(offer.options); return <article key={card.id}>
      <div><strong>Team {team.name.replace(/^tim\s+/i, '')} · {card.name}</strong><p>{englishText(card.effect_action)}</p></div>
      {isFortuneCard(card) && <fieldset className="fortune-choices" disabled={busy || loading || teamsLoading || !!resolution}>
        <legend>{validOffer ? `Choose 1 of ${offer.options.length} cards` : 'Fortune Draw'} · available next challenge</legend>
        {validOffer && <label className="fortune-public-mode"><input type="checkbox" checked={offer.publicClosed !== false} onChange={(event) => void saveChoices(readTacticalPhase(id),{teamId:team.id,cardId:card.id,publicClosed:event.target.checked})} />Public view: closed cards</label>}
        {!validOffer && <p role="status">{busy ? 'Loading options with distinct effects…' : 'This older offer contains duplicate effects. Retry to load the available options.'}</p>}
        {!validOffer && <button type="button" onClick={() => void saveChoices(readTacticalPhase(id), { teamId: team.id, cardId: card.id, selected: offer?.selected })}>Retry Fortune Draw options</button>}
        {validOffer && offer.options.length < 3 && <p role="status">Hanya {offer.options.length} efek berbeda yang tersedia dan memenuhi batas rank. Efek yang sama tidak ditawarkan ulang.</p>}
        <div>{validOffer && offer.options.map((option, index) => <button type="button" key={option.id}
          disabled={!!offer.selected} aria-label={`Choose Fortune Draw ${team.name} option ${index + 1}`} aria-pressed={offer.selected === option.id}
          onClick={() => {
            const current = readTacticalPhase(id)
            if (busy || current.resolution || current.strike) return
            const choice = current.choices[team.id]
            const offer = choice?.fortune?.[card.id]
            if (!offer || !choice.cards.includes(card.id)) return
            void saveChoices(current, { teamId: team.id, cardId: card.id, selected: option.id })
            setActionError(null)
            }}><CardTile {...option} /><span>{option.type} · {cardTitleFor(option.name, option.type)}</span></button>)}</div>
      </fieldset>}

    </article>})}</div>}
    {availableTeams.map((team) => <article key={team.id} className={`tactical-admin__team tactical-colour--${teamColour(team) ?? 'neutral'}`}>
      <header className="tactical-admin__team-header"><h3>Team {team.name} · {resolution?.teams.find((entry) => entry.teamId === team.id)?.finalGP ?? team.gp} GP</h3><span className="badge">{resolution ? 'Attack complete' : phase.choices[team.id]?.skipped ? 'SKIP' : `${playedIds(team.id).length}/2 selected`}</span></header>
      <div className="tactical-admin__body"><div><h4>Owned cards · {team.cards.length}</h4>
      <div className="tactical-admin__history">{Array.from(new Set(team.cards.map((card) => card.challenge_point))).map((entryId) => <section key={entryId} className="tactical-admin__card-group">
        <h5>{team.cardChallenges[entryId ?? '']?.name ?? 'Other earned cards'}{team.cardChallenges[entryId ?? '']?.id === id && <span className="badge">Current challenge</span>}</h5>
        <div className="tactical-admin__cards" aria-label={`Earned cards for ${team.name}`}>{team.cards.filter((card) => card.challenge_point === entryId).map((card) => <div className="tactical-admin__owned-card" key={card.id}>
          <button disabled={locked || isPassiveCard(card) || usedCards.has(card.id) || deferredRewards.has(card.id)} draggable={!locked && !isPassiveCard(card) && !usedCards.has(card.id) && !deferredRewards.has(card.id)} aria-label={`Select ${card.name} for ${team.name}`} aria-pressed={phase.choices[team.id]?.cards.includes(card.id) ?? false} onClick={() => select(team.id, card.id)} onDragStart={(event) => { event.dataTransfer.setData('application/x-guard-card', JSON.stringify({ teamId: team.id, cardId: card.id })) }}><TacticalCard card={card} /></button>
          <span className="tactical-admin__card-state">{deferredRewards.has(card.id) ? 'Available next challenge' : isPassiveCard(card) ? 'Passive · automatic after damage at 0 GP' : 'Available'}</span>
        </div>)}</div>
      </section>)}{!team.cards.length && <p>No available cards</p>}</div>
      </div><div><h4>Selected cards</h4><div className="tactical-admin__selection" aria-label={`Selected cards for ${team.name}`} onDragOver={(event) => { if (!locked) event.preventDefault() }} onDrop={(event) => dropCard(event, team.id)}>
        {selectedCardsFor(team.id).map((card) => <button key={card.id} disabled={locked} draggable={!locked && cardTargetCount(card) > 0}
          onDragStart={(event) => event.dataTransfer.setData('application/x-guard-card', JSON.stringify({ teamId: team.id, cardId: card.id }))} aria-label={`Remove ${card.name} from ${team.name}`} onClick={() => select(team.id, card.id)}><TacticalCard card={card} /></button>)}
        {!selectedCardsFor(team.id).length && <span>{phase.choices[team.id]?.skipped ? 'This team will skip.' : 'Drop owned cards here, or drop Protect / Thief here to target this team.'}</span>}
      </div>
      <div className="tactical-admin__assignments" aria-label={`Assigned effects for ${team.name}`}>
        {revealedCards.filter(({ team: owner, card }) => cardTargetCount(card) > 0 && (selectedCardTargets(phase.choices[owner.id], card.id).includes(team.id) || isProtectCard(card) && owner.id === team.id && selectedCardTargets(phase.choices[owner.id], card.id).length > 0)).map(({ team: owner, card }) =>
          <p key={card.id}>{isProtectCard(card) ? 'Protected by' : 'Thief target of'} {card.name} · Owner: {owner.name}</p>)}
      </div>
      <button className="ghost" disabled={locked} onClick={() => void saveChoices({ ...phase, choices: { ...phase.choices, [team.id]: { ...phase.choices[team.id], cards: [], skipped: true } } })}>Skip {team.name}</button></div></div>
      {!resolution && selectedCardsFor(team.id).some((card) => cardTargetCount(card) > 0) && <div className="tactical-admin__targeting" aria-label={`Target assignments for ${team.name}`}>
        {selectedCardsFor(team.id).filter((card) => cardTargetCount(card) > 0).map((card) => <section className="tactical-admin__target-card" key={card.id} aria-label={`Targets for ${card.name} owned by ${team.name}`}>
          <h4>{card.name}</h4><p>{englishText(card.effect_action)}</p>
      {Array.from({ length: cardTargetCount(card) }, (_, slot) => <fieldset className="tactical-targets" key={`direct-${slot}`} disabled={locked}>
        <legend>{isProtectCard(card) ? `Protect team · ${team.name} (owner) is always protected` : 'Steal from team'}{cardTargetCount(card) === 2 ? ` ${slot + 1}${slot === 1 ? ' (optional)' : ''}` : ''}</legend>
        <div>{allTeams.filter((target) => isProtectCard(card) || target.id !== team.id).map((target) => <button type="button" key={target.id}
          aria-label={`Assign ${card.name} owned by ${team.name} to ${target.name}${cardTargetCount(card) === 2 ? ` · ${slot + 1}` : ''}`}
          aria-pressed={selectedCardTargets(phase.choices[team.id], card.id)[slot] === target.id}
          disabled={selectedCardTargets(phase.choices[team.id], card.id).some((value, index) => index !== slot && value === target.id)}
          onClick={() => assign(team.id, card.id, target.id, slot)}>{target.name}{target.id === team.id ? ' (owner)' : ''}</button>)}</div>
      </fieldset>)}
        </section>)}
      </div>}
    </article>)}
  </section>
  return <section key={`${id}-${resolution?.resolvedAt ?? 'pending'}`} className={`tactical-stage ${reveal ? 'tactical-stage--reveal' : ''}${reveal && resolution ? ' tactical-stage--resolved' : ''}`} aria-label={reveal ? 'Card Reveal' : 'Tactical Phase'}>
    <img className="tactical-stage__art" src={`/ui/tactical-slide-0${reveal ? 6 : 5}-reference.png`} alt="" />
    <h1 className="sr-only">{reveal ? 'Card Reveal' : 'Tactical Phase'}</h1>
    <div className="tactical-stage__challenge" aria-label="Current challenge">{challenges.find((challenge) => challenge.id === id)?.name ?? 'Loading challenge…'}</div>
    <div className="tactical-stage__panel">{Array.from({ length: 5 }, (_, index) => {
      const team = teams[index]
      const choice = team ? phase.choices[team.id] : undefined
      const cards = team ? selectedCardsFor(team.id) : []
      const availableCards = team?.cards.filter((card) => !usedCards.has(card.id)) ?? []
      const visible = reveal && (phase.revealed || !!resolution)
      const result = team ? resolution?.teams.find((entry) => entry.teamId === team.id) : undefined
      return <article key={team?.id ?? index} className={`tactical-stage__team tactical-colour--${(team ? teamColour(team) : null) ?? 'neutral'}`} style={{ '--slot': index } as CSSProperties} aria-label={team?.name ?? 'Empty team'}>
        <h2>Team {team?.name.replace(/^tim\s+/i, '') ?? '—'}</h2><AnimatedTeamGP key={`${id}:${team?.id}:${hoveredLog?.card.id ?? 'idle'}:${resolution?.resolvedAt ?? 'pending'}`} value={visible ? result?.finalGP ?? team?.gp ?? 0 : team?.gp ?? 0} preview={visible && team ? gpPreviews[team.id] : undefined} />
        {reveal && <p className="tactical-stage__caption">Played cards</p>}
        {!reveal && <div className="tactical-stage__collection" aria-label={`Owned cards for ${team?.name ?? 'empty team'}`}>{Array.from({ length: Math.max(8, availableCards.length) }, (_, slot) => {
          const card = availableCards[slot]
          return <div className="tactical-stage__slot" key={card?.id ?? slot} aria-label={card ? `${card.name} · Available` : undefined}>
            {card && <TacticalCard card={card} />}
          </div>
        })}</div>}
        <div className="tactical-stage__selected" style={{ gridTemplateColumns: `repeat(${Math.max(2, cards.length)}, minmax(0, 1fr))` }}>{Array.from({ length: Math.max(2, cards.length) }, (_, slot) => {
          const card = cards[slot]
          const targets = card && visible && cardTargetCount(card) > 0 ? selectedCardTargets(choice, card.id).map((targetId) => allTeams.find((target) => target.id === targetId)?.name).filter((name): name is string => !!name) : []
          return <div className="tactical-stage__played-card" key={slot} data-card-id={card?.id}
            tabIndex={card && visible ? 0 : undefined} role={card && visible ? 'group' : undefined} aria-label={card && visible ? `Preview ${cardTitleFor(card.name, card.type)} for ${team?.name}` : undefined}
            onMouseEnter={() => { if (card && visible) setHoveredCard({ challengeId: id, cardId: card.id }) }}
            onMouseLeave={() => setHoveredCard(null)} onFocus={() => { if (card && visible) setHoveredCard({ challengeId: id, cardId: card.id }) }}
            onBlur={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setHoveredCard(null) }}
            onKeyDown={(event) => { if (event.key === 'Escape') setHoveredCard(null) }}>
            <div className="tactical-stage__slot">{card && (visible || !reveal) && <><TacticalCard card={card} />{visible && <CardEffectAnimation name={card.name} />}</>}</div>
            {targets.length > 0 && <p className="tactical-stage__card-target" data-card-id={card.id}>{isProtectCard(card) ? 'Protect' : 'Thief'}: {targets.join(', ')}</p>}
            {card && visible && isFortuneCard(card) && choice?.fortune?.[card.id]?.options.length && <button className="fortune-reveal-open" type="button" onClick={() => setFortunePreview({ challengeId: id, cardId: card.id })}>Fortune Draw choices</button>}
          </div>
        })}</div>
        <p className={`tactical-stage__status ${choice?.skipped ? 'is-skipped' : cards.length ? 'is-ready' : ''}`}>{reveal ? visible ? cards.length ? `Play ${cards.length} Cards` : 'SKIP' : 'Waiting for Card Reveal' : resolution ? 'Attack complete' : choice?.skipped ? 'SKIP' : cards.length ? `✓ ${cards.length} Cards ready` : 'Choosing...'}</p>
        {visible && resolution && <div className="tactical-stage__effects" aria-label="Resolved card effects">
          {cards.map((card) => <p className="card-effect-outcome is-positive" key={card.id} data-card-id={card.id}>{cardTitleFor(card.name, card.type).replace(/ Card$/i, '')}</p>)}
        </div>}
      </article>
    })}</div>
    <div className="tactical-stage__footer">{reveal ? phase.revealed || resolution ? 'Card Reveal complete' : 'Waiting for admin to reveal cards' : 'At most 2 cards per Tactical Phase'}</div>
    {reveal && <div className="tactical-stage__log" data-card-id={currentLog?.card.id}>{(phase.revealed || resolution) ? currentLog ? <><span className="tactical-stage__log-count">{activeLogIndex + 1}/{revealedCards.length}</span><strong>{cardTitleFor(currentLog.card.name, currentLog.card.type).replace(/ Card$/i, '')}</strong><span>{resolution || phase.assignment?.revealApplied ? `${currentLog.team.name.replace(/^tim\s+/i, '')}: ${currentLogEffects.map(englishText).join(' · ')}` : `${currentLog.team.name.replace(/^tim\s+/i, '')} selects ${cardTitleFor(currentLog.card.name, currentLog.card.type)}`}</span></> : 'All teams chose SKIP' : 'Cards have not been revealed'}</div>}
    {activeFortune && fortuneOffer && <FortuneReveal teamName={activeFortune.team.name} offer={fortuneOffer} selectedId={fortuneSelected} busy={busy || !!resolution} onChoose={(selected) => void saveChoices(readTacticalPhase(id),{teamId:activeFortune.team.id,cardId:activeFortune.card.id,selected})} onClose={() => {
      setDismissedFortunes((current) => [...current, `${id}:${activeFortune.card.id}`])
      setFortunePreview(null)
    }} />}
    {error && <p className="tactical-stage__error" role="alert">{error}</p>}
  </section>
}
