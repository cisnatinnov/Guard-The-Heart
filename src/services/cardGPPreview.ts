import { resolvedCardEffects } from './cardEffectSummary'
import { selectedCardTargets, type TacticalPhase, type TacticalTeamInput } from './tacticalPhase'

export interface GPPreview { from: number; to: number; label: string; direction: 'up' | 'down' }

/** Presentation only: replay saved outcomes or preview a pending card, never apply it. */
export function cardGPPreview(ownerId: string, card: TacticalTeamInput['cards'][number], teams: readonly TacticalTeamInput[], phase: TacticalPhase): Record<string, GPPreview> {
  const completed = phase.resolution ?? phase.strike
  const saved = completed ?? phase.assignment
  const owner = teams.find((team) => team.id === ownerId)
  if (!owner) return {}
  const result = saved?.teams.find((team) => team.teamId === ownerId)
  const effects = resolvedCardEffects(result, owner.cards, card.id)
  const changes = new Map<string, { amount: number; blocked: number }>()
  const add = (id: string, amount: number, blocked = 0) => {
    if (!teams.some((team) => team.id === id) || !Number.isFinite(amount) || !amount) return
    const previous = changes.get(id) ?? { amount: 0, blocked: 0 }
    changes.set(id, { amount: previous.amount + amount, blocked: previous.blocked + blocked })
  }
  const transferCard = /Thief|Steal|Reverse/i.test(card.name)
  const savedTransfer = transferCard && (!!completed || !!saved?.revealApplied || saved?.effectTimingVersion === 2 && effects.some((effect) => /^\+\d+ (Dicuri dari|Reverse dari)/.test(effect)))
  if (transferCard) {
    // Completed transfers replay exact saved amounts; pending cards only preview.
    for (const effect of effects) {
      const transfer = /^\+(\d+) (?:Dicuri dari|Reverse dari) (.+)$/.exec(effect)
      const target = transfer && teams.find((team) => team.name === transfer[2])
      if (transfer && target) { add(ownerId, Number(transfer[1])); add(target.id, -Number(transfer[1])) }
    }
    if (!savedTransfer) {
      const targets = /Reverse/i.test(card.name) ? teams.filter((team) => team.id !== ownerId).map((team) => team.id)
        : selectedCardTargets(phase.choices[ownerId], card.id)
      const amount = Number(/(?:ambil|take)\s*\+?(\d+)/i.exec(card.effect_action)?.[1] ?? 1)
      for (const targetId of targets) {
        const target = teams.find((team) => team.id === targetId && team.id !== ownerId)
        if (target) { const amountTaken = Math.min(amount, Math.max(0, target.gp)); add(ownerId, amountTaken); add(target.id, -amountTaken) }
      }
    }
  } else if (/Fortune[ _]Draw/i.test(card.name)) {
    return {} // Grants a card, never immediate GP.
  } else if (/Gardian Unity/i.test(card.name)) {
    teams.forEach((team) => add(team.id, completed ? 3 : 1, completed ? 2 : 0))
  } else if (/Protect/i.test(card.name)) {
    new Set([ownerId, ...selectedCardTargets(phase.choices[ownerId], card.id)]).forEach((id) => add(id, 2, 2))
  } else if (/Shield/i.test(card.name)) {
    const savedAmount = effects.reduce((sum, effect) => sum + Number(/^\+(\d+) Shield/.exec(effect)?.[1] ?? 0), 0)
    const blocked = completed ? savedAmount : Math.min(2, Number(/melindungi\s*(\d+)/i.exec(card.effect_action)?.[1] ?? 1))
    add(ownerId, blocked, blocked)
  } else if (/Swallow|Reflect/i.test(card.name)) {
    add(ownerId, completed ? Number(/^\+(\d+) Swallow/.exec(effects.find((effect) => /^\+\d+ Swallow/.test(effect)) ?? '')?.[1] ?? 0) : 4)
  } else if (/Second Chance/i.test(card.name)) {
    if (effects.some((effect) => /^\+1 Second Chance/.test(effect)) || owner.gp === 0) add(ownerId, 1)
  } else if (card.effect === 'Heal') {
    const healed = completed ? effects.reduce((sum, effect) => sum + Number(/^\+(\d+) Heal/.exec(effect)?.[1] ?? 0), 0)
      : Number(/(?:menambah|tambah|add)\s*\+?(\d+)/i.exec(card.effect_action)?.[1] ?? 0)
    add(ownerId, healed)
  }
  return Object.fromEntries([...changes].map(([id, change]) => {
    const actual = completed?.teams.find((team) => team.teamId === id)?.finalGP ?? teams.find((team) => team.id === id)!.gp
    const replay = !!completed || savedTransfer || !!saved?.revealApplied && (card.effect === 'Heal' || /Gardian Unity/i.test(card.name)) || /Second Chance/i.test(card.name) && !!result?.usedCardIds?.includes(card.id)
    const baseline = replay ? actual - change.amount : actual - (change.blocked ? 2 : 0)
    const from = Math.max(0, baseline)
    const to = replay ? actual : Math.max(0, baseline + change.amount)
    const bonus = change.amount - change.blocked
    const label = [change.blocked ? `${change.blocked} GP blocked` : '', bonus ? `${bonus > 0 ? '+' : '−'}${Math.abs(bonus)} GP` : ''].filter(Boolean).join(' · ')
    return [id, { from, to, label, direction: change.amount > 0 ? 'up' : 'down' } satisfies GPPreview]
  }))
}
