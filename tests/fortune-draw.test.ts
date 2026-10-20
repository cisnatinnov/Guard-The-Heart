import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { Card, Challenge, ChallengePoint, TeamCard, GPTransaction } from '../src/models'
import { TeamController } from '../src/controllers/TeamController'
import { prepareFortuneOptions } from '../src/services/fortuneDraw'
import { commitTacticalAssignment, recordGigaRiskGP } from '../src/services/gpTransactions'
import { CARD_POOL, cardImageFor } from '../src/data/card-pool'
import { fortuneEffectKey, hasDistinctFortuneEffects, publishTacticalPhase, readTacticalPhase, resolveTacticalDamage, type TacticalPhase } from '../src/services/tacticalPhase'

beforeAll(async () => {await initializeAppDatabase()})
beforeEach(async () => {
  await TeamCard.destroy({where:{}})
  await Card.update({challenge:null,team:null,challenge_point:null},{where:{}})
  const values = new Map<string,string>()
  vi.stubGlobal('localStorage',{get length(){return values.size},key:(i:number)=>[...values.keys()][i]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)})
  vi.stubGlobal('window',{dispatchEvent:()=>true})
})
afterEach(() => vi.unstubAllGlobals())
async function fixture(stage=1,rank=1) {
  const team = await TeamController.create(`Fortune ${crypto.randomUUID()}`)
  const challenge = await Challenge.create({name:`Challenge ${stage} Fortune ${crypto.randomUUID()}`})
  await ChallengePoint.create({challenge:challenge.id,team:team.id,rank,score:0,challenge_point:0,guard_power:0})
  const source = CARD_POOL.find((card) => /Fortune/.test(card.name))!
  const card = await TeamCard.create({...source,team:team.id,challenge_point:null})
  const options = await prepareFortuneOptions(team.id,undefined,challenge.id)
  const teams = [{id:team.id,name:team.name,gp:5,cards:[card]}]
  const phase:TacticalPhase = {revealed:false,choices:{[team.id]:{cards:[card.id],skipped:false,fortune:{[card.id]:{options,rulesVersion:2}}}}}
  return {team,challenge,card,options,teams,phase}
}
it('uses the requested finite pool counts and supplied card art', () => {
  expect(CARD_POOL).toHaveLength(60)
  expect(CARD_POOL.filter((card)=>/Fortune/.test(card.name))).toHaveLength(4)
  expect(cardImageFor('Rare Fortune Draw Card #01')).toBe('/cards/Rare_Fortune_Draw Card.png')
  expect(cardImageFor('Legendary Gardian Unity')).toBe('/cards/Legend_Gardian Unity.png')
})
it.each([1,2,3])('offers the exact eligible rarity mix in Challenge %i', async (stage) => {
  const {options} = await fixture(stage)
  expect(options.map((card)=>card.type).sort()).toEqual(stage===3?['Epic','Normal','Normal','Rare']:['Normal','Normal','Rare'])
  expect(new Set(options.map(fortuneEffectKey)).size).toBe(options.length)
  expect(hasDistinctFortuneEffects(options)).toBe(true)
})
it.each([2,3,4,5])('enforces Fortune rank %i eligibility in Challenge 3', async (rank) => {
  const {options} = await fixture(3,rank)
  expect(options.every((card)=>card.type!=='Epic'&&card.type!=='Legendary')).toBe(true)
  expect(options.filter((card)=>card.type==='Rare')).toHaveLength(rank<=3?1:0)
  expect(options).toHaveLength(3)
})
it('repairs saved duplicate offers and retains only one award across reload and attack', async () => {
  const {team,challenge,card,teams,phase} = await fixture()
  const thieves = await Card.findAll({where:{type:'Rare',effect:'Thief'},limit:3})
  phase.choices[team.id].fortune![card.id] = {options:thieves.map((card)=>({id:card.id,name:card.name,type:card.type,effect:card.effect,effect_action:card.effect_action,icon:card.icon}))}
  publishTacticalPhase(challenge.id,{...phase,revealed:true})
  await commitTacticalAssignment(challenge.id,teams,phase,{teamId:team.id,cardId:card.id})
  let saved = readTacticalPhase(challenge.id)
  const offer = saved.choices[team.id].fortune![card.id]
  expect(offer.rulesVersion).toBe(2)
  expect(offer.options.map((card)=>card.type).sort()).toEqual(['Normal','Normal','Rare'])
  const selected = offer.options[0].id
  await commitTacticalAssignment(challenge.id,teams,saved,{teamId:team.id,cardId:card.id,selected})
  saved = readTacticalPhase(challenge.id)
  const rewardId = saved.assignment!.teams[0].fortuneDraws![0].rewardId
  expect(rewardId).toBeTruthy()
  expect(await TeamCard.count({where:{team:team.id}})).toBe(2)
  await commitTacticalAssignment(challenge.id,teams,saved,{teamId:team.id,cardId:card.id,selected})
  expect(await TeamCard.count({where:{team:team.id}})).toBe(2)
  await expect(commitTacticalAssignment(challenge.id,teams,saved,{teamId:team.id,cardId:card.id,selected:offer.options[1].id})).rejects.toThrow('sudah dipilih')
  await commitTacticalAssignment(challenge.id,teams,readTacticalPhase(challenge.id),undefined,true)
  saved = readTacticalPhase(challenge.id)
  await recordGigaRiskGP(challenge.id,resolveTacticalDamage(teams,saved))
  expect(await TeamCard.count({where:{team:team.id}})).toBe(2)
  expect((await team.reload()).total_gp).toBe(3)
  expect(await GPTransaction.count({where:{challenge:challenge.id,category:'attack'}})).toBe(1)
})
it('excludes owned designs and never fills scarce effects with duplicate copies', async () => {
  const {team,challenge} = await fixture(1,5)
  for (const name of ['Normal Heal','Normal Shield']) await TeamCard.create({...CARD_POOL.find((card)=>card.name.startsWith(name))!,team:team.id,challenge_point:null})
  const options = await prepareFortuneOptions(team.id,undefined,challenge.id)
  expect(options).toHaveLength(1)
  expect(options[0].name).toMatch(/Thief/)
  await TeamCard.create({...CARD_POOL.find((card)=>card.name.startsWith('Normal Thief'))!,team:team.id,challenge_point:null})
  await expect(prepareFortuneOptions(team.id,undefined,challenge.id)).rejects.toThrow('tidak ada efek berbeda')
})
it('does not grant GP or activate a Fortune Heal in the current challenge', async () => {
  const {team,challenge,card,teams,phase} = await fixture()
  const heal = (await Card.findOne({where:{name:'Normal Heal Card #01'}}))!
  const other = (await Card.findOne({where:{name:'Normal Shield Card #01'}}))!
  const rare = (await Card.findOne({where:{name:'Rare Thief Card #01'}}))!
  const options = [heal,other,rare].map((card)=>({id:card.id,name:card.name,type:card.type,effect:card.effect,effect_action:card.effect_action,icon:card.icon}))
  phase.choices[team.id].fortune![card.id] = {options,rulesVersion:2,selected:heal.id}
  await commitTacticalAssignment(challenge.id,teams,phase,undefined,true)
  const saved = readTacticalPhase(challenge.id)
  expect((await team.reload()).total_gp).toBe(5)
  expect(saved.assignment!.teams[0].effects).not.toContain('+2 Heal')
  await recordGigaRiskGP(challenge.id,resolveTacticalDamage(teams,saved))
  expect((await team.reload()).total_gp).toBe(3)
})

it('changes only public card visibility without rerolling the offer, changing GP or awarding an extra card',async()=>{
 const {team,challenge,card,teams,phase}=await fixture()
 await commitTacticalAssignment(challenge.id,teams,phase,undefined,true)
 const initial=readTacticalPhase(challenge.id)
 const ids=initial.choices[team.id].fortune![card.id].options.map((option)=>option.id)
 await commitTacticalAssignment(challenge.id,teams,initial,{teamId:team.id,cardId:card.id,publicClosed:false})
 let saved=readTacticalPhase(challenge.id)
 expect(saved.choices[team.id].fortune![card.id].publicClosed).toBe(false)
 expect(saved.choices[team.id].fortune![card.id].options.map((option)=>option.id)).toEqual(ids)
 expect((await team.reload()).total_gp).toBe(5)
 expect(await TeamCard.count({where:{team:team.id}})).toBe(1)
 await commitTacticalAssignment(challenge.id,teams,saved,{teamId:team.id,cardId:card.id,selected:ids[0]})
 await commitTacticalAssignment(challenge.id,teams,readTacticalPhase(challenge.id),{teamId:team.id,cardId:card.id,publicClosed:true})
 saved=readTacticalPhase(challenge.id)
 expect(saved.choices[team.id].fortune![card.id].publicClosed).toBe(true)
 expect(saved.choices[team.id].fortune![card.id].selected).toBe(ids[0])
 expect(await TeamCard.count({where:{team:team.id}})).toBe(2)
})

it('finds the full rarity mix when a greedy Rare Thief would block a Normal Thief slot',async()=>{
 const {team,challenge}=await fixture()
 const allowed=new Set(['Normal Shield Card #01','Normal Thief Card #01','Rare Thief Card #01','Rare Protect Card #01'])
 for (const card of await Card.findAll({where:{challenge:null,team:null}})) if (!allowed.has(card.name)) await card.update({challenge:challenge.id})
 const random=vi.spyOn(Math,'random').mockReturnValue(.5)
 try {
  const options=await prepareFortuneOptions(team.id,undefined,challenge.id)
  expect(options.map((card)=>card.type).sort()).toEqual(['Normal','Normal','Rare'])
  expect(options.find((card)=>card.type==='Rare')!.name).toMatch(/Protect/)
  expect(hasDistinctFortuneEffects(options)).toBe(true)
 } finally {random.mockRestore()}
})
