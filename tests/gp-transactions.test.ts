import { beforeAll, expect, it } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { Challenge, GPTransaction } from '../src/models'
import { TeamController } from '../src/controllers/TeamController'
import { recordGigaRiskGP, syncRewardGP } from '../src/services/gpTransactions'

beforeAll(async () => { await initializeAppDatabase() })

it('records opening, rewards, attacks and card effects without erasing combat on recalculation', async () => {
  const team = await TeamController.create('Ledger test team')
  const challenge = await Challenge.create({ name: 'Ledger test challenge' })
  expect(await GPTransaction.findOne({ where: { team: team.id, category: 'opening' } })).toMatchObject({ gp_before: 0, delta: 5, gp_after: 5 })
  const earned = new Map([[team.id, 3]])
  await syncRewardGP(earned, challenge.id)
  await syncRewardGP(earned, challenge.id)
  expect(await GPTransaction.count({ where: { team: team.id, category: 'reward' } })).toBe(1)
  const resolution = { resolvedAt: Date.now(), teams: [{ teamId: team.id, initialGP: 8, gigaRisk: 2, finalGP: 7, effects: ['Shield memblokir 1 GP'], usedCards: 1 }] }
  await recordGigaRiskGP(challenge.id, resolution)
  expect(await GPTransaction.findOne({ where: { team: team.id, category: 'attack' } })).toMatchObject({ gp_before: 8, delta: -2, gp_after: 6 })
  expect(await GPTransaction.findOne({ where: { team: team.id, category: 'card' } })).toMatchObject({ gp_before: 6, delta: 1, gp_after: 7 })
  await expect(recordGigaRiskGP(challenge.id, resolution)).rejects.toThrow('sudah diserang')
  await syncRewardGP(earned)
  expect((await team.reload()).total_gp).toBe(7)
  await syncRewardGP(new Map([[team.id, 5]]))
  expect((await team.reload()).total_gp).toBe(9)
  await recordGigaRiskGP(challenge.id, resolution, true)
  expect((await team.reload()).total_gp).toBe(9)
})
