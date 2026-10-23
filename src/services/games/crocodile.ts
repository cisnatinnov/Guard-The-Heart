import type { RandomSource } from './random'

export const CROCODILE_TEETH = 14
export const CROCODILE_BITE_MS = 4440

export interface CrocodileRound {
  bitingTooth: number
  /** Admin-selected teeth; absent means the original random single-tooth mode. */
  bitingTeeth?: number[]
  pressed: number[]
  reopenAt: number | null
  lastPressedAt?: number
}

export function createCrocodileRound(previousTooth?: number, random: RandomSource = Math.random): CrocodileRound {
  const choices = Array.from({ length: CROCODILE_TEETH }, (_, index) => index).filter((tooth) => tooth !== previousTooth)
  return { bitingTooth: choices[Math.floor(random() * choices.length)], pressed: [], reopenAt: null }
}

export function pressCrocodileTooth(round: CrocodileRound, tooth: number, now = Date.now()): CrocodileRound {
  if (!Number.isInteger(tooth) || tooth < 0 || tooth >= CROCODILE_TEETH) return round
  if (round.reopenAt !== null && now >= round.reopenAt) {
    return pressCrocodileTooth(nextCrocodileRound(round), tooth, now)
  }
  if (round.reopenAt !== null || round.pressed.includes(tooth)) return round
  return { ...round, pressed: [...round.pressed, tooth], lastPressedAt: now, reopenAt: (round.bitingTeeth ?? [round.bitingTooth]).includes(tooth) ? now + CROCODILE_BITE_MS : null }
}

/** Applying a configuration opens a fresh mouth; every selected tooth can bite. */
export function configureCrocodileTeeth(round: CrocodileRound, teeth: number[]): CrocodileRound {
  const selected = [...new Set(teeth)].sort((a, b) => a - b)
  if (!selected.length || selected.some((tooth) => !Number.isInteger(tooth) || tooth < 0 || tooth >= CROCODILE_TEETH)) {
    throw new Error('Choose at least one valid biting tooth')
  }
  if (round.reopenAt !== null) throw new Error('Wait for the mouth to reopen')
  return { bitingTooth: selected[0], bitingTeeth: selected, pressed: [], reopenAt: null }
}

export function nextCrocodileRound(round: CrocodileRound): CrocodileRound {
  return round.bitingTeeth
    ? { bitingTooth: round.bitingTeeth[0], bitingTeeth: [...round.bitingTeeth], pressed: [], reopenAt: null }
    : createCrocodileRound(round.bitingTooth)
}
