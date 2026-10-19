import type { RandomSource } from './random'

export const CROCODILE_TEETH = 14
export const CROCODILE_BITE_MS = 4440

export interface CrocodileRound {
  bitingTooth: number
  pressed: number[]
  reopenAt: number | null
  lastPressedAt?: number
}

export function createCrocodileRound(previousTooth?: number, random: RandomSource = Math.random): CrocodileRound {
  const choices = Array.from({ length: CROCODILE_TEETH }, (_, index) => index).filter((tooth) => tooth !== previousTooth)
  return { bitingTooth: choices[Math.floor(random() * choices.length)], pressed: [], reopenAt: null }
}

export function pressCrocodileTooth(round: CrocodileRound, tooth: number, now = Date.now()): CrocodileRound {
  if (round.reopenAt !== null || !Number.isInteger(tooth) || tooth < 0 || tooth >= CROCODILE_TEETH || round.pressed.includes(tooth)) return round
  return { ...round, pressed: [...round.pressed, tooth], lastPressedAt: now, reopenAt: tooth === round.bitingTooth ? now + CROCODILE_BITE_MS : null }
}
