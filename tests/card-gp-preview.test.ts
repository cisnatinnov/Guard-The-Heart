import { expect, it } from 'vitest'
import { CARD_POOL } from '../src/data/card-pool'
import { cardGPPreview } from '../src/services/cardGPPreview'
import { resolveTacticalEffects, type TacticalTeamInput } from '../src/services/tacticalPhase'

const card = (prefix: string) => ({ ...CARD_POOL.find((entry) => entry.name.startsWith(prefix))!, id: prefix })
it.each([
  ['Normal Heal', 5, 7], ['Rare Heal', 5, 8], ['Normal Shield', 3, 4],
  ['Rare Protect', 3, 5], ['Epic Swallow', 5, 9], ['Legendary Gardian Unity', 5, 6],
])('previews pending %s without changing GP or choices', (prefix, from, to) => {
  const action = card(prefix), teams = [{ id: 'a', name: 'A', gp: 5, cards: [action] }]
  const phase = { revealed: true, choices: { a: { cards: [action.id], skipped: false, targets: { [action.id]: 'a' } } } }
  const before = JSON.stringify({ teams, phase })
  expect(cardGPPreview('a', action, teams, phase).a).toMatchObject({ from, to })
  expect(JSON.stringify({ teams, phase })).toBe(before)
})
it('previews a pending Thief transfer for the owner and both targets without changing balances', () => {
  const thief = card('Epic Thief')
  const initial = [{ id: 'a', name: 'A', gp: 5, cards: [thief] }, { id: 'b', name: 'B', gp: 1, cards: [] }, { id: 'c', name: 'C', gp: 5, cards: [] }]
  const choices = { a: { cards: [thief.id], skipped: false, targets: { [thief.id]: ['b', 'c'] } } }
  const assignment = resolveTacticalEffects(initial, choices, () => 0, 1, 'assignment')
  const teams = initial.map((team) => ({ ...team, gp: assignment.teams.find((result) => result.teamId === team.id)!.finalGP }))
  const preview = cardGPPreview('a', thief, teams, { choices, assignment, revealed: true })
  expect(preview.a).toMatchObject({ from: 5, to: 8, label: '+3 GP' })
  expect(preview.b).toMatchObject({ from: 1, to: 0, label: '−1 GP' })
  expect(preview.c).toMatchObject({ from: 5, to: 3, label: '−2 GP' })
})
it('previews each pending Reverse transfer and leaves empty opponents unchanged', () => {
  const reverse = card('Epic Reverse')
  const initial = [{ id: 'a', name: 'A', gp: 5, cards: [reverse] }, { id: 'b', name: 'B', gp: 0, cards: [] }, { id: 'c', name: 'C', gp: 5, cards: [] }]
  const choices = { a: { cards: [reverse.id], skipped: false } }
  const assignment = resolveTacticalEffects(initial, choices, () => 0, 1, 'assignment')
  const teams = initial.map((team) => ({ ...team, gp: assignment.teams.find((result) => result.teamId === team.id)!.finalGP }))
  const preview = cardGPPreview('a', reverse, teams, { choices, assignment, revealed: true })
  expect(preview.a).toMatchObject({ from: 5, to: 6 })
  expect(preview.c).toMatchObject({ from: 5, to: 4 })
  expect(preview.b).toBeUndefined()
})
it('replays actual completed Heal rather than adding Heal to the final GP', () => {
  const heal = card('Rare Heal'), teams = [{ id: 'a', name: 'A', gp: 5, cards: [heal] }]
  const choices = { a: { cards: [heal.id], skipped: false } }
  const resolution = resolveTacticalEffects(teams, choices)
  expect(cardGPPreview('a', heal, teams, { choices, resolution, revealed: true }).a).toMatchObject({ from: 3, to: 6 })
  expect(resolution.teams[0].finalGP).toBe(6)
})
it('replays the completed pre-damage Thief amount rather than applying it twice', () => {
  const thief = card('Rare Thief')
  const teams = [{ id:'a', name:'A', gp:5, cards:[thief] }, { id:'b', name:'B', gp:1, cards:[] }]
  const choices = { a:{ cards:[thief.id], skipped:false, targets:{[thief.id]:'b'} } }
  const resolution = resolveTacticalEffects(teams, choices)
  const preview = cardGPPreview('a', thief, teams, { choices, resolution, revealed:true })
  expect(preview.a).toMatchObject({ from:3, to:4, label:'+1 GP' })
  expect(preview.b).toMatchObject({ from:1, to:0, label:'−1 GP' })
  expect(resolution.teams.map((entry) => entry.finalGP)).toEqual([4,0])
})
it('previews both Protect recipients and clamps an insufficient Shield at zero', () => {
  const protect = card('Rare Protect'), shield = card('Normal Shield')
  const teams: TacticalTeamInput[] = [{ id: 'a', name: 'A', gp: 1, cards: [protect, shield] }, { id: 'b', name: 'B', gp: 5, cards: [] }]
  const choices = { a: { cards: [protect.id], skipped: false, targets: { [protect.id]: 'b' } } }
  const preview = cardGPPreview('a', protect, teams, { choices, revealed: true })
  expect(preview.a).toMatchObject({ from: 0, to: 1, label: '2 GP blocked' })
  expect(preview.b).toMatchObject({ from: 3, to: 5, label: '2 GP blocked' })
  expect(cardGPPreview('a', shield, teams, { choices, revealed: true }).a).toMatchObject({ from: 0, to: 0 })
})
it('does not invent GP for Fortune Draw or a saved shield that blocked no damage', () => {
  const fortune = card('Rare Fortune Draw'), shield = card('Normal Shield'), protect = card('Rare Protect')
  const teams = [{ id: 'a', name: 'A', gp: 5, cards: [shield, protect, fortune] }]
  const choices = { a: { cards: [shield.id, protect.id], skipped: false, targets: { [protect.id]: 'a' } } }
  const resolution = resolveTacticalEffects(teams, choices)
  const phase = { choices, resolution, revealed: true }
  expect(cardGPPreview('a', fortune, teams, phase)).toEqual({})
  expect(cardGPPreview('a', shield, teams, phase)).toEqual({})
})
