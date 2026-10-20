import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { Challenge, GPTransaction, TeamCard } from '../src/models'
import { TeamController } from '../src/controllers/TeamController'
import { CARD_POOL } from '../src/data/card-pool'
import { commitTacticalAssignment, initializeGPTransactions, recordGigaRiskGP, syncRewardGP } from '../src/services/gpTransactions'
import { readTacticalPhase, resolveTacticalDamage, resolveTacticalEffects, usedTacticalCardIds, type TacticalChoice, type TacticalPhase } from '../src/services/tacticalPhase'

beforeAll(async () => { await initializeAppDatabase() })
beforeEach(() => {
 const store = new Map<string,string>()
 vi.stubGlobal('localStorage', {get length(){return store.size},key:(i:number)=>[...store.keys()][i]??null,getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>store.set(key,value)})
 vi.stubGlobal('window', {dispatchEvent:()=>true})
})
afterEach(() => vi.unstubAllGlobals())
const card = (name:string) => ({...CARD_POOL.find((entry)=>entry.name.startsWith(name))!,id:name})

it.each(['Normal Thief', 'Rare Thief', 'Epic Thief'])('%s transfers before its targets lose damage, but never on selection', (name) => {
 const action = card(name)
 const teams = [{ id:'a', name:'A', gp:5, cards:[action] }, { id:'b', name:'B', gp:1, cards:[] }, { id:'c', name:'C', gp:1, cards:[] }]
 const targets = name === 'Epic Thief' ? ['b','c'] : 'b'
 const choices = { a: { cards:[action.id], skipped:false, targets:{[action.id]:targets} } }
 const assignment = resolveTacticalEffects(teams, choices, () => 0, 1, 'assignment')
 expect(assignment.teams.map((entry) => entry.finalGP)).toEqual([5,1,1])
 const result = resolveTacticalDamage(teams, { choices, assignment, revealed:true }, () => 0, 2)
 expect(result.teams.map((entry) => entry.finalGP)).toEqual([name === 'Epic Thief' ? 5 : 4, 0, 0])
 expect(result.teams[0].cardEffects?.[action.id]).toContain('+1 Dicuri dari B')
})

it('Reverse takes available GP before damage and skips empty opponents', () => {
 const action = card('Epic Reverse')
 const teams = [{ id:'a', name:'A', gp:5, cards:[action] }, { id:'b', name:'B', gp:1, cards:[] }, { id:'c', name:'C', gp:0, cards:[] }]
 const choices = { a: { cards:[action.id], skipped:false } }
 const assignment = resolveTacticalEffects(teams, choices, () => 0, 1, 'assignment')
 expect(assignment.teams.map((entry) => entry.finalGP)).toEqual([5,1,0])
 expect(resolveTacticalDamage(teams, { choices, assignment, revealed:true }).teams.map((entry) => entry.finalGP)).toEqual([4,0,0])
})

it('upgrades a pending early transfer once, preserving choices and preventing duplicate transfers on attack', async () => {
 const a = await TeamController.create('Migrate A'), b = await TeamController.create('Migrate B')
 const challenge = await Challenge.create({ name:'Pending timing migration' })
 const action = await TeamCard.create({ ...card('Normal Thief'), id:'migrate-thief', team:a.id, challenge_point:null })
 const choices = { [a.id]: { cards:[action.id], skipped:false, targets:{[action.id]:b.id} } }
 const assignment = { resolvedAt:1, effectTimingVersion:2 as const, teams:[
  { teamId:a.id, initialGP:5, finalGP:6, gigaRisk:0, effects:['+1 Dicuri dari Migrate B'], usedCards:1, usedCardIds:[action.id] },
  { teamId:b.id, initialGP:5, finalGP:4, gigaRisk:0, effects:['-1 Dicuri oleh Migrate A'], usedCards:0, usedCardIds:[] },
 ] }
 await a.update({ total_gp:6 }); await b.update({ total_gp:4 })
 for (const [team, delta] of [[a,1],[b,-1]] as const) await GPTransaction.create({ team:team.id, team_name:team.name, challenge:challenge.id, challenge_name:challenge.name, source_key:`assignment:${challenge.id}:${team.id}`, category:'card', gp_before:5, delta, gp_after:5+delta, description:'Old early transfer' })
 localStorage.setItem(`guard-the-heart-tactical:${challenge.id}`, JSON.stringify({ choices, revealed:true, assignment }))
 await initializeGPTransactions()
 expect([(await a.reload()).total_gp, (await b.reload()).total_gp]).toEqual([5,5])
 expect(readTacticalPhase(challenge.id).assignment?.effectTimingVersion).toBe(4)
 expect(readTacticalPhase(challenge.id).revealed).toBe(true)
 await initializeGPTransactions()
 expect([(await a.reload()).total_gp, (await b.reload()).total_gp]).toEqual([5,5])
 const inputs = [{ id:a.id, name:a.name, gp:5, cards:[action] }, { id:b.id, name:b.name, gp:5, cards:[] }]
 const result = resolveTacticalDamage(inputs, readTacticalPhase(challenge.id))
 await recordGigaRiskGP(challenge.id, result)
 expect([(await a.reload()).total_gp, (await b.reload()).total_gp]).toEqual([4,2])
})

it('selection and retargeting preserve GP, and attack applies effects only once', async () => {
 const a=await TeamController.create('Immediate A'), b=await TeamController.create('Immediate B'), c=await TeamController.create('Immediate C')
 const challenge=await Challenge.create({name:'Immediate effects'})
 const heal=card('Normal Heal'), thief=card('Normal Thief')
 const inputs=[{id:a.id,name:a.name,gp:5,cards:[heal,thief]},{id:b.id,name:b.name,gp:5,cards:[]},{id:c.id,name:c.name,gp:5,cards:[]}]
 const save = async (choice:TacticalChoice) => commitTacticalAssignment(challenge.id,inputs,{...readTacticalPhase(challenge.id),choices:{[a.id]:choice}})
 const gps=async()=>Promise.all([a,b,c].map(async(team)=>(await team.reload()).total_gp))
 await save({cards:[heal.id,thief.id],skipped:false,targets:{[thief.id]:b.id}})
 expect(await gps()).toEqual([5,5,5])
 await save({cards:[heal.id,thief.id],skipped:false,targets:{[thief.id]:c.id}})
 expect(await gps()).toEqual([5,5,5])
 await save({cards:[heal.id],skipped:false})
 expect(await gps()).toEqual([5,5,5])
 await save({cards:[heal.id],skipped:false})
 expect(await gps()).toEqual([5,5,5])
 const phase=readTacticalPhase(challenge.id)
 const damage=resolveTacticalEffects(inputs.map((input)=>({...input,gp:5})),phase.choices,()=>0,10,'damage',phase.assignment)
 await recordGigaRiskGP(challenge.id,damage)
 expect(await gps()).toEqual([5,3,3])
 await syncRewardGP(new Map())
 expect(await gps()).toEqual([5,3,3])
 expect(await GPTransaction.count({where:{source_key:`assignment:${challenge.id}:${a.id}`}})).toBe(1)
 await expect(commitTacticalAssignment(challenge.id,inputs,phase)).rejects.toThrow()
})

it.each([
 ['Normal Shield',5,4],['Rare Protect',5,5],['Epic Swallow',5,9],['Normal Heal',5,5],['Rare Heal',5,6],
] as const)('%s waits for damage', (name,assigned,after) => {
 const action=card(name), teams=[{id:'a',name:'A',gp:5,cards:[action]}]
 const choices={a:{cards:[action.id],skipped:false,targets:{[action.id]:'a'}}}
 const stage=resolveTacticalEffects(teams,choices,()=>0,1,'assignment')
 expect(stage.teams[0].finalGP).toBe(assigned)
 expect(resolveTacticalEffects(teams,choices,()=>0,2,'damage',stage).teams[0].finalGP).toBe(after)
})

it('Reverse waits for attack, transfers before damage, and Unity protects every team with one bonus', () => {
 const reverse=card('Epic Reverse'), unity=card('Legendary Gardian Unity')
 const teams=['a','b','c'].map((id)=>({id,name:id,gp:5,cards:id==='a'?[reverse]:id==='b'?[unity]:[]}))
 const choices={a:{cards:[reverse.id],skipped:false},b:{cards:[unity.id],skipped:false}}
 const stage=resolveTacticalEffects(teams,choices,()=>0,1,'assignment')
 expect(stage.teams.map((entry)=>entry.finalGP)).toEqual([5,5,5])
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

it('does not grant Unity GP until damage and grants none for deselection or skipping', async () => {
 const a=await TeamController.create('Unity gate A'), b=await TeamController.create('Unity gate B')
 const challenge=await Challenge.create({name:'Unity explicit use'})
 const unity=card('Legendary Gardian Unity')
 const inputs=[{id:a.id,name:a.name,gp:5,cards:[unity]},{id:b.id,name:b.name,gp:5,cards:[]}]
 const save=async(choice:TacticalChoice)=>commitTacticalAssignment(challenge.id,inputs,{...readTacticalPhase(challenge.id),choices:{[a.id]:choice}})
 const gps=async()=>Promise.all([a,b].map(async(team)=>(await team.reload()).total_gp))
 await save({cards:[],skipped:false})
 expect(await gps()).toEqual([5,5])
 await save({cards:[unity.id],skipped:false})
 expect(await gps()).toEqual([5,5])
 await save({cards:[],skipped:false})
 expect(await gps()).toEqual([5,5])
 await save({cards:[],skipped:true})
 expect(await gps()).toEqual([5,5])
 expect(readTacticalPhase(challenge.id).assignment?.teams.flatMap((entry)=>entry.effects)).toEqual([])
})

it('Second Chance waits for the attack transfer to reach zero and cannot revive again after damage', () => {
 const thief=card('Normal Thief'), passive=card('Legendary Second Chance')
 const teams=[{id:'a',name:'A',gp:5,cards:[thief]},{id:'b',name:'B',gp:1,cards:[passive]}]
 const choices={a:{cards:[thief.id],skipped:false,targets:{[thief.id]:'b'}},b:{cards:[passive.id],skipped:false}}
 const assignment=resolveTacticalEffects(teams,choices,()=>0,1,'assignment')
 expect(assignment.teams.map((entry)=>entry.finalGP)).toEqual([5,1])
 expect(assignment.teams[1].passiveCardIds).toEqual([])
 const phase:TacticalPhase={choices,revealed:false,assignment}
 localStorage.setItem('guard-the-heart-tactical:example',JSON.stringify(phase))
 expect(usedTacticalCardIds().has(passive.id)).toBe(true)
 expect(usedTacticalCardIds().has(thief.id)).toBe(true)
 expect(usedTacticalCardIds('example').has(passive.id)).toBe(false)
 const damage=resolveTacticalEffects(teams.map((team,index)=>({...team,gp:assignment.teams[index].finalGP})),choices,()=>0,2,'damage',assignment)
 expect(damage.teams[1].finalGP).toBe(1)
 expect(damage.teams[1].cardEffects?.[passive.id]).toEqual(['+1 Second Chance'])
})

it.each(['owned','skipped'] as const)('Second Chance activates automatically when %s', (status) => {
 const passive=card('Legendary Second Chance')
 const teams=[{id:'a',name:'A',gp:1,cards:[passive]}]
 const choices={a:{cards:status==='skipped'?[passive.id]:[],skipped:status==='skipped'}}
 const result=resolveTacticalEffects(teams,choices).teams[0]
 expect(result.finalGP).toBe(1)
 expect(result.usedCardIds).toEqual([passive.id])
 expect(result.cardEffects?.[passive.id]).toEqual(['+1 Second Chance'])
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

it.each([['Normal Heal', 1], ['Rare Heal', 2], ['Legendary Gardian Unity', 2], ['Epic Swallow', 5]] as const)('%s resolves after damage at one GP', (name, expected) => {
 const action = card(name)
 const teams = [{ id: 'a', name: 'A', gp: 1, cards: [action] }]
 const choices = { a: { cards: [action.id], skipped: false } }
 const assignment = resolveTacticalEffects(teams, choices, () => 0, 1, 'assignment')
 expect(assignment.teams[0].finalGP).toBe(1)
 const result = resolveTacticalEffects(teams, choices, () => 0, 2, 'damage', assignment)
 expect(result.teams[0].finalGP).toBe(expected)
})

it('does not count a pending pre-update Heal or Unity bonus twice during damage', () => {
 for (const [name, before, expected] of [['Normal Heal', 7, 5], ['Legendary Gardian Unity', 6, 6]] as const) {
  const action = card(name)
  const teams = [{ id: 'a', name: 'A', gp: before, cards: [action] }]
  const phase: TacticalPhase = { revealed: false, choices: { a: { cards: [action.id], skipped: false } },
   assignment: { resolvedAt: 1, teams: [{ teamId: 'a', initialGP: 5, finalGP: before, gigaRisk: 0,
    effects: [`+${before - 5} old early bonus`], usedCards: 1, usedCardIds: [action.id] }] } }
  const result = resolveTacticalDamage(teams, phase, () => 0, 2).teams[0]
  expect(result.finalGP).toBe(expected)
  expect(result.assignmentGP).toBe(before)
  expect(result.initialGP).toBe(5)
  expect(result.effects).not.toContain(expect.stringContaining('old early bonus'))
 }
})

it('keeps the team active while pending and heals it after theft and damage resolve', async () => {
 const a = await TeamController.create('Post-damage thief'), b = await TeamController.create('Post-damage healed')
 const challenge = await Challenge.create({ name: 'Post-damage recovery' })
 const thief = card('Rare Thief'), heal = card('Normal Heal')
 const setup = await Challenge.create({ name: 'Recovery setup' })
 await recordGigaRiskGP(setup.id, { resolvedAt: 1, teams: [{ teamId: b.id, initialGP: 5, finalGP: 1, gigaRisk: -2, effects: ['setup'], usedCards: 0 }] })
 const teams = [{ id: a.id, name: a.name, gp: 5, cards: [thief] }, { id: b.id, name: b.name, gp: 1, cards: [heal] }]
 await commitTacticalAssignment(challenge.id, teams, { revealed: false, choices: {
  [a.id]: { cards: [thief.id], skipped: false, targets: { [thief.id]: b.id } },
  [b.id]: { cards: [heal.id], skipped: false },
 } })
 expect([(await b.reload()).total_gp, b.status]).toEqual([1, 'active'])
 const current = readTacticalPhase(challenge.id)
 const fresh = teams.map((team) => ({ ...team, gp: current.assignment!.teams.find((entry) => entry.teamId === team.id)!.finalGP }))
 await recordGigaRiskGP(challenge.id, resolveTacticalDamage(fresh, current))
 expect([(await b.reload()).total_gp, b.status]).toEqual([0, 'inactive'])
})
