import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { Challenge, GPTransaction, TeamCard } from '../src/models'
import { TeamController } from '../src/controllers/TeamController'
import { CARD_POOL } from '../src/data/card-pool'
import { commitTacticalAssignment, recordGigaRiskGP } from '../src/services/gpTransactions'
import { attackTacticalPhaseOnce, publishTacticalPhase, readTacticalPhase, resolveTacticalDamage, validateTacticalAttack, type TacticalPhase } from '../src/services/tacticalPhase'
beforeAll(async()=>{await initializeAppDatabase()})
beforeEach(()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{get length(){return values.size},key:(i:number)=>[...values.keys()][i]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});vi.stubGlobal('window',{dispatchEvent:()=>true})})
afterEach(()=>vi.unstubAllGlobals())
const card=(prefix:string)=>({...CARD_POOL.find((card)=>card.name.startsWith(prefix))!,id:prefix})
it.each([
 ['Normal Heal',5,7,5],['Rare Heal',1,4,2],['Normal Shield',5,5,4],['Epic Swallow',1,1,5],['Legendary Gardian Unity',1,2,2],
] as const)('%s changes GP only in its specified phase and never replays reveal',async(name,gp,revealed,after)=>{
 const team=await TeamController.create(crypto.randomUUID());await team.update({total_gp:gp})
 const challenge=await Challenge.create({name:crypto.randomUUID()});const action=card(name)
 const teams=[{id:team.id,name:team.name,gp,cards:[action]}]
 const phase:TacticalPhase={revealed:false,choices:{[team.id]:{cards:[action.id],skipped:false}}}
 await commitTacticalAssignment(challenge.id,teams,phase)
 expect((await team.reload()).total_gp).toBe(gp)
 await commitTacticalAssignment(challenge.id,teams,readTacticalPhase(challenge.id),undefined,true)
 expect((await team.reload()).total_gp).toBe(revealed)
 await commitTacticalAssignment(challenge.id,teams,readTacticalPhase(challenge.id),undefined,true)
 expect((await team.reload()).total_gp).toBe(revealed)
 const saved=readTacticalPhase(challenge.id)
 await expect(commitTacticalAssignment(challenge.id,teams,{...saved,revealed:false})).rejects.toThrow('unlocked')
 await recordGigaRiskGP(challenge.id,resolveTacticalDamage([{...teams[0],gp:revealed}],saved))
 expect((await team.reload()).total_gp).toBe(after)
 expect(await GPTransaction.count({where:{source_key:`assignment:${challenge.id}:${team.id}`}})).toBe(1)
})
it('Rare Thief takes only the last available GP on reveal; automatic Second Chance waits for damage',async()=>{
 const a=await TeamController.create(crypto.randomUUID()),b=await TeamController.create(crypto.randomUUID());await b.update({total_gp:1})
 const challenge=await Challenge.create({name:crypto.randomUUID()});const thief=card('Rare Thief'),passive=card('Legendary Second Chance')
 const owned=await TeamCard.create({...passive,team:b.id,challenge_point:null})
 const teams=[{id:a.id,name:a.name,gp:5,cards:[thief]},{id:b.id,name:b.name,gp:1,cards:[owned]}]
 const phase:TacticalPhase={revealed:false,choices:{[a.id]:{cards:[thief.id],skipped:false,targets:{[thief.id]:b.id}},[b.id]:{cards:[],skipped:true}}}
 await commitTacticalAssignment(challenge.id,teams,phase,undefined,true)
 expect([(await a.reload()).total_gp,(await b.reload()).total_gp]).toEqual([6,0])
 const saved=readTacticalPhase(challenge.id)
 expect(saved.assignment!.teams[1].usedCardIds).not.toContain(owned.id)
 await recordGigaRiskGP(challenge.id,resolveTacticalDamage(teams.map((team)=>({...team,gp:team.id===a.id?6:0})),saved))
 expect([(await a.reload()).total_gp,(await b.reload()).total_gp,b.status]).toEqual([4,1,'active'])
 expect(()=>validateTacticalAttack(teams,{revealed:false,choices:{[b.id]:{cards:[owned.id],skipped:false}}})).toThrow('Second Chance')
})
it('cannot revive a second time in a later challenge, even with a stale owned-card list',async()=>{
 const team=await TeamController.create(crypto.randomUUID());await team.update({total_gp:1})
 const passive=await TeamCard.create({...card('Legendary Second Chance'),id:crypto.randomUUID(),team:team.id,challenge_point:null})
 const teams=[{id:team.id,name:team.name,gp:1,cards:[passive]}]
 for (const expected of [1,0]) {
  const challenge=await Challenge.create({name:crypto.randomUUID()})
  publishTacticalPhase(challenge.id,{revealed:false,choices:{[team.id]:{cards:[],skipped:true}}})
  await attackTacticalPhaseOnce(challenge.id,teams,(result)=>recordGigaRiskGP(challenge.id,result))
  expect((await team.reload()).total_gp).toBe(expected)
 }
})
