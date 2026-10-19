import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { Card, Challenge, GPTransaction, TeamCard } from '../src/models'
import { TeamController } from '../src/controllers/TeamController'
import { ScoreboardController } from '../src/controllers/ScoreboardController'
import { prepareFortuneOptions } from '../src/services/fortuneDraw'
import { getAssignedChallengeRewardCount } from '../src/services/cardDraw'
import { commitTacticalAssignment, recordGigaRiskGP } from '../src/services/gpTransactions'
import { cardEffectLabel, cardImageFor, CARD_POOL } from '../src/data/card-pool'
import { chooseTacticalCard, readTacticalPhase, resolveTacticalEffects, validateTacticalAttack, type TacticalPhase } from '../src/services/tacticalPhase'

beforeAll(async () => { await initializeAppDatabase() })
afterEach(() => vi.unstubAllGlobals())

function localPhaseStore() {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { get length() { return values.size }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) })
  vi.stubGlobal('window', { dispatchEvent: () => true })
}

async function fixture() {
  const team = await TeamController.create(`Fortune ${crypto.randomUUID()}`)
  const challenge = await Challenge.create({ name: `Fortune test ${crypto.randomUUID()}` })
  const source = (await Card.findOne({ where: { type:'Rare', name:'Rare Fortune Draw Card #01' } }))!
  const card = await TeamCard.create({name:source.name,type:source.type,effect:source.effect,effect_action:source.effect_action,icon:source.icon,team:team.id,challenge_point:null})
  const options = await prepareFortuneOptions(team.id)
  options.sort((a,b) => Number(b.effect === 'Heal') - Number(a.effect === 'Heal'))
  const teams = [{id:team.id,name:team.name,gp:team.total_gp,cards:[card]}]
  const phase: TacticalPhase = { revealed:false, choices:{[team.id]:{cards:[card.id],skipped:false,fortune:{[card.id]:{options,selected:options.find((option) => option.effect === 'Heal')!.id}}}} }
  return {team,challenge,card,options,teams,phase}
}

it('seeds six Fortune copies using the supplied image and exact printed action', () => {
  const cards = CARD_POOL.filter((card) => card.name.startsWith('Rare Fortune Draw'))
  expect(cards).toHaveLength(6)
  expect(cards.every((card) => card.effect_action === 'Ambil 1 dari 3 kartu.')).toBe(true)
  expect(cardImageFor(cards[0].name)).toBe('/cards/Rare_Fortune_Draw Card.png')
  expect(cardImageFor('Epic Reflect Card #01')).toBe('/cards/Epic_Swallow Card.png')
  expect(cardEffectLabel('+4 Reflect (2 × 2 GP)')).toBe('+4 Swallow')
})

it('offers three available Rare copies and requires exactly one offered choice', async () => {
  const {team,card,options,teams,phase} = await fixture()
  expect(new Set(options.map((card) => card.id)).size).toBe(3)
  expect(options.every((card) => card.type === 'Rare' && !/Fortune/.test(card.name))).toBe(true)
  expect(new Set(options.map((card) => cardImageFor(card.name))).size).toBe(3)
  expect(() => validateTacticalAttack(teams,phase)).not.toThrow()
  for (const selected of [undefined,'not-an-option']) {
    phase.choices[team.id].fortune![card.id].selected = selected
    expect(() => validateTacticalAttack(teams,phase)).toThrow('pilih 1 dari 3')
  }
  phase.choices[team.id].fortune![card.id].selected = options[0].id
  const removed = chooseTacticalCard(phase,team.id,card.id,[card.id])
  const restored = chooseTacticalCard(removed,team.id,card.id,[card.id])
  expect(restored.choices[team.id].fortune).toEqual(phase.choices[team.id].fortune)
})

it('awards only the chosen copy once, records its effect, and saves the reward for another challenge', async () => {
  const {team,challenge,card,options,teams,phase} = await fixture()
  const result = resolveTacticalEffects(teams,phase.choices)
  await recordGigaRiskGP(challenge.id,result)
  expect((await team.reload()).total_gp).toBe(3)
  expect(await TeamCard.count({where:{team:team.id}})).toBe(2)
  expect((await Card.findByPk(options[0].id))?.team).toBe(team.id)
  for (const option of options.slice(1)) expect((await Card.findByPk(option.id))?.team).toBeNull()
  expect(result.teams[0].cardEffects?.[card.id]).toContainEqual(expect.stringMatching(/Fortune Draw: \+1 Rare .+challenge berikutnya/))
  const reward = (await TeamCard.findAll({where:{team:team.id}})).find((entry)=>entry.id !== card.id)!
  expect(result.teams[0].usedCardIds).not.toContain(reward.id)
  expect(result.teams[0].cardEffects?.[reward.id]).toBeUndefined()
  expect(result.teams[0].effects).not.toContain('+3 Heal')
  expect(await GPTransaction.count({where:{challenge:challenge.id,category:'card'}})).toBe(1)
  await expect(recordGigaRiskGP(challenge.id,result)).rejects.toThrow('sudah diserang')
  await recordGigaRiskGP(challenge.id,result,true)
  expect(await TeamCard.count({where:{team:team.id}})).toBe(2)
})

it('rolls back the entire attack when a chosen card is no longer available', async () => {
  const {team,challenge,options,teams,phase} = await fixture()
  const selected = (await Card.findByPk(options[0].id))!
  await selected.update({challenge:challenge.id})
  await expect(recordGigaRiskGP(challenge.id,resolveTacticalEffects(teams,phase.choices))).rejects.toThrow('tidak tersedia')
  expect((await team.reload()).total_gp).toBe(5)
  expect(await GPTransaction.count({where:{challenge:challenge.id}})).toBe(0)
  expect(await TeamCard.count({where:{team:team.id}})).toBe(1)
})

it('excludes already-owned Rare designs and reports exhaustion without consuming any offer', async () => {
  const {team} = await fixture()
  for (const prefix of ['Rare Heal','Rare Protect','Rare Thief']) {
    const definition = CARD_POOL.find((card) => card.name.startsWith(prefix))!
    await TeamCard.create({...definition,team:team.id,challenge_point:null})
  }
  await expect(prepareFortuneOptions(team.id)).rejects.toThrow('perlu 3 kartu Rare')
})

it('uses the space freed by Fortune Draw when the team already holds eight cards', async () => {
  const {team,challenge,teams,phase} = await fixture()
  const designs = new Set<string>()
  const additions = CARD_POOL.filter((card) => {
    const image = cardImageFor(card.name)!
    if (card.type === 'Rare' || designs.has(image)) return false
    designs.add(image)
    return true
  }).slice(0,7)
  for (const definition of additions) await TeamCard.create({...definition,team:team.id,challenge_point:null})
  expect(await TeamCard.count({where:{team:team.id}})).toBe(8)
  await recordGigaRiskGP(challenge.id,resolveTacticalEffects(teams,phase.choices))
  // Archived Fortune + eight available cards.
  expect(await TeamCard.count({where:{team:team.id}})).toBe(9)
})

it('rolls back an already-granted reward when another part of the attack fails', async () => {
  const {team,challenge,options,teams,phase} = await fixture()
  const result = resolveTacticalEffects(teams,phase.choices)
  result.teams.push({teamId:'missing-team',initialGP:5,finalGP:3,gigaRisk:-2,effects:[],usedCards:0})
  await expect(recordGigaRiskGP(challenge.id,result)).rejects.toThrow('Tim tidak ditemukan')
  expect((await Card.findByPk(options[0].id))?.team).toBeNull()
  expect(await TeamCard.count({where:{team:team.id}})).toBe(1)
  expect(await GPTransaction.count({where:{challenge:challenge.id}})).toBe(0)
  expect((await team.reload()).total_gp).toBe(5)
})

it('keeps Fortune rewards outside the normal challenge assignment quota', async () => {
  const {team,challenge,options,teams,phase} = await fixture()
  const normal = (await Card.findOne({where:{name:'Normal Heal Card #01'}}))!
  await normal.update({team:team.id,challenge:challenge.id})
  const resolution = resolveTacticalEffects(teams,phase.choices)
  await recordGigaRiskGP(challenge.id,resolution)
  vi.stubGlobal('localStorage', { getItem:(key:string) => key === `guard-the-heart-gigarisk-completed:${challenge.id}` ? JSON.stringify({...phase,resolution}) : null })
  expect((await Card.findByPk(options[0].id))?.team).toBe(team.id)
  expect(await Card.count({where:{challenge:challenge.id,team:team.id}})).toBe(2)
  expect(await getAssignedChallengeRewardCount(challenge.id,team.id)).toBe(1)
})

it.each(['Rare Heal','Rare Protect','Rare Thief'])('Fortune saves %s without activating it or requiring a target in this challenge', (prefix) => {
  const fortune = {...CARD_POOL.find((card)=>card.name.startsWith('Rare Fortune Draw'))!,id:'fortune'}
  const options = ['Rare Heal','Rare Protect','Rare Thief'].map((name,index)=>({...CARD_POOL.find((card)=>card.name.startsWith(name))!,id:`option-${index}`,type:'Rare' as const}))
  const selected = options.find((card)=>card.name.startsWith(prefix))!
  const teams = [{id:'a',name:'A',gp:5,cards:[fortune]},{id:'b',name:'B',gp:5,cards:[]}]
  const phase: TacticalPhase = {revealed:false,choices:{a:{cards:[fortune.id],skipped:false,fortune:{fortune:{options,selected:selected.id}}}}}
  expect(()=>validateTacticalAttack(teams,phase)).not.toThrow()
  const result = resolveTacticalEffects(teams,phase.choices)
  expect(result.teams.map((team)=>team.finalGP)).toEqual([3,3])
  expect(result.teams[0].fortuneDraws?.[0].selected).toBe(selected.id)
  expect(result.teams[0].usedCardIds).toEqual([fortune.id])
})

it('allows a drawn Heal to be played with its normal effect in another challenge', async () => {
  const {team,challenge,card,teams,phase} = await fixture()
  const first = resolveTacticalEffects(teams,phase.choices)
  await recordGigaRiskGP(challenge.id,first)
  const reward = (await TeamCard.findAll({where:{team:team.id}})).find((entry)=>entry.id !== card.id)!
  const next = await Challenge.create({name:'Next Fortune challenge'})
  const inputs = [{id:team.id,name:team.name,gp:(await team.reload()).total_gp,cards:[reward]}]
  const nextPhase = chooseTacticalCard({revealed:false,choices:{}},team.id,reward.id,[reward.id])
  validateTacticalAttack(inputs,nextPhase)
  const second = resolveTacticalEffects(inputs,nextPhase.choices)
  await recordGigaRiskGP(next.id,second)
  expect((await team.reload()).total_gp).toBe(4)
  expect(second.teams[0].usedCardIds).toEqual([reward.id])
  expect(second.teams[0].effects).toContain('+3 Heal')
})

it('grants Fortune on confirmation, preserves it through retargeting/reload and never grants it again at damage', async () => {
  localPhaseStore()
  const { team, challenge, card, options, teams, phase } = await fixture()
  const selected = options.find((option) => option.effect !== 'Heal')!
  phase.choices[team.id].fortune![card.id].selected = selected.id
  await commitTacticalAssignment(challenge.id, teams, phase)
  let saved = readTacticalPhase(challenge.id)
  const draw = saved.assignment!.teams[0].fortuneDraws![0]
  expect(draw.rewardId).toBeTruthy()
  expect(await TeamCard.count({ where: { team: team.id } })).toBe(2)
  expect((await team.reload()).total_gp).toBe(5)
  expect(await getAssignedChallengeRewardCount(challenge.id, team.id)).toBe(0)
  expect((await ScoreboardController.availableCardCounts()).get(team.id)).toBe(1)
  await commitTacticalAssignment(challenge.id, teams, saved)
  saved = readTacticalPhase(challenge.id)
  expect(saved.assignment!.teams[0].fortuneDraws![0].rewardId).toBe(draw.rewardId)
  const damage = resolveTacticalEffects(teams, saved.choices, () => 0, 99, 'damage', saved.assignment)
  await recordGigaRiskGP(challenge.id, damage)
  expect(await TeamCard.count({ where: { team: team.id } })).toBe(2)
  expect((await team.reload()).total_gp).toBe(3)
  expect(damage.teams[0].cardEffects![card.id]).toHaveLength(1)
})

it('returns an immediate Fortune reward on deselection and rolls back a failed replacement', async () => {
  localPhaseStore()
  const { team, challenge, card, options, teams, phase } = await fixture()
  const selected = options.find((option) => option.effect !== 'Heal')!
  phase.choices[team.id].fortune![card.id].selected = selected.id
  await commitTacticalAssignment(challenge.id, teams, phase)
  const saved = readTacticalPhase(challenge.id)
  const unavailable = options.find((option) => option.id !== selected.id)!
  await (await Card.findByPk(unavailable.id))!.update({ challenge: challenge.id })
  const changed = structuredClone(saved)
  changed.choices[team.id].fortune![card.id].selected = unavailable.id
  await expect(commitTacticalAssignment(challenge.id, teams, changed)).rejects.toThrow('tidak tersedia')
  expect((await Card.findByPk(selected.id))!.team).toBe(team.id)
  expect(await TeamCard.count({ where: { team: team.id } })).toBe(2)
  const removed = chooseTacticalCard(saved, team.id, card.id, [card.id])
  await commitTacticalAssignment(challenge.id, teams, removed)
  expect(await TeamCard.count({ where: { team: team.id } })).toBe(1)
  expect((await Card.findByPk(selected.id))!.team).toBeNull()
  expect((await team.reload()).total_gp).toBe(5)
})
