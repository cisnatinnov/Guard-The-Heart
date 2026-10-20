import type { TacticalTeamResult } from './tacticalPhase'

export function cardAnimation(name: string) {
  if (/Second Chance/i.test(name)) return { kind: 'revive', symbol: '✦' }
  if (/Gardian Unity/i.test(name)) return { kind: 'unity', symbol: '◎' }
  if (/Fortune Draw/i.test(name)) return { kind: 'fortune', symbol: '✧' }
  if (/Swallow|Reflect/i.test(name)) return { kind: 'swallow', symbol: '◀' }
  if (/Protect/i.test(name)) return { kind: 'protect', symbol: '⬡' }
  if (/Shield/i.test(name)) return { kind: 'shield', symbol: '⬡' }
  if (/Thief/i.test(name)) return { kind: 'thief', symbol: '●' }
  if (/Reverse/i.test(name)) return { kind: 'reverse', symbol: '↻' }
  if (/Heal/i.test(name)) return { kind: 'heal', symbol: '+' }
  return { kind: 'sparkle', symbol: '✦' }
}

/** Labels describe the saved attack, without recalculating or applying effects. */
export function gigaRiskImpact(result: TacticalTeamResult): string {
  const amount = `${result.gigaRisk < 0 ? '−' : result.gigaRisk > 0 ? '+' : ''}${Math.abs(result.gigaRisk)} GP`
  if (result.effects.some((effect) => /Swallow/i.test(effect))) return `Swallow · ${amount}`
  if (result.effects.some((effect) => /Gardian Unity protection/i.test(effect))) return 'Gardian Unity'
  if (result.effects.some((effect) => /\bProtect\b/i.test(effect))) return 'Protect'
  if (result.effects.some((effect) => /Shield/i.test(effect))) return result.gigaRisk < 0 ? `Shield · ${amount}` : 'Shield'
  return amount
}
