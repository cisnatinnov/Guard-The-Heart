import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { Challenge, GPTransaction } from '../src/models'
import { TeamController } from '../src/controllers/TeamController'
import { CARD_POOL } from '../src/data/card-pool'
import { commitTacticalAssignment, recordGigaRiskGP, syncRewardGP } from '../src/services/gpTransactions'
import { readTacticalPhase, resolveTacticalEffects, usedTacticalCardIds, type TacticalChoice, type TacticalPhase } from '../src/services/tacticalPhase'

beforeAll(async () => { await initializeAppDatabase() })
beforeEach(() => {
 const store = new Map<string,string>()
 vi.stubGlobal('localStorage', {get length(){return store.size},key:(i:number)=>[...store.keys()][i]??null,getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>store.set(key,value)})
 vi.stubGlobal('window', {dispatchEvent:()=>true})
})
afterEach(() => vi.unstubAllGlobals())
const card = (name:string) => ({...CARD_POOL.find((entry)=>entry.name.startsWith(name))!,id:name})

it('persists assignment GP, reverses retargeting/deselection, and does not repeat effects on damage or rewards', async () => {
 const a=await TeamController.create('Immediate A'), b=await TeamController.create('Immediate B'), c=await TeamController.create('Immediate C')
 const challenge=await Challenge.create({name:'Immediate effects'})
 const heal=card('Normal Heal'), thief=card('Normal Thief')
 const inputs=[{id:a.id,name:a.name,gp:5,cards:[heal,thief]},{id:b.id,name:b.name,gp:5,cards:[]},{id:c.id,name:c.name,gp:5,cards:[]}]
 const save = async (choice:TacticalChoice) => commitTacticalAssignment(challenge.id,inputs,{...readTacticalPhase(challenge.id),choices:{[a.id]:choice}})
 const gps=async()=>Promise.all([a,b,c].map(async(team)=>(await team.reload()).total_gp))
 await save({cards:[heal.id,thief.id],skipped:false,targets:{[thief.id]:b.id}})
 expect(await gps()).toEqual([8,4,5])
 await save({cards:[heal.id,thief.id],skipped:false,targets:{[thief.id]:c.id}})
 expect(await gps()).toEqual([8,5,4])
 await save({cards:[heal.id],skipped:false})
 expect(await gps()).toEqual([7,5,5])
 await save({cards:[heal.id],skipped:false})
 expect(await gps()).toEqual([7,5,5])
 const phase=readTacticalPhase(challenge.id)
 const damage=resolveTacticalEffects(inputs.map((input)=>({...input,gp:input.id===a.id?7:5})),phase.choices,()=>0,10,'damage',phase.assignment)
 await recordGigaRiskGP(challenge.id,damage)
 expect(await gps()).toEqual([5,3,3])
 await syncRewardGP(new Map())
 expect(await gps()).toEqual([5,3,3])
 expect(await GPTransaction.count({where:{source_key:`assignment:${challenge.id}:${a.id}`}})).toBe(1)
 await expect(commitTacticalAssignment(challenge.id,inputs,phase)).rejects.toThrow()
})

it.each([
 ['Normal Shield',5,4],['Rare Protect',5,5],['Epic Swallow',5,9],
] as const)('%s waits for damage', (name,assigned,after) => {
 const action=card(name), teams=[{id:'a',name:'A',gp:5,cards:[action]}]
 const choices={a:{cards:[action.id],skipped:false,targets:{[action.id]:'a'}}}
 const stage=resolveTacticalEffects(teams,choices,()=>0,1,'assignment')
 expect(stage.teams[0].finalGP).toBe(assigned)
 expect(resolveTacticalEffects(teams,choices,()=>0,2,'damage',stage).teams[0].finalGP).toBe(after)
})

it('Reverse and Unity apply at assignment, and Unity protects every team on damage without another bonus', () => {
 const reverse=card('Epic Reverse'), unity=card('Legendary Gardian Unity')
 const teams=['a','b','c'].map((id)=>({id,name:id,gp:5,cards:id==='a'?[reverse]:id==='b'?[unity]:[]}))
 const choices={a:{cards:[reverse.id],skipped:false},b:{cards:[unity.id],skipped:false}}
 const stage=resolveTacticalEffects(teams,choices,()=>0,1,'assignment')
 expect(stage.teams.map((entry)=>entry.finalGP)).toEqual([8,5,5])
 const updated=teams.map((team,index)=>({...team,gp:stage.teams[index].finalGP}))
 const damage=resolveTacticalEffects(updated,choices,()=>0,2,'damage',stage)
 expect(damage.teams.map((entry)=>[entry.gigaRisk,entry.finalGP])).toEqual([[0,8],[0,5],[0,5]])
})

it.each(['unselected','skipped','other card selected'] as const)('does not grant Unity GP or protection when the card is %s', (status) => {
 const unity=card('Legendary Gardian Unity'), shield=card('Normal Shield')
 const teams=[{id:'a',name:'A',gp:5,cards:[unity,shield]},{id:'b',name:'B',gp:5,cards:[]}]
 const choices:Record<string,TacticalChoice>=status==='unselected'?{}:{a:{cards:status==='skipped'?[unity.id]:[shield.id],skipped:status==='skipped'}}
 const assigned=resolveTacticalEffects(teams,choices,()=>0,1,'assignment')
 expect(assigned.teams.map((entry)=>entry.finalGP)).toEqual([5,5])
 expect(assigned.teams.flatMap((entry)=>entry.effects)).toEqual([])
 const damage=resolveTacticalEffects(teams,choices,()=>0,2,'damage',assigned)
 expect(damage.teams.map((entry)=>entry.finalGP)).toEqual(status==='other card selected'?[4,3]:[3,3])
 expect(damage.teams.flatMap((entry)=>entry.effects).some((effect)=>/Unity/i.test(effect))).toBe(false)
})

it('removes the saved Unity bonus on deselection and grants none for owning the card or skipping', async () => {
 const a=await TeamController.create('Unity gate A'), b=await TeamController.create('Unity gate B')
 const challenge=await Challenge.create({name:'Unity explicit use'})
 const unity=card('Legendary Gardian Unity')
 const inputs=[{id:a.id,name:a.name,gp:5,cards:[unity]},{id:b.id,name:b.name,gp:5,cards:[]}]
 const save=async(choice:TacticalChoice)=>commitTacticalAssignment(challenge.id,inputs,{...readTacticalPhase(challenge.id),choices:{[a.id]:choice}})
 const gps=async()=>Promise.all([a,b].map(async(team)=>(await team.reload()).total_gp))
 await save({cards:[],skipped:false})
 expect(await gps()).toEqual([5,5])
 await save({cards:[unity.id],skipped:false})
 expect(await gps()).toEqual([6,6])
 await save({cards:[],skipped:false})
 expect(await gps()).toEqual([5,5])
 await save({cards:[],skipped:true})
 expect(await gps()).toEqual([5,5])
 expect(readTacticalPhase(challenge.id).assignment?.teams.flatMap((entry)=>entry.effects)).toEqual([])
})

it('Second Chance triggers at zero during assignment and cannot revive again after damage', () => {
 const thief=card('Normal Thief'), passive=card('Legendary Second Chance')
 const teams=[{id:'a',name:'A',gp:5,cards:[thief]},{id:'b',name:'B',gp:1,cards:[passive]}]
 const choices={a:{cards:[thief.id],skipped:false,targets:{[thief.id]:'b'}},b:{cards:[passive.id],skipped:false}}
 const assignment=resolveTacticalEffects(teams,choices,()=>0,1,'assignment')
 expect(assignment.teams.map((entry)=>entry.finalGP)).toEqual([6,1])
 expect(assignment.teams[1].passiveCardIds).toEqual([passive.id])
 const phase:TacticalPhase={choices,revealed:false,assignment}
 localStorage.setItem('guard-the-heart-tactical:example',JSON.stringify(phase))
 expect(usedTacticalCardIds().has(passive.id)).toBe(true)
 expect(usedTacticalCardIds().has(thief.id)).toBe(true)
 expect(usedTacticalCardIds('example').has(passive.id)).toBe(false)
 const damage=resolveTacticalEffects(teams.map((team,index)=>({...team,gp:assignment.teams[index].finalGP})),choices,()=>0,2,'damage',assignment)
 expect(damage.teams[1].finalGP).toBe(0)
 expect(damage.teams[1].cardEffects?.[passive.id]).toEqual(['+1 Second Chance'])
})

it.each(['owned','skipped'] as const)('Second Chance does not activate when only %s', (status) => {
 const passive=card('Legendary Second Chance')
 const teams=[{id:'a',name:'A',gp:1,cards:[passive]}]
 const choices={a:{cards:status==='skipped'?[passive.id]:[],skipped:status==='skipped'}}
 const result=resolveTacticalEffects(teams,choices).teams[0]
 expect(result.finalGP).toBe(0)
 expect(result.usedCardIds).toEqual([])
 expect(result.cardEffects?.[passive.id]).toBeUndefined()
})

it('reserves selected Second Chance while pending and keeps it available after an attack that does not trigger it', () => {
 const passive=card('Legendary Second Chance')
 const teams=[{id:'a',name:'A',gp:5,cards:[passive]}]
 const choices={a:{cards:[passive.id],skipped:false}}
 const assignment=resolveTacticalEffects(teams,choices,()=>0,1,'assignment')
 const phase:TacticalPhase={choices,revealed:false,assignment}
 localStorage.setItem('guard-the-heart-tactical:second',JSON.stringify(phase))
 expect(usedTacticalCardIds().has(passive.id)).toBe(true)
 const resolution=resolveTacticalEffects(teams,choices,()=>0,2,'damage',assignment)
 expect(resolution.teams[0].finalGP).toBe(3)
 expect(resolution.teams[0].usedCards).toBe(0)
 localStorage.setItem('guard-the-heart-tactical:second',JSON.stringify({...phase,resolution}))
 expect(usedTacticalCardIds().has(passive.id)).toBe(false)
})
