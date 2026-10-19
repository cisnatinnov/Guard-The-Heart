import { beforeAll, expect, it } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { Challenge, GPTransaction } from '../src/models'
import { TeamController } from '../src/controllers/TeamController'
import { initializeGPTransactions, recordGigaRiskGP, syncRewardGP } from '../src/services/gpTransactions'

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

it('deactivates at final zero GP and preserves deactivation on reload/recalculation', async () => {
 const team=await TeamController.create('Eliminated team')
 const challenge=await Challenge.create({name:'Elimination test'})
 await recordGigaRiskGP(challenge.id,{resolvedAt:10,teams:[{teamId:team.id,initialGP:5,gigaRisk:-2,finalGP:0,effects:['-3 Dicuri oleh B'],usedCards:0}]})
 expect((await team.reload()).status).toBe('inactive')
 await expect(TeamController.setStatus(team.id,'active')).rejects.toThrow('GP above 0')
 await team.update({status:'active'}) // Simulate a zero-GP record left by an older build.
 await initializeGPTransactions()
 expect((await team.reload()).status).toBe('inactive')
 await syncRewardGP(new Map())
 expect([(await team.reload()).total_gp,team.status]).toEqual([0,'inactive'])
 expect((await TeamController.list()).some((entry)=>entry.id===team.id)).toBe(false)
})
it('keeps a revived team active and does not auto-activate manually inactive teams', async () => {
 const revived=await TeamController.create('Revived team')
 const challenge=await Challenge.create({name:'Revival status test'})
 await recordGigaRiskGP(challenge.id,{resolvedAt:11,teams:[{teamId:revived.id,initialGP:5,gigaRisk:-2,finalGP:1,effects:['+1 Second Chance'],usedCards:1}]})
 expect([(await revived.reload()).total_gp,revived.status]).toEqual([1,'active'])
 await TeamController.setStatus(revived.id,'inactive')
 await syncRewardGP(new Map([[revived.id,3]]))
 expect((await revived.reload()).status).toBe('inactive')
 expect(revived.total_gp).toBeGreaterThan(0)
 expect((await TeamController.setStatus(revived.id,'active'))?.status).toBe('active')
})
it('deactivates a team when a reward correction reduces its GP to zero', async () => {
 const team=await TeamController.create('Corrected eliminated team')
 const challenge=await Challenge.create({name:'Reward elimination test'})
 await syncRewardGP(new Map([[team.id,3]]))
 await recordGigaRiskGP(challenge.id,{resolvedAt:12,teams:[{teamId:team.id,initialGP:8,gigaRisk:-2,finalGP:1,effects:['-5 Dicuri oleh B'],usedCards:0}]})
 await syncRewardGP(new Map())
 expect([(await team.reload()).total_gp,team.status]).toEqual([0,'inactive'])
})
