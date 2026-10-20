import { expect, it } from 'vitest'
import { timerRemaining } from '../src/services/eventTimer'

it('keeps paused time stable and clamps running time at expiry', () => {
  const timer = { duration: 900, remaining: 15, deadline: null, label: 'Challenge' }
  expect(timerRemaining(timer, 30000)).toBe(15)
  expect(timerRemaining({ ...timer, deadline: 45000 }, 30100)).toBe(15)
  expect(timerRemaining({ ...timer, deadline: 45000 }, 35000)).toBe(10)
  expect(timerRemaining({ ...timer, deadline: 45000 }, 60000)).toBe(0)
})
