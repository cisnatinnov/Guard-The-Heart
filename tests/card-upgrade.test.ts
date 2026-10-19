import { beforeAll, expect, it } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { Card, TeamCard } from '../src/models'
import { TeamController } from '../src/controllers/TeamController'
import { ChallengeController } from '../src/controllers/ChallengeController'
import { ChallengePointController } from '../src/controllers/ChallengePointController'
import { seedCardPool } from '../src/services/cardDraw'
import { CARD_POOL } from '../src/data/card-pool'
import { resolveTacticalEffects, validateTacticalAttack, type TacticalPhase } from '../src/services/tacticalPhase'

beforeAll(async () => { await initializeAppDatabase() })
const actionCard = (prefix: string) => ({...CARD_POOL.find((entry) => entry.name.startsWith(prefix))!,id:prefix})

it('moves Rare Reverse to Epic Reverse and old Epic Reverse to Epic Thief without confusing matching copy numbers', async () => {
  const team = await TeamController.create('Upgrade owner')
  const challenge = await ChallengeController.create('Upgrade check')
  const entry = await ChallengePointController.create({team:team.id,challenge:challenge.id,score:10})
  const reverse = (await Card.findOne({where:{name:'Epic Reverse Card #01'}}))!
  const thief = (await Card.findOne({where:{name:'Epic Thief Card #01'}}))!
  const legacyRare = {name:'Rare Reverse Card #01',type:'Rare' as const,effect:'Utility' as const,icon:'🔄',effect_action:'Ambil 1 Guard Point (GP) dari setiap tim lawan.'}
  const legacyEpic = {...legacyRare,name:'Epic Reverse Card #01',type:'Epic' as const,effect_action:'Ambil 2 Guard Point (GP) dari setiap tim lawan.'}
  await reverse.update({...legacyRare,team:team.id,challenge:challenge.id,challenge_point:entry.id})
  await thief.update({...legacyEpic,team:team.id,challenge:challenge.id,challenge_point:entry.id})
  const ownedRare = await TeamCard.create({...legacyRare,team:team.id,challenge_point:entry.id})
  const ownedEpic = await TeamCard.create({...legacyEpic,team:team.id,challenge_point:entry.id})
  const swallow = (await Card.findOne({where:{name:'Epic Swallow Card #01'}}))!
  await swallow.update({name:'Epic Reflect Card #01',team:team.id,challenge:challenge.id,challenge_point:entry.id,effect_action:'Damage Gigarisk yang diterima dikonversi menjadi Guard Point (GP).'})
  const ownedSwallow = await TeamCard.create({name:swallow.name,type:'Epic',effect:'Defense',effect_action:swallow.effect_action,icon:'💥',team:team.id,challenge_point:entry.id})
  for (let run=0;run<3;run++) {
    await seedCardPool()
    for (const row of [reverse,thief,ownedRare,ownedEpic,swallow]) await row.reload()
    expect([reverse.name,reverse.type,reverse.effect_action]).toEqual(['Epic Reverse Card #01','Epic',legacyRare.effect_action])
    expect([thief.name,thief.type,thief.effect]).toEqual(['Epic Thief Card #01','Epic','Thief'])
    expect([ownedRare.name,ownedEpic.name]).toEqual(['Epic Reverse Card #01','Epic Thief Card #01'])
    for (const row of [reverse,thief,ownedRare,ownedEpic]) expect([row.team,row.challenge_point]).toEqual([team.id,entry.id])
    expect([reverse.challenge,thief.challenge]).toEqual([challenge.id,challenge.id])
    expect(swallow.effect_action).toContain('menjadi +4')
    await ownedSwallow.reload()
    expect([swallow.name,ownedSwallow.name]).toEqual(['Epic Swallow Card #01','Epic Swallow Card #01'])
    expect([ownedSwallow.team,ownedSwallow.challenge_point]).toEqual([team.id,entry.id])
    expect(await Card.count()).toBe(86)
    expect(await Card.count({where:{name:'Epic Reverse Card #01'}})).toBe(1)
    expect(await Card.count({where:{name:'Epic Thief Card #01'}})).toBe(1)
    expect(await Card.count({where:{type:'Rare'}})).toBe(24)
    expect(await Card.count({where:{type:'Epic'}})).toBe(12)
  }
})

it('preserves 6 promoted Reverse copies and 3 renamed Thief copies', () => {
  expect(CARD_POOL.filter((card)=>card.name.startsWith('Epic Reverse Card'))).toHaveLength(6)
  expect(CARD_POOL.filter((card)=>card.name.startsWith('Epic Thief Card'))).toHaveLength(3)
  expect(CARD_POOL.some((card)=>card.name.startsWith('Rare Reverse Card'))).toBe(false)
})

it('Epic Reverse retains one GP from every opponent', () => {
  const card = actionCard('Epic Reverse Card')
  const teams = ['a','b','c','d'].map((id)=>({id,name:id,gp:5,cards:id==='a'?[card]:[]}))
  const phase: TacticalPhase = {revealed:false,choices:{a:{cards:[card.id],skipped:false}}}
  expect(()=>validateTacticalAttack(teams,phase)).not.toThrow()
  expect(resolveTacticalEffects(teams,phase.choices).teams.map((team)=>team.finalGP)).toEqual([6,2,2,2])
})

it('Epic Thief takes 2 GP from two distinct opponents and rejects invalid selections', () => {
  const card = actionCard('Epic Thief Card')
  const teams = ['a','b','c','d'].map((id)=>({id,name:id,gp:5,cards:id==='a'?[card]:[]}))
  const phase: TacticalPhase = {revealed:false,choices:{a:{cards:[card.id],skipped:false,targets:{[card.id]:['b','c']}}}}
  expect(()=>validateTacticalAttack(teams,phase)).not.toThrow()
  expect(resolveTacticalEffects(teams,phase.choices).teams.map((team)=>team.finalGP)).toEqual([7,1,1,3])
  for (const ids of [[],['b'],['b','b'],['a','b'],['b','missing'],['b','c','d']]) {
    const invalid = {a:{...phase.choices.a,targets:{[card.id]:ids}}}
    expect(()=>validateTacticalAttack(teams,{...phase,choices:invalid})).toThrow('dua tim yang berbeda')
    expect(()=>resolveTacticalEffects(teams,invalid)).toThrow('dua tim yang berbeda')
  }
})

it('caps theft by remaining balance and does not swallow an attack prevented by Unity', () => {
  const thief = actionCard('Epic Thief Card')
  const teams = [{id:'a',name:'A',gp:5,cards:[thief]},{id:'b',name:'B',gp:3,cards:[]},{id:'c',name:'C',gp:1,cards:[]}]
  expect(resolveTacticalEffects(teams,{a:{cards:[thief.id],skipped:false,targets:{[thief.id]:['b','c']}}}).teams.map((team)=>team.finalGP)).toEqual([6,0,0])
  const cards = [actionCard('Epic Swallow Card'),actionCard('Legendary Gardian Unity')]
  const result = resolveTacticalEffects([{id:'a',name:'A',gp:5,cards}],{a:{cards:cards.map((card)=>card.id),skipped:false}}).teams[0]
  expect([result.gigaRisk,result.finalGP]).toEqual([0,6])
})
