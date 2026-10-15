import { dbEvents, DB_EVENTS } from '../hooks/useDbEvents'
export interface TacticalChoice { cards: string[]; skipped: boolean; targets?: Record<string, string | string[]> }
export interface TacticalTeamResult {
  teamId: string
  initialGP: number
  gigaRisk: number
  finalGP: number
  effects: string[]
  usedCards: number
  usedCardIds?: string[]
}
export interface TacticalResolution { resolvedAt: number; teams: TacticalTeamResult[] }
export interface TacticalPhase { choices: Record<string, TacticalChoice>; revealed: boolean; resolution?: TacticalResolution; strike?: TacticalResolution }
const PREFIX = 'guard-the-heart-tactical:'
const ATTACK_PREFIX = 'guard-the-heart-gigarisk-completed:'
const EVENT = 'guard-the-heart:tactical'

/** Keep played cards in the reveal archive, but exclude them from available inventory. */
export function usedTacticalCardIds(): Set<string> {
  const used = new Set<string>()
  if (typeof localStorage === 'undefined') return used
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (!key || (!key.startsWith(ATTACK_PREFIX) && !key.startsWith(PREFIX))) continue
    try {
      const phase = JSON.parse(localStorage.getItem(key) ?? 'null') as TacticalPhase | null
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
      return { ...completed, revealed: value?.revealed ?? completed.revealed }
    }
    if (value && typeof value.revealed === 'boolean' && value.choices && Object.values(value.choices).every((choice) =>
      typeof choice.skipped === 'boolean' && Array.isArray(choice.cards) && choice.cards.length <= 2 && new Set(choice.cards).size === choice.cards.length && choice.cards.every((card) => typeof card === 'string'))) return value
  } catch { /* Start empty if saved selections are invalid. */ }
  return { choices: {}, revealed: false }
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
    const phase = readTacticalPhase(id)
    if (phase.resolution || phase.strike) throw new Error('Challenge ini sudah diserang GigaRisk.')
    validateTacticalAttack(teams, phase)
    const resolution = resolveTacticalEffects(teams, phase.choices)
    if(persist)await persist(resolution)
    publishTacticalPhase(id, { ...phase, revealed: true, resolution })
    dbEvents.emit(DB_EVENTS.CARDS_CHANGED)
    dbEvents.emit(DB_EVENTS.SCOREBOARD_CHANGED)
    return resolution
  }
  // All tabs use the same challenge lock; check the permanent record inside it.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return await navigator.locks.request(`guard-the-heart-attack:${id}`, attack)
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
  return { ...phase, choices: { ...phase.choices, [teamId]: { cards, skipped: false, ...(Object.keys(targets).length ? { targets } : {}) } } }
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
      if (needsCardTarget(card)) requireCardTargets(teams, teamId, card, choice)
    }
  }
  if (!count) throw new Error(TACTICAL_REQUIRED_MESSAGE)
}

function amount(random: () => number, min: number, max: number): number {
  return min + Math.floor(Math.max(0, Math.min(0.999999, random())) * (max - min + 1))
}

/** Resolve the fixed 2 GP strike and the selected card actions once. */
export function resolveTacticalEffects(
  teams: readonly TacticalTeamInput[],
  choices: Record<string, TacticalChoice>,
  random: () => number = Math.random,
  resolvedAt = Date.now(),
): TacticalResolution {
  const state = teams.map((team) => ({
    team,
    gp: Math.max(0, Math.trunc(team.gp)),
    attack: -2,
    effects: [] as string[],
    cards: choices[team.id]?.skipped ? [] : team.cards.filter((card) => !isPassiveCard(card) && choices[team.id]?.cards.includes(card.id)),
    passive: team.cards.find(isPassiveCard),
    passiveUsed: false,
  }))
  const unity = state.some(({ cards }) => cards.some((card) => card.type === 'Legendary' && /Gardian Unity/i.test(card.name)))
  const protectedTeams = new Set(state.flatMap(({ cards, team }) => cards.filter(isProtectCard)
    .flatMap((card) => requireCardTargets(teams, team.id, card, choices[team.id]))))
  const revive = (current: typeof state[number]) => {
    if (current.gp === 0 && current.passive && !current.passiveUsed) {
      current.gp = 1
      current.passiveUsed = true
      current.effects.push('+1 Second Chance')
    }
  }

  for (const current of state) {
    const { cards } = current
    if (unity) {
      current.attack = 0
      current.gp += 1
      current.effects.push('+1 Gardian Unity')
    }
    const reflect = cards.some((card) => /Reflect/i.test(card.name))
    const protect = protectedTeams.has(current.team.id) || cards.some((card) => /Shield/i.test(card.name))
    if (current.attack < 0 && (unity || protect || reflect)) {
      if (reflect && !unity && !protectedTeams.has(current.team.id)) {
        current.attack = Math.abs(current.attack) * 2
        current.effects.push(`+${current.attack} Reflect (2 × 2 GP)`)
      } else if (!unity) {
        const blocked = protectedTeams.has(current.team.id)
          ? Math.abs(current.attack)
          : Math.min(Math.abs(current.attack), cards.filter((card) => /Shield/i.test(card.name)).reduce((total, card) => total + Number(card.effect_action.match(/melindungi\s*(\d+)/i)?.[1] ?? 1), 0))
        current.attack += blocked
        if (blocked) current.effects.push(`+${blocked} ${protectedTeams.has(current.team.id) ? 'Protect' : 'Shield'}`)
      }
    }
    current.gp = Math.max(0, current.gp + current.attack)
    revive(current)
    for (const card of cards) {
      if (card.effect !== 'Heal' || /Second Chance/i.test(card.name)) continue
      const described = card.effect_action.match(/(?:menambah|tambah|add)\s*\+?(\d+)(?!\d)/i)
      const healed = described && !/\d\s*[-–]\s*\d/.test(card.effect_action) ? Number(described[1]) : /Rare/i.test(card.type) ? 3 : amount(random, 1, 2)
      current.gp += healed
      current.effects.push(`+${healed} Heal`)
    }
  }

  // Apply transfers after the GigaRisk strike and healing have been resolved.
  for (const current of state) {
    const { cards, team } = current
    for (const reverse of cards.filter((card) => /Reverse/i.test(card.name))) {
      const described = reverse.effect_action.match(/(?:ambil|take)\s*\+?(\d+)/i)
      const stolen = described ? Number(described[1]) : /Epic/i.test(reverse.type) ? 2 : 1
      for (const opponent of state) {
        if (opponent === current || opponent.gp <= 0) continue
        const transfer = Math.min(stolen, opponent.gp)
        opponent.gp -= transfer
        current.gp += transfer
        if (transfer) {
          current.effects.push(`+${transfer} Reverse dari ${opponent.team.name}`)
          opponent.effects.push(`-${transfer} Reverse oleh ${team.name}`)
        }
        revive(opponent)
      }
    }
    for (const thief of cards.filter((card) => needsCardTarget(card) && !isProtectCard(card))) {
      for (const targetId of requireCardTargets(teams, team.id, thief, choices[team.id])) {
        const target = state.find((opponent) => opponent.team.id === targetId)!
        const described = thief.effect_action.match(/(?:ambil|take)\s*\+?(\d+)/i)
        const stolen = described ? Number(described[1]) : /Rare|Epic/i.test(thief.type) ? 2 : 1
        const transfer = Math.min(stolen, target.gp)
        target.gp -= transfer
        current.gp += transfer
        if (transfer) {
          current.effects.push(`+${transfer} Dicuri dari ${target.team.name}`)
          target.effects.push(`-${transfer} Dicuri oleh ${team.name}`)
        }
        revive(target)
      }
    }
  }

  return {
    resolvedAt,
    teams: state.map(({ team, gp, attack, effects, cards, passive, passiveUsed }) => ({
      teamId: team.id,
      initialGP: Math.max(0, Math.trunc(team.gp)),
      gigaRisk: attack,
      finalGP: gp,
      effects,
      usedCards: cards.length + Number(passiveUsed),
      usedCardIds: [...cards.map((card) => card.id), ...(passiveUsed && passive ? [passive.id] : [])],
    })),
  }
}
