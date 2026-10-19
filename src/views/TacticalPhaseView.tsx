import { GPShield } from './GPShield'
import { resolvedCardEffects } from '../services/cardEffectSummary'
import { prepareFortuneOptions } from '../services/fortuneDraw'
import { isFortuneCard } from '../services/tacticalPhase'
import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useChallenges } from '../hooks/useChallenges'
import { useTacticalTeams } from '../hooks/useTacticalTeams'
import { assignTacticalCard, attackTacticalPhaseOnce, type TacticalPhase, chooseTacticalCard, isPassiveCard, isProtectCard, cardTargetCount, selectedCardTargets, validateTacticalAttack, publishTacticalPhase, readTacticalPhase, setTacticalVisibility, subscribeTacticalPhase, usedTacticalCardIds } from '../services/tacticalPhase'
import { commitTacticalAssignment, recordGigaRiskGP } from '../services/gpTransactions'
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
  const phase = readTacticalPhase(id)
  const resolution = phase.resolution ?? phase.strike
  const { teams, error, loading } = useTacticalTeams(id, { includeInactive: !!resolution || !!phase.assignment })
  const { teams: teamRecords, error: teamError, loading: teamsLoading } = useTeams({ includeInactive:true })
  const allTeams = teamRecords.filter((team) => team.status === 'active' || (resolution ?? phase.assignment)?.teams.some((entry) => entry.teamId === team.id))
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
  const usedCards = usedTacticalCardIds(id)
  const locked = busy || phase.revealed || !!resolution
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
  const currentLog = revealedCards[logIndex % revealedCards.length]
  const currentLogEffects = currentLog ? resolvedCardEffects(resolution?.teams.find((entry) => entry.teamId === currentLog.team.id), selectedCardsFor(currentLog.team.id), currentLog.card.id) : []
  async function saveChoices(next: TacticalPhase) {
    setBusy(true)
    try {
      await commitTacticalAssignment(id, inputs, next)
      setActionError(null)
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  function targetCard(teamId: string, cardId: string, targetId: string, slot: number) {
    const current = readTacticalPhase(id)
    if (busy || current.revealed || current.resolution || current.strike) return
    const choice = current.choices[teamId]
    if (!choice?.cards.includes(cardId)) return
    const card = inputs.find((team) => team.id === teamId)?.cards.find((entry) => entry.id === cardId)
    if (!card) return
    const count = cardTargetCount(card)
    const targets = Array.from({ length:count }, (_, index) => selectedCardTargets(choice, cardId)[index] ?? '')
    targets[slot] = targetId
    void saveChoices({ ...current, choices: { ...current.choices,
      [teamId]: { ...choice, targets: { ...choice.targets, [cardId]: count === 1 ? targetId : targets } } } })
    setActionError(null)
  }
  function assign(teamId: string, cardId: string, targetId: string, slot?: number) {
    if (locked) return
    try {
      void saveChoices(assignTacticalCard(availablePhase(), inputs, teamId, cardId, targetId, slot))
      setActionError(null)
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)) }
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
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)) }
  }
  async function attack() {
    if (!id || busy || loading || teamsLoading) return
    try {
      if (error || teamError) throw new Error(error || teamError || '')
      const current = availablePhase()
      if (current.resolution || current.strike) return
      publishTacticalPhase(id, current)
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
  async function select(teamId: string, cardId: string) {
    try {
      if (busy) return
      if (deferredRewards.has(cardId)) throw new Error('Kartu Fortune Draw tersedia untuk challenge berikutnya.')
      const team = teams.find((entry) => entry.id === teamId)
      let next = chooseTacticalCard(availablePhase(), teamId, cardId, team?.cards.filter((card) => !usedCards.has(card.id)).map((card) => card.id) ?? [])
      const card = team?.cards.find((entry) => entry.id === cardId)
      if (card && isFortuneCard(card) && next.choices[teamId].cards.includes(cardId) && !next.choices[teamId].fortune?.[cardId]) {
        setBusy(true)
        const options = await prepareFortuneOptions(teamId)
        // Recheck the phase after loading; never overwrite another screen's completed attack.
        next = chooseTacticalCard(availablePhase(), teamId, cardId, team?.cards.filter((entry) => !usedCards.has(entry.id)).map((entry) => entry.id) ?? [])
        next.choices[teamId].fortune = { ...next.choices[teamId].fortune, [cardId]: { options } }
      }
      await saveChoices(next)
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  async function display(showReveal: boolean) {
    try {
      const current = availablePhase()
      const choices = current.resolution || current.strike ? current.choices : Object.fromEntries(availableTeams.map((team) => {
        const choice = current.choices[team.id]
        const cards = (choice?.cards ?? []).filter((cardId) => team.cards.some((card) => card.id === cardId)).slice(0, 2)
        return [team.id, { ...choice, cards, targets: choice?.targets, skipped: choice?.skipped || (showReveal && !cards.length) || false }]
      }))
      publishTacticalPhase(id, setTacticalVisibility({ ...current, choices }, showReveal))
      await publishPublicDisplay(showReveal ? 'card-reveal' : 'tactical', id)
      setActionError(null)
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : String(cause)) }
  }
  if (admin) return <section className="view tactical-admin">
    <header className="view__header">
      <h2>Tactical Phase</h2>
      <p className="view__hint">Select up to two earned cards per team, or skip. Click a card or drag it into the team’s selection.</p>
      <details className="tactical-help">
        <summary>Card timing and targeting rules</summary>
        <ul>
          <li><strong>Immediate:</strong> Reverse and Thief apply when selected. Fortune Draw grants the chosen Rare immediately for another challenge.</li>
          <li><strong>After damage:</strong> Gardian Unity protects all teams and adds +1 GP each. Swallow prevents GP loss and adds +4 GP. Heal restores GP. Protect prevents GP loss for its owner and the selected team.</li>
          <li><strong>Shield:</strong> Blocks damage when GigaRisk attacks.</li>
          <li><strong>Protect target:</strong> Click the card, then its owner or another team below; or drag it onto that team’s selection.</li>
          <li><strong>Thief target:</strong> Click the card, then an opponent below; or drag it onto an opponent’s selection. Epic Thief needs two different opponents.</li>
          <li><strong>Second Chance:</strong> Select to arm it for this phase. It activates automatically at 0 GP and is consumed only when triggered.</li>
        </ul>
      </details>
    </header>
    <div className="admin-toolbar">
      <label className="field"><span>Challenge</span><select value={id} onChange={(event) => void selectChallenge(event.target.value)}>{challenges.map((challenge) => <option key={challenge.id} value={challenge.id}>{challenge.name}</option>)}</select></label>
      <button className="ghost" disabled={busy} onClick={() => void display(false)}>{phase.revealed ? 'Return to Tactical Phase' : 'Show Tactical Phase'}</button><button disabled={!id || !teams.length || busy} onClick={() => void display(true)}>{phase.revealed || resolution ? 'Show Card Reveal' : 'Card Reveal'}</button>
      <button disabled={!id || !allTeams.length || loading || teamsLoading || busy || !!resolution} onClick={() => void attack()}>{resolution ? 'Serangan selesai' : busy ? 'Memproses serangan…' : 'Serang semua tim −2 GP'}</button>
    </div>
    {(actionError || error || teamError) && <p className="alert alert--error" role="alert">{actionError || error || teamError}</p>}
    {!resolution && revealedCards.length > 0 && <div className="giga-card-actions" aria-label="Selected tactical card actions">{revealedCards.map(({ team, card }) => { const action = card; return <article key={card.id}>
      <div><strong>Tim {team.name.replace(/^tim\s+/i, '')} · {card.name}</strong><p>{card.effect_action}</p></div>
      {isFortuneCard(card) && <fieldset className="fortune-choices" disabled={locked}>
        <legend>Pilih 1 dari 3 kartu Rare · tersedia untuk challenge berikutnya</legend>
        <div>{phase.choices[team.id]?.fortune?.[card.id]?.options.map((option, index) => <button type="button" key={option.id}
          aria-label={`Pilih Fortune Draw ${team.name} opsi ${index + 1}`} aria-pressed={phase.choices[team.id]?.fortune?.[card.id]?.selected === option.id}
          onClick={() => {
            const current = readTacticalPhase(id)
            if (busy || current.revealed || current.resolution || current.strike) return
            const choice = current.choices[team.id]
            const offer = choice?.fortune?.[card.id]
            if (!offer || !choice.cards.includes(card.id)) return
            void saveChoices({ ...current, choices: { ...current.choices, [team.id]: { ...choice,
              fortune: { ...choice.fortune, [card.id]: { ...offer, selected: option.id } } } } })
            setActionError(null)
          }}><CardTile {...option} /><span>{cardTitleFor(option.name, option.type)}</span></button>)}</div>
      </fieldset>}
      {Array.from({ length: cardTargetCount(action) }, (_, slot) => <fieldset className="tactical-targets" key={`direct-${slot}`} disabled={locked}>
        <legend>{isProtectCard(action) ? 'Protect team' : 'Steal from team'}{cardTargetCount(action) === 2 ? ` ${slot + 1}` : ''}</legend>
        <div>{allTeams.filter((target) => isProtectCard(action) || target.id !== team.id).map((target) => <button type="button" key={target.id}
          aria-label={`Assign ${card.name} owned by ${team.name} to ${target.name}${cardTargetCount(action) === 2 ? ` · ${slot + 1}` : ''}`}
          aria-pressed={selectedCardTargets(phase.choices[team.id], card.id)[slot] === target.id}
          disabled={selectedCardTargets(phase.choices[team.id], card.id).some((value, index) => index !== slot && value === target.id)}
          onClick={() => assign(team.id, card.id, target.id, slot)}>{target.name}{target.id === team.id ? ' (owner)' : ''}</button>)}</div>
      </fieldset>)}
      {Array.from({ length:cardTargetCount(action) }, (_, slot) => <label className="field" key={slot}><span>Tim {isProtectCard(action) ? 'target' : 'lawan'}{cardTargetCount(action) === 2 ? ` ${slot + 1}` : ''} untuk {card.name}</span><select aria-label={`Target ${card.name} milik ${team.name}${cardTargetCount(action) === 2 ? ` · ${slot + 1}` : ''}`} value={selectedCardTargets(phase.choices[team.id], card.id)[slot] ?? ''} disabled={locked} onChange={(event) => targetCard(team.id, card.id, event.target.value, slot)}><option value="">Pilih tim {isProtectCard(action) ? 'target' : 'lawan'}</option>{allTeams.filter((opponent) => isProtectCard(action) || opponent.id !== team.id).map((opponent) => <option key={opponent.id} value={opponent.id} disabled={selectedCardTargets(phase.choices[team.id], card.id).some((target, index) => index !== slot && target === opponent.id)}>{opponent.name} · {opponent.total_gp} GP</option>)}</select></label>)}
    </article>})}</div>}
    {availableTeams.map((team) => <article key={team.id} className={`tactical-admin__team tactical-colour--${teamColour(team.name) ?? 'neutral'}`}>
      <header className="tactical-admin__team-header"><h3>Tim {team.name} · {resolution?.teams.find((entry) => entry.teamId === team.id)?.finalGP ?? team.gp} GP</h3><span className="badge">{resolution ? 'Serangan selesai' : phase.choices[team.id]?.skipped ? 'SKIP' : `${playedIds(team.id).length}/2 selected`}</span></header>
      <div className="tactical-admin__body"><div><h4>Owned cards · {team.cards.length}</h4>
      <div className="tactical-admin__history">{Array.from(new Set(team.cards.map((card) => card.challenge_point))).map((entryId) => <section key={entryId} className="tactical-admin__card-group">
        <h5>{team.cardChallenges[entryId ?? '']?.name ?? 'Other earned cards'}{team.cardChallenges[entryId ?? '']?.id === id && <span className="badge">Current challenge</span>}</h5>
        <div className="tactical-admin__cards" aria-label={`Earned cards for ${team.name}`}>{team.cards.filter((card) => card.challenge_point === entryId).map((card) => <div className="tactical-admin__owned-card" key={card.id}>
          <button disabled={locked || usedCards.has(card.id) || deferredRewards.has(card.id)} draggable={!locked && !usedCards.has(card.id) && !deferredRewards.has(card.id)} aria-label={`Select ${card.name} for ${team.name}`} aria-pressed={phase.choices[team.id]?.cards.includes(card.id) ?? false} onClick={() => select(team.id, card.id)} onDragStart={(event) => { event.dataTransfer.setData('application/x-guard-card', JSON.stringify({ teamId: team.id, cardId: card.id })) }}><TacticalCard card={card} /></button>
          <span className="tactical-admin__card-state">{deferredRewards.has(card.id) ? 'Available next challenge' : isPassiveCard(card) ? 'Select to arm · automatic at 0 GP' : 'Available'}</span>
        </div>)}</div>
      </section>)}{!team.cards.length && <p>No available cards</p>}</div>
      </div><div><h4>Selected cards</h4><div className="tactical-admin__selection" aria-label={`Selected cards for ${team.name}`} onDragOver={(event) => { if (!locked) event.preventDefault() }} onDrop={(event) => dropCard(event, team.id)}>
        {selectedCardsFor(team.id).map((card) => <button key={card.id} disabled={locked} draggable={!locked && cardTargetCount(card) > 0}
          onDragStart={(event) => event.dataTransfer.setData('application/x-guard-card', JSON.stringify({ teamId: team.id, cardId: card.id }))} aria-label={`Remove ${card.name} from ${team.name}`} onClick={() => select(team.id, card.id)}><TacticalCard card={card} /></button>)}
        {!selectedCardsFor(team.id).length && <span>{phase.choices[team.id]?.skipped ? 'This team will skip.' : 'Drop owned cards here, or drop Protect / Thief here to target this team.'}</span>}
      </div>
      <div className="tactical-admin__assignments" aria-label={`Assigned effects for ${team.name}`}>
        {revealedCards.filter(({ team: owner, card }) => cardTargetCount(card) > 0 && selectedCardTargets(phase.choices[owner.id], card.id).includes(team.id)).map(({ team: owner, card }) =>
          <p key={card.id}>{isProtectCard(card) ? 'Protected by' : 'Thief target of'} {card.name} · Owner: {owner.name}</p>)}
      </div>
      <button className="ghost" disabled={locked} onClick={() => void saveChoices({ ...phase, choices: { ...phase.choices, [team.id]: { ...phase.choices[team.id], cards: [], skipped: true } } })}>Skip {team.name}</button></div></div>
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
      return <article key={team?.id ?? index} className={`tactical-stage__team tactical-colour--${teamColour(team?.name ?? '') ?? 'neutral'}`} style={{ '--slot': index } as CSSProperties} aria-label={team?.name ?? 'Empty team'}>
        <h2>Tim {team?.name.replace(/^tim\s+/i, '') ?? '—'}</h2><span className="tactical-stage__gp"><GPShield />{visible ? result?.finalGP ?? team?.gp ?? 0 : team?.gp ?? 0} GP</span>
        {reveal && <p className="tactical-stage__caption">Kartu yang dipakai</p>}
        {!reveal && <div className="tactical-stage__collection" aria-label={`Owned cards for ${team?.name ?? 'empty team'}`}>{Array.from({ length: Math.max(8, availableCards.length) }, (_, slot) => {
          const card = availableCards[slot]
          return <div className="tactical-stage__slot" key={card?.id ?? slot} aria-label={card ? `${card.name} · Available` : undefined}>
            {card && <TacticalCard card={card} />}
          </div>
        })}</div>}
        <div className="tactical-stage__selected" style={{ gridTemplateColumns: `repeat(${Math.max(2, cards.length)}, minmax(0, 1fr))` }}>{Array.from({ length: Math.max(2, cards.length) }, (_, slot) => {
          const card = cards[slot]
          const targets = card && visible && cardTargetCount(card) > 0 ? selectedCardTargets(choice, card.id).map((targetId) => allTeams.find((target) => target.id === targetId)?.name).filter((name): name is string => !!name) : []
          return <div className="tactical-stage__played-card" key={slot}>
            <div className="tactical-stage__slot">{card && (visible || !reveal) && <TacticalCard card={card} />}</div>
            {targets.length > 0 && <p className="tactical-stage__card-target" data-card-id={card.id}>{isProtectCard(card) ? 'Protect' : 'Thief'}: {targets.join(', ')}</p>}
          </div>
        })}</div>
        <p className={`tactical-stage__status ${choice?.skipped ? 'is-skipped' : cards.length ? 'is-ready' : ''}`}>{reveal ? visible ? cards.length ? `Pakai ${cards.length} Kartu` : 'SKIP' : 'Menunggu Card Reveal' : resolution ? 'Serangan selesai' : choice?.skipped ? 'SKIP' : cards.length ? `✓ ${cards.length} Kartu siap` : 'Memilih...'}</p>
        {visible && resolution && <div className="tactical-stage__effects" aria-label="Resolved card effects">
          {cards.map((card) => <p className="card-effect-outcome is-positive" key={card.id} data-card-id={card.id}>{cardTitleFor(card.name, card.type).replace(/ Card$/i, '')}</p>)}
        </div>}
      </article>
    })}</div>
    <div className="tactical-stage__footer">{reveal ? phase.revealed || resolution ? 'Card Reveal selesai' : 'Menunggu admin membuka kartu' : 'Maksimal 2 kartu per Tactical Phase'}</div>
    {reveal && <div className="tactical-stage__log" data-card-id={currentLog?.card.id}>{(phase.revealed || resolution) ? currentLog ? <><span className="tactical-stage__log-count">{logIndex % revealedCards.length + 1}/{revealedCards.length}</span><strong>{resolution ? 'Efek Kartu' : cardTitleFor(currentLog.card.name, currentLog.card.type).replace(/ Card$/i, '')}</strong><span>{resolution ? `Tim ${currentLog.team.name.replace(/^tim\s+/i, '')}: ${currentLogEffects.join(' · ')}` : `Tim ${currentLog.team.name.replace(/^tim\s+/i, '')} memilih ${cardTitleFor(currentLog.card.name, currentLog.card.type)}`}</span></> : 'Semua tim memilih SKIP' : 'Kartu belum dibuka'}</div>}
    {error && <p className="tactical-stage__error" role="alert">{error}</p>}
  </section>
}
