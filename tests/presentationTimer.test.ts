import { expect, it } from 'vitest'
import { PRESENTATION_SLIDES, presentationTimerRemaining } from '../src/services/publicPresentation'

it('removes original slide four and places the timer at visible slide five', () => {
  expect(PRESENTATION_SLIDES).toEqual([1, 2, 3, 5, 'timer', 6, 7])
})

it('keeps paused time stable and clamps running time at expiry', () => {
  const timer = { duration: 900, remaining: 15, deadline: null, label: 'Challenge' }
  expect(presentationTimerRemaining(timer, 30000)).toBe(15)
  expect(presentationTimerRemaining({ ...timer, deadline: 45000 }, 30100)).toBe(15)
  expect(presentationTimerRemaining({ ...timer, deadline: 45000 }, 35000)).toBe(10)
  expect(presentationTimerRemaining({ ...timer, deadline: 45000 }, 60000)).toBe(0)
})
