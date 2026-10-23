import { describe, expect, it } from 'vitest'
import { CROCODILE_BITE_MS, CROCODILE_TEETH, createCrocodileRound, configureCrocodileTeeth, nextCrocodileRound, pressCrocodileTooth } from '../src/services/games/crocodile'

describe('crocodile bite toy', () => {
  it('keeps safe teeth pressed and locks the mouth on the single biting tooth', () => {
    const initial = createCrocodileRound(undefined, () => 0)
    const safe = pressCrocodileTooth(initial, 1, 100)
    expect(safe.pressed).toEqual([1])
    expect(safe.reopenAt).toBeNull()
    expect(pressCrocodileTooth(safe, 1)).toBe(safe)
    const bite = pressCrocodileTooth(safe, 0, 100)
    expect(bite.reopenAt).toBe(100 + CROCODILE_BITE_MS)
    expect(pressCrocodileTooth(bite, 2, 101)).toBe(bite)
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

it('admin can select several biting teeth and keep them across rounds', () => {
  const round = configureCrocodileTeeth(createCrocodileRound(), [1, 4, 13, 4])
  expect(round.bitingTeeth).toEqual([1, 4, 13])
  expect(pressCrocodileTooth(round, 2, 100).reopenAt).toBeNull()
  for (const tooth of [1, 4, 13]) {
    const bite = pressCrocodileTooth(round, tooth, 100)
    expect(bite.reopenAt).toBe(100 + CROCODILE_BITE_MS)
    const next = nextCrocodileRound(bite)
    expect(next.bitingTeeth).toEqual([1, 4, 13])
    expect(next.pressed).toEqual([])
    expect(next.reopenAt).toBeNull()
  }
  expect(() => configureCrocodileTeeth(round, [])).toThrow('at least one')
  expect(() => configureCrocodileTeeth(round, [14])).toThrow('valid')
  expect(() => configureCrocodileTeeth(pressCrocodileTooth(round, 1), [2])).toThrow('reopen')
  expect(nextCrocodileRound(createCrocodileRound(undefined, () => 0)).bitingTooth).not.toBe(0)
})

it('accepts the first press at the end of a bite even when the reopen callback has not run', () => {
  const round = configureCrocodileTeeth(createCrocodileRound(), [0, 4])
  const first = pressCrocodileTooth(round, 0, 100)
  expect(pressCrocodileTooth(first, 1, first.reopenAt! - 1)).toBe(first)
  const safe = pressCrocodileTooth(first, 1, first.reopenAt!)
  expect(safe.pressed).toEqual([1])
  expect(safe.reopenAt).toBeNull()
  expect(safe.bitingTeeth).toEqual([0, 4])
  const second = pressCrocodileTooth(first, 4, first.reopenAt!)
  expect(second.pressed).toEqual([4])
  expect(second.reopenAt).toBe(first.reopenAt! + CROCODILE_BITE_MS)
})
