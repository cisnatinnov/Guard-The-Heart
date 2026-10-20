import { expect, it } from 'vitest'
import { cardAnimation, gigaRiskImpact } from '../src/services/cardPresentation'
import type { TacticalTeamResult } from '../src/services/tacticalPhase'

it.each([
  ['Rare Heal Card #01', 'heal'], ['Normal Shield Card #01', 'shield'],
  ['Rare Protect Card #01', 'protect'], ['Epic Swallow Card #01', 'swallow'],
  ['Normal Thief Card #01', 'thief'], ['Epic Reverse Card #01', 'reverse'],
  ['Legendary Gardian Unity', 'unity'], ['Legendary Second Chance Card', 'revive'],
  ['Rare Fortune Draw Card #01', 'fortune'], ['Epic Reflect Card #01', 'swallow'],
])('animates %s as %s', (name, kind) => expect(cardAnimation(name).kind).toBe(kind))

it.each([
  [-2, [], '−2 GP'], [-1, ['+1 Shield'], 'Shield · −1 GP'],
  [0, ['+2 Shield'], 'Shield'], [0, ['+2 Protect'], 'Protect'],
  [4, ['+4 Swallow'], 'Swallow · +4 GP'],
  [0, ['+2 Gardian Unity protection', '+1 Gardian Unity'], 'Gardian Unity'],
])('labels the saved attack %s with effects %j', (gigaRisk, effects, expected) => {
  const result: TacticalTeamResult = { teamId: 'a', initialGP: 5, finalGP: 7, usedCards: 1, gigaRisk, effects }
  expect(gigaRiskImpact(result)).toBe(expected)
  expect(result.finalGP).toBe(7)
})
