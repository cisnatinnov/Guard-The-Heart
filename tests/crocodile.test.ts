import { describe, expect, it } from 'vitest'
import { CROCODILE_BITE_MS, CROCODILE_TEETH, createCrocodileRound, pressCrocodileTooth } from '../src/services/games/crocodile'

describe('crocodile bite toy', () => {
  it('keeps safe teeth pressed and locks the mouth on the single biting tooth', () => {
    const initial = createCrocodileRound(undefined, () => 0)
    const safe = pressCrocodileTooth(initial, 1, 100)
    expect(safe.pressed).toEqual([1])
    expect(safe.reopenAt).toBeNull()
    expect(pressCrocodileTooth(safe, 1)).toBe(safe)
    const bite = pressCrocodileTooth(safe, 0, 100)
    expect(bite.reopenAt).toBe(100 + CROCODILE_BITE_MS)
    expect(pressCrocodileTooth(bite, 2)).toBe(bite)
  })

  it('chooses a different hidden tooth after every bite and resets all teeth', () => {
    for (let previous = 0; previous < CROCODILE_TEETH; previous++) {
      for (const random of [0, .3, .7, .999999]) {
        const next = createCrocodileRound(previous, () => random)
        expect(next.bitingTooth).not.toBe(previous)
        expect(next.bitingTooth).toBeGreaterThanOrEqual(0)
        expect(next.bitingTooth).toBeLessThan(CROCODILE_TEETH)
        expect(next.pressed).toEqual([])
        expect(next.reopenAt).toBeNull()
      }
    }
  })
})
