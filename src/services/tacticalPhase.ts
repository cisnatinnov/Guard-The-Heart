import { dbEvents, DB_EVENTS } from '../hooks/useDbEvents'
import { Team, type CardEffect } from '../models'
import { refreshDatabaseFromStorage, withDatabaseWriteLock } from '../db/sequelize-provider'
import { cardEffectLabel } from '../data/card-pool'
export interface FortuneOption { id: string; name: string; type: 'Rare'; effect: CardEffect; effect_action: string; icon: string }
export interface FortuneChoice { options: FortuneOption[]; selected?: string }
export interface TacticalChoice { cards: string[]; skipped: boolean; targets?: Record<string, string | string[]>; fortune?: Record<string, FortuneChoice> }
export interface TacticalTeamResult {
  teamId: string
  assignmentGP?: number
  initialGP: number
  gigaRisk: number
  finalGP: number
  effects: string[]
  usedCardEffects?: string[]
  cardEffects?: Record<string, string[]>
  usedCards: number
  usedCardIds?: string[]
  passiveCardIds?: string[]
  fortuneDraws?: Array<{ cardId: string; options: string[]; selected: string }>
}
/** Older archives retain their totals; attribute visible actions to the cards actually played. */
export function teamUsedCardEffects(result: TacticalTeamResult | undefined, cards: TacticalTeamInput['cards']): string[] {
  if (result?.usedCardEffects) return result.usedCardEffects
  return cards.flatMap((card) => {
    const action = /Second Chance|Heal|Shield|Swallow|Reverse/i.exec(card.name)?.[0]
    const logs = result?.effects.filter((effect) => effect.startsWith('+') && (card.effect === 'Thief'
      ? /Dicuri dari/i.test(effect) : action && effect.toLowerCase().includes(action.toLowerCase()))) ?? []
    return logs.length ? logs : [card.effect_action]
  })
}

export interface TacticalResolution { resolvedAt: number; teams: TacticalTeamResult[] }
export interface TacticalPhase { choices: Record<string, TacticalChoice>; revealed: boolean; assignment?: TacticalResolution; resolution?: TacticalResolution; strike?: TacticalResolution }
const PREFIX = 'guard-the-heart-tactical:'
const ATTACK_PREFIX = 'guard-the-heart-gigarisk-completed:'
const EVENT = 'guard-the-heart:tactical'

/** Keep played cards in the archive; reserve assignments against reuse in other challenges. */
export function usedTacticalCardIds(currentAssignmentId?: string): Set<string> {
  const used = new Set<string>()
  if (typeof localStorage === 'undefined') return used
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (!key || (!key.startsWith(ATTACK_PREFIX) && !key.startsWith(PREFIX))) continue
    try {
      const phase = JSON.parse(localStorage.getItem(key) ?? 'null') as TacticalPhase | null
      if (key !== PREFIX + currentAssignmentId) for (const result of phase?.assignment?.teams ?? []) {
        result.usedCardIds?.forEach((id) => used.add(id))
      }
      if (phase?.assignment && !phase.resolution && !phase.strike && key !== PREFIX + currentAssignmentId) {
        for (const choice of Object.values(phase.choices)) if (!choice.skipped) choice.cards.forEach((id) => used.add(id))
      }
      if (!phase?.resolution && !phase?.strike) continue
      for (const [teamId, choice] of Object.entries(phase.choices)) {
        const result = (phase.resolution ?? phase.strike)?.teams.find((team) => team.teamId === teamId)
        if (result?.usedCardIds) result.usedCardIds.forEach((id) => used.add(id))
        else if (!choice.skipped) choice.cards.forEach((id) => used.add(id))
      }
      for (const result of (phase.resolution ?? phase.strike)?.teams ?? []) {
        result.usedCardIds?.forEach((id) => used.add(id))
      }
    } catch { /* Ignore unrelated or invalid records. */ }
  }
  return used
}

export function readTacticalPhase(id: string): TacticalPhase {
  try {
    const value = JSON.parse(localStorage.getItem(PREFIX + id) ?? 'null') as TacticalPhase | null
    const completed = JSON.parse(localStorage.getItem(ATTACK_PREFIX + id) ?? 'null') as TacticalPhase | null
    if (completed?.choices && (completed.resolution || completed.strike)) {
      return normalizeArchivedEffects({ ...completed, revealed: value?.revealed ?? completed.revealed })
    }
    if (value && typeof value.revealed === 'boolean' && value.choices && Object.values(value.choices).every((choice) =>
      typeof choice.skipped === 'boolean' && Array.isArray(choice.cards) && choice.cards.length <= 2 && new Set(choice.cards).size === choice.cards.length && choice.cards.every((card) => typeof card === 'string'))) return normalizeArchivedEffects(value)
  } catch { /* Start empty if saved selections are invalid. */ }
  return { choices: {}, revealed: false }
}

/** Rename archived labels without replaying attacks or changing saved GP totals. */
function normalizeArchivedEffects(phase: TacticalPhase): TacticalPhase {
  for (const resolution of [phase.resolution, phase.strike]) for (const team of resolution?.teams ?? []) {
    const rename = cardEffectLabel
    team.effects = team.effects.map(rename)
    if (team.usedCardEffects) team.usedCardEffects = team.usedCardEffects.map(rename)
    if (team.cardEffects) team.cardEffects = Object.fromEntries(Object.entries(team.cardEffects).map(([id, effects]) => [id, effects.map(rename)]))
  }
  return phase
}

export function latestTacticalResolution(challengeIds: readonly string[]): TacticalResolution | undefined {
  return challengeIds.map((id) => { const phase = readTacticalPhase(id); return hasTacticalDecisions(phase) ? phase.resolution ?? phase.strike : undefined })
    .filter((resolution): resolution is TacticalResolution => !!resolution && Number.isFinite(resolution.resolvedAt))
    .sort((a, b) => b.resolvedAt - a.resolvedAt)[0]
}

export function publishTacticalPhase(id: string, phase: TacticalPhase): void {
  const current = readTacticalPhase(id)
  if (current.resolution || current.strike) phase = { ...current, revealed: phase.revealed }
  if ((phase.resolution || phase.strike) && !localStorage.getItem(ATTACK_PREFIX + id)) {
    localStorage.setItem(ATTACK_PREFIX + id, JSON.stringify(phase))
  }
  localStorage.setItem(PREFIX + id, JSON.stringify(phase))
  window.dispatchEvent(new Event(EVENT))
}

export async function attackTacticalPhaseOnce(id: string, teams: readonly TacticalTeamInput[], persist?: (resolution:TacticalResolution)=>Promise<void>): Promise<TacticalResolution> {
  const attack = async () => {
    if (persist && typeof window !== 'undefined') await refreshDatabaseFromStorage()
    const phase = readTacticalPhase(id)
    if (phase.resolution || phase.strike) throw new Error('Challenge ini sudah diserang GigaRisk.')
    validateTacticalAttack(teams, phase)
    const balances = persist ? await Team.findAll() : []
    const freshTeams = persist ? teams.map((team) => ({...team, gp:balances.find((entry) => entry.id === team.id)?.total_gp ?? team.gp})) : teams
    const resolution = resolveTacticalEffects(freshTeams, phase.choices, Math.random, Date.now(), phase.assignment ? 'damage' : 'complete', phase.assignment)
    if(persist)await persist(resolution)
    publishTacticalPhase(id, { ...phase, revealed: true, resolution })
    dbEvents.emit(DB_EVENTS.CARDS_CHANGED)
    dbEvents.emit(DB_EVENTS.SCOREBOARD_CHANGED)
    return resolution
  }
  // All tabs use the same challenge lock; check the permanent record inside it.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return await navigator.locks.request(`guard-the-heart-attack:${id}`, () => withDatabaseWriteLock(attack))
  }
  return attack()
}

export function subscribeTacticalPhase(id: string, changed: () => void): () => void {
  const storage = (event: StorageEvent) => { if (event.key === PREFIX + id) changed() }
  window.addEventListener('storage', storage)
  window.addEventListener(EVENT, changed)
  return () => { window.removeEventListener('storage', storage); window.removeEventListener(EVENT, changed) }
}

export function chooseTacticalCard(phase: TacticalPhase, teamId: string, cardId: string, ownedIds: readonly string[], maxCards = 2): TacticalPhase {
  if (phase.resolution || phase.strike) throw new Error('Serangan GigaRisk selesai; pilihan kartu sudah dikunci.')
  if (phase.revealed) throw new Error('Return to Tactical Phase before changing selections')
  if (!ownedIds.includes(cardId)) throw new Error('Choose a card earned by this team')
  const previous = phase.choices[teamId]?.cards ?? []
  const cards = previous.includes(cardId) ? previous.filter((id) => id !== cardId) : [...previous, cardId]
  if (cards.length > maxCards) throw new Error(`Choose at most ${maxCards} cards per team`)
  const targets = Object.fromEntries(Object.entries(phase.choices[teamId]?.targets ?? {}).filter(([id]) => cards.includes(id)))
  const nextChoice = { ...phase.choices[teamId], cards, skipped: false, targets }
  if (!Object.keys(targets).length) delete (nextChoice as TacticalChoice).targets
  return { ...phase, choices: { ...phase.choices, [teamId]: nextChoice } }
}

/** Switching presentation screens never clears or reruns the saved attack. */
export function setTacticalVisibility(phase: TacticalPhase, revealed: boolean): TacticalPhase {
  return { ...phase, revealed }
}

export interface TacticalTeamInput {
  id: string
  name: string
  gp: number
  cards: Array<{ id: string; name: string; type: string; effect: string; effect_action: string }>
}

export const TACTICAL_REQUIRED_MESSAGE = 'Selesaikan challenge terlebih dahulu atau isi Tactical Phase dengan kartu yang dipilih.'

export function hasTacticalDecisions(phase: TacticalPhase): boolean {
  return Object.values(phase.choices).some((choice) => choice.skipped || choice.cards.length > 0)
}

export function needsCardTarget(card: TacticalTeamInput['cards'][number]): boolean {
  return isProtectCard(card) || card.effect === 'Thief' || /ambil.*(?:satu|1|2).*?(?:dari|tim).*lawan/i.test(card.effect_action) && !/setiap|semua/i.test(card.effect_action)
}

export function isPassiveCard(card: Pick<TacticalTeamInput['cards'][number], 'name'>): boolean {
  return /Second Chance/i.test(card.name)
}

export function isFortuneCard(card: Pick<TacticalTeamInput['cards'][number], 'name'>): boolean {
  return /Fortune[ _]Draw/i.test(card.name)
}

export function isProtectCard(card: Pick<TacticalTeamInput['cards'][number], 'name'>): boolean {
  return /Protect/i.test(card.name)
}

export function cardTargetCount(card: TacticalTeamInput['cards'][number]): number {
  if (!needsCardTarget(card)) return 0
  const twoOpponents = card.type === 'Epic' && (card.effect === 'Thief' || /Thief/i.test(card.name)) || /dua\s+tim/i.test(card.effect_action)
  return twoOpponents ? 2 : 1
}

export function selectedCardTargets(choice: TacticalChoice | undefined, cardId: string): string[] {
  const value = choice?.targets?.[cardId]
  return Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []
}

/** Select and target a card in one operation, preserving its original owner. */
export function assignTacticalCard(phase: TacticalPhase, teams: readonly TacticalTeamInput[], ownerId: string, cardId: string, targetId: string, slot?: number): TacticalPhase {
  const owner = teams.find((team) => team.id === ownerId)
  const card = owner?.cards.find((entry) => entry.id === cardId)
  if (!card || !owner) throw new Error('Choose a card earned by this team')
  const action = card
  const count = cardTargetCount(action)
  if (!count || !teams.some((team) => team.id === targetId) || (!isProtectCard(action) && targetId === ownerId)) {
    throw new Error(isProtectCard(action) ? 'Choose a team to protect' : 'Choose an opposing team for this card')
  }
  // Check locks even when the card is already selected.
  if (phase.resolution || phase.strike || phase.revealed) throw new Error('Return to an unlocked Tactical Phase before assigning cards')
  const next = phase.choices[ownerId]?.cards.includes(cardId) ? phase : chooseTacticalCard(phase, ownerId, cardId, owner.cards.map((entry) => entry.id))
  const choice = next.choices[ownerId]
  const targets = Array.from({ length: count }, (_, index) => selectedCardTargets(choice, cardId)[index] ?? '')
  if (slot === undefined && targets.includes(targetId)) return next
  const destination = slot ?? (targets.indexOf('') >= 0 ? targets.indexOf('') : 0)
  if (destination < 0 || destination >= count || targets.some((target, index) => index !== destination && target === targetId)) {
    throw new Error('Choose different opposing teams for this card')
  }
  targets[destination] = targetId
  return { ...next, choices: { ...next.choices, [ownerId]: { ...choice,
    targets: { ...choice.targets, [cardId]: count === 1 ? targetId : targets } } } }
}

function requireCardTargets(teams: readonly TacticalTeamInput[], teamId: string, card: TacticalTeamInput['cards'][number], choice: TacticalChoice | undefined): string[] {
  const ids = selectedCardTargets(choice, card.id)
  const count = cardTargetCount(card)
  if (ids.length !== count || new Set(ids).size !== count || ids.some((id) => !teams.some((team) => team.id === id && (isProtectCard(card) || id !== teamId)))) {
    throw new Error(`Pilih tim${isProtectCard(card) ? ' target' : ' lawan'} untuk ${card.name}${count === 2 ? ' (dua tim yang berbeda)' : ''}.`)
  }
  return ids
}

export function validateTacticalAttack(teams: readonly TacticalTeamInput[], phase: TacticalPhase): void {
  let count = 0
  for (const [teamId, choice] of Object.entries(phase.choices)) {
    const team = teams.find((entry) => entry.id === teamId)
    if (!team && (choice.skipped || choice.cards.length)) throw new Error(TACTICAL_REQUIRED_MESSAGE)
    if (choice.skipped) { count++; continue }
    for (const cardId of choice.cards) {
      const card = team?.cards.find((entry) => entry.id === cardId)
      if (!card) throw new Error(TACTICAL_REQUIRED_MESSAGE)
      count++
      const action = card
      if (needsCardTarget(action)) requireCardTargets(teams, teamId, action, choice)
      if (isFortuneCard(card)) {
        const offer = choice.fortune?.[card.id]
        if (!offer || offer.options.length !== 3 || new Set(offer.options.map((option) => option.id)).size !== 3 ||
          offer.options.some((option) => option.type !== 'Rare' || isFortuneCard(option)) || !offer.options.some((option) => option.id === offer.selected)) {
          throw new Error('Fortune Draw: pilih 1 dari 3 kartu Rare sebelum serangan.')
        }
      }
    }
  }
  if (!count) throw new Error(TACTICAL_REQUIRED_MESSAGE)
}

function amount(random: () => number, min: number, max: number): number {
  return min + Math.floor(Math.max(0, Math.min(0.999999, random())) * (max - min + 1))
}

/** Assignment updates GP immediately; damage consumes defenses without repeating those updates. */
export function resolveTacticalEffects(
  teams: readonly TacticalTeamInput[],
  choices: Record<string, TacticalChoice>,
  random: () => number = Math.random,
  resolvedAt = Date.now(),
  timing: 'complete' | 'assignment' | 'damage' = 'complete',
  assignment?: TacticalResolution,
): TacticalResolution {
  const state = teams.map((team) => {
    const prior = timing === 'damage' ? assignment?.teams.find((entry) => entry.teamId === team.id) : undefined
    return {
      team, prior,
      gp: Math.max(0, Math.trunc(team.gp)),
      attack: timing === 'assignment' ? 0 : -2,
      effects: [...(prior?.effects ?? [])],
      usedCardEffects: [...(prior?.usedCardEffects ?? [])],
      cardEffects: Object.fromEntries(Object.entries(prior?.cardEffects ?? {}).map(([id, effects]) => [id, [...effects]])),
      cards: choices[team.id]?.skipped ? [] : team.cards.filter((card) => !isPassiveCard(card) && choices[team.id]?.cards.includes(card.id)),
      passive: choices[team.id]?.skipped ? undefined : team.cards.find((card) => isPassiveCard(card) && choices[team.id]?.cards.includes(card.id)),
      passiveUsed: !!team.cards.find((card) => isPassiveCard(card) && prior?.usedCardIds?.includes(card.id)),
    }
  })
  const recordCardEffect = (owner: typeof state[number], card: TacticalTeamInput['cards'][number], effect: string) => {
    owner.usedCardEffects.push(effect)
    ;(owner.cardEffects[card.id] ??= []).push(effect)
  }
  const revive = (current: typeof state[number]) => {
    if (current.gp === 0 && current.passive && !current.passiveUsed) {
      current.gp = 1
      current.passiveUsed = true
      current.effects.push('+1 Second Chance')
      recordCardEffect(current, current.passive, '+1 Second Chance')
    }
  }
  state.forEach(revive)
  const unityOwners = state.flatMap((owner) => owner.cards.filter((card) => card.type === 'Legendary' && /Gardian Unity/i.test(card.name)).map((card) => ({ owner, card })))
  const unity = unityOwners.length > 0
  const targetsFor = (owner: typeof state[number], card: TacticalTeamInput['cards'][number]) => {
    // A partial assignment has no effect until all target slots are valid.
    if (timing === 'assignment') {
      try { return requireCardTargets(teams, owner.team.id, card, choices[owner.team.id]) } catch { return [] }
    }
    return requireCardTargets(teams, owner.team.id, card, choices[owner.team.id])
  }
  if (timing !== 'damage') {
    for (const current of state) for (const card of current.cards) {
      if (card.effect !== 'Heal') continue
      const described = card.effect_action.match(/(?:menambah|tambah|add)\s*\+?(\d+)(?!\d)/i)
      const healed = described && !/\d\s*[-–]\s*\d/.test(card.effect_action) ? Number(described[1]) : /Rare/i.test(card.type) ? 3 : amount(random, 1, 2)
      current.gp += healed
      current.effects.push(`+${healed} Heal`)
      recordCardEffect(current, card, `+${healed} Heal`)
    }
    for (const { owner, card } of unityOwners) {
      for (const current of state) { current.gp += 1; current.effects.push('+1 Gardian Unity') }
      recordCardEffect(owner, card, 'Gardian Unity: masing-masing tim +1 GP')
    }
    for (const current of state) for (const reverse of current.cards.filter((card) => /Reverse/i.test(card.name))) {
      const stolen = Number(reverse.effect_action.match(/(?:ambil|take)\s*\+?(\d+)/i)?.[1] ?? 1)
      for (const opponent of state) {
        if (opponent === current) continue
        const transfer = Math.min(stolen, opponent.gp)
        opponent.gp -= transfer; current.gp += transfer
        recordCardEffect(current, reverse, `+${transfer} Reverse dari ${opponent.team.name}`)
        if (transfer) { current.effects.push(`+${transfer} Reverse dari ${opponent.team.name}`); opponent.effects.push(`-${transfer} Reverse oleh ${current.team.name}`) }
        revive(opponent)
      }
    }
    for (const current of state) for (const thief of current.cards.filter((card) => needsCardTarget(card) && !isProtectCard(card))) {
      for (const targetId of targetsFor(current, thief)) {
        const target = state.find((entry) => entry.team.id === targetId)!
        const stolen = Number(thief.effect_action.match(/(?:ambil|take)\s*\+?(\d+)/i)?.[1] ?? (/Rare|Epic/i.test(thief.type) ? 2 : 1))
        const transfer = Math.min(stolen, target.gp)
        target.gp -= transfer; current.gp += transfer
        recordCardEffect(current, thief, `+${transfer} Dicuri dari ${target.team.name}`)
        if (transfer) { current.effects.push(`+${transfer} Dicuri dari ${target.team.name}`); target.effects.push(`-${transfer} Dicuri oleh ${current.team.name}`) }
        revive(target)
      }
    }
  }
  const assignmentBalances = new Map(state.map((entry) => [entry.team.id, entry.gp]))
  if (timing !== 'assignment') {
    const protectedTeams = new Set<string>()
    for (const owner of state) for (const card of owner.cards.filter(isProtectCard)) {
      for (const targetId of targetsFor(owner, card)) {
        protectedTeams.add(targetId)
        recordCardEffect(owner, card, `Protect untuk ${state.find((entry) => entry.team.id === targetId)!.team.name}: terlindungi dari serangan GigaRisk`)
      }
    }
    for (const { owner, card } of unityOwners) recordCardEffect(owner, card, 'Gardian Unity: semua tim terlindungi dari serangan GigaRisk')
    for (const current of state) {
      const swallow = current.cards.find((card) => /Swallow/i.test(card.name))
      const shields = current.cards.filter((card) => /Shield/i.test(card.name))
      if (unity || protectedTeams.has(current.team.id)) {
        current.attack = 0
        current.effects.push('+2 ' + (unity ? 'Gardian Unity protection' : 'Protect'))
      } else if (swallow) {
        current.attack = 4
        current.effects.push('+4 Swallow'); recordCardEffect(current, swallow, '+4 Swallow')
      } else {
        for (const shield of shields) {
          const blocked = Math.min(-current.attack, Number(shield.effect_action.match(/melindungi\s*(\d+)/i)?.[1] ?? 1))
          if (blocked > 0) { current.attack += blocked; current.effects.push(`+${blocked} Shield`); recordCardEffect(current, shield, `+${blocked} Shield`) }
        }
      }
      if (swallow && current.attack <= 0) recordCardEffect(current, swallow, 'Swallow: tidak ada damage GigaRisk untuk dikonversi')
      for (const shield of shields) if (!current.cardEffects[shield.id]) recordCardEffect(current, shield, 'Shield: tidak ada damage GigaRisk tersisa')
      current.gp = Math.max(0, current.gp + current.attack)
      revive(current)
    }
  }
  return { resolvedAt, teams: state.map(({ team, prior, gp, attack, effects, usedCardEffects, cardEffects, cards, passive, passiveUsed }) => ({
    teamId: team.id,
    initialGP: prior?.initialGP ?? Math.max(0, Math.trunc(team.gp)),
    ...(timing === 'damage' ? { assignmentGP: assignmentBalances.get(team.id) } : {}),
    gigaRisk: attack, finalGP: gp, effects, usedCardEffects, cardEffects,
    usedCards: cards.length + Number(passiveUsed),
    usedCardIds: [...cards.map((card) => card.id), ...(passiveUsed && passive ? [passive.id] : [])],
    passiveCardIds: passiveUsed && passive ? [passive.id] : [],
    fortuneDraws: cards.filter(isFortuneCard).map((card) => ({ cardId: card.id,
      options: choices[team.id]?.fortune?.[card.id]?.options.map((option) => option.id) ?? [],
      selected: choices[team.id]?.fortune?.[card.id]?.selected ?? '',
    })),
  })) }
}
