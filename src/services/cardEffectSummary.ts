import { cardTargetCount, teamUsedCardEffects, type TacticalTeamInput, type TacticalTeamResult } from './tacticalPhase'

/** Compact, saved outcomes caused by this team's played cards, never incoming effects. */
export function resolvedOwnCardEffects(result: TacticalTeamResult | undefined, cards: TacticalTeamInput['cards']): string[] {
  if (!result) return []
  const played = cards.filter((card) => !result.usedCardIds || result.usedCardIds.includes(card.id))
  return teamUsedCardEffects(result, played).map((effect) => {
    // Old archives may lack an attributable outcome. Show the known played
    // action's name rather than a printed rule or an invented GP amount.
    const fallback = played.find((card) => card.effect_action === effect)
    return fallback ? fallback.name.replace(/ #\d+$/, '').replace(/^(Normal|Rare|Epic|Legendary) /, '').replace(/ Card$/, '') : effect
  })
}

/** One slide per consumed card. Older snapshots are filtered by action and play order. */
export function resolvedCardEffects(result: TacticalTeamResult | undefined, cards: TacticalTeamInput['cards'], cardId: string): string[] {
  if (!result) return []
  const played = cards.filter((card) => !result.usedCardIds || result.usedCardIds.includes(card.id))
  const card = played.find((entry) => entry.id === cardId)
  if (!card) return []
  if (result.cardEffects?.[cardId]) return result.cardEffects[cardId]
  const action = card.effect === 'Thief' ? 'Thief' : /Second Chance|Gardian Unity|Heal|Shield|Swallow|Reverse|Protect/i.exec(card.name)?.[0]
  const logs = resolvedOwnCardEffects(result, played).filter((effect) => action === 'Thief'
    ? /^\+\d+ Dicuri dari /i.test(effect)
    : action && effect.replace(/^\+\d+\s+/, '').toLowerCase().startsWith(action.toLowerCase()))
  if (action === 'Thief') {
    const before = played.slice(0, played.indexOf(card)).filter((entry) => entry.effect === 'Thief')
    const offset = before.reduce((sum, entry) => sum + cardTargetCount(entry), 0)
    const own = logs.slice(offset, offset + cardTargetCount(card))
    return own.length ? own : ['Thief']
  }
  if (action === 'Heal' || action === 'Shield') {
    const siblings = played.filter((entry) => new RegExp(action,'i').test(entry.name))
    const own = logs[siblings.indexOf(card)]
    return own ? [own] : [action]
  }
  return logs.length ? logs : action ? [action] : []
}
