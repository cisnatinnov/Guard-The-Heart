import type { RandomSource } from './random'

export const CROCODILE_TEETH = 12
export const CROCODILE_BITE_MS = 1400

export interface CrocodileRound {
  bitingTooth: number
  pressed: number[]
  reopenAt: number | null
}

export function createCrocodileRound(previousTooth?: number, random: RandomSource = Math.random): CrocodileRound {
  const choices = Array.from({ length: CROCODILE_TEETH }, (_, index) => index).filter((tooth) => tooth !== previousTooth)
  return { bitingTooth: choices[Math.floor(random() * choices.length)], pressed: [], reopenAt: null }
}

export function pressCrocodileTooth(round: CrocodileRound, tooth: number, now = Date.now()): CrocodileRound {
  if (round.reopenAt !== null || !Number.isInteger(tooth) || tooth < 0 || tooth >= CROCODILE_TEETH || round.pressed.includes(tooth)) return round
  return { ...round, pressed: [...round.pressed, tooth], reopenAt: tooth === round.bitingTooth ? now + CROCODILE_BITE_MS : null }
}
