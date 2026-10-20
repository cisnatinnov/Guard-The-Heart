import type { CardType } from '../models'
import { CHALLENGE_GAMES } from './games'

export const REWARD_ODDS = [
  [[57,40,0,3],[59,40,0,1],[90,10,0,0],[100,0,0,0]],
  [[52,45,0,3],[54,45,0,1],[85,15,0,0],[100,0,0,0]],
  [[51,38,8,3],[49,50,0,1],[80,20,0,0],[100,0,0,0]],
] as const

/** Built-in identity survives renaming; unnumbered custom challenges use phase 1. */
export function challengeDrawPhase(id: string, name: string): number {
  const index = CHALLENGE_GAMES.findIndex((game) => game.challengeId === id)
  const numbered = Number(name.match(/(?:challenge|fase)\s*(\d+)/i)?.[1] ?? 1)
  return Math.min(3, Math.max(1, index < 0 ? numbered : index + 1))
}

export function rewardRarity(phase: number, rank: number, random = Math.random): CardType | null {
  const weights = REWARD_ODDS[Math.min(3, Math.max(1, phase)) - 1][rank - 1]
  if (!weights) return null
  const roll = Math.max(0, Math.min(.999999, random())) * 100
  if (roll < weights[0]) return 'Normal'
  if (roll < weights[0] + weights[1]) return 'Rare'
  if (roll < weights[0] + weights[1] + weights[2]) return 'Epic'
  return 'Legendary'
}
