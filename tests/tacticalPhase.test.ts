import { expect, it } from 'vitest'
import { chooseTacticalCard, hasTacticalDecisions, resolveTacticalEffects, setTacticalVisibility, validateTacticalAttack, TACTICAL_REQUIRED_MESSAGE, type TacticalPhase } from '../src/services/tacticalPhase'
const empty: TacticalPhase = { choices: {}, revealed: false }
it('preserves the GigaRisk result when returning to Tactical Phase and reopening Card Reveal', () => {
  const choices = {a:{cards:[],skipped:true}}
  const resolution = resolveTacticalEffects([{id:'a',name:'A',gp:5,cards:[]}],choices)
  const phase: TacticalPhase = {choices,revealed:true,resolution}
  const hidden = setTacticalVisibility(phase,false)
  const reopened = setTacticalVisibility(hidden,true)
  expect(hidden.resolution).toBe(resolution)
  expect(reopened.resolution).toBe(resolution)
  expect(reopened.resolution?.teams[0].finalGP).toBe(3)
  expect(reopened.choices).toBe(choices)
  expect(() => chooseTacticalCard(hidden,'a','card',['card'])).toThrow('dikunci')
})
it('accepts an all-skip tactical phase and applies two GP damage to each team', () => {
  const teams = [{id:'a',name:'A',gp:5,cards:[]},{id:'b',name:'B',gp:6,cards:[]}]
  const phase: TacticalPhase = {revealed:false,choices:{a:{cards:[],skipped:true},b:{cards:[],skipped:true}}}
  expect(hasTacticalDecisions(empty)).toBe(false)
  expect(hasTacticalDecisions(phase)).toBe(true)
  expect(() => validateTacticalAttack(teams,phase)).not.toThrow()
  expect(resolveTacticalEffects(teams,phase.choices).teams.map((team)=>[team.finalGP,team.usedCards])).toEqual([[3,0],[4,0]])
})
it('resolves a mixed phase per team and ignores cards on a skipped choice', () => {
  const card = {id:'heal',name:'Rare Heal Card',type:'Rare',effect:'Heal',effect_action:'Menambah +3 GP.'}
  const teams = [{id:'a',name:'A',gp:5,cards:[card]},{id:'b',name:'B',gp:5,cards:[card]}]
  const phase: TacticalPhase = {revealed:false,choices:{a:{cards:['heal'],skipped:true},b:{cards:['heal'],skipped:false}}}
  expect(() => validateTacticalAttack(teams,phase)).not.toThrow()
  const results = resolveTacticalEffects(teams,phase.choices).teams
  expect(results.map((team)=>team.finalGP)).toEqual([3,6])
  expect(results[0].effects).toEqual([])
  expect(results[0].usedCards).toBe(0)
  expect(results[1].effects).toContain('+3 Heal')
})
it('executes both selected thief cards after the strike', () => {
  const cards = ['Normal','Rare'].map((type, index) => ({id:String(index),name:`${type} Thief Card`,type,effect:'Thief',effect_action:'Take GP'}))
  const result = resolveTacticalEffects([{id:'a',name:'A',gp:5,cards},{id:'b',name:'B',gp:8,cards:[]}], {a:{cards:['0','1'],skipped:false,targets:{'0':'b','1':'b'}}},()=>0).teams
  expect(result.map((team) => team.finalGP)).toEqual([6,3])
})
it('subtracts exactly two GP from every unprotected team and clamps at zero', () => {
  const results = resolveTacticalEffects([{id:'a',name:'A',gp:5,cards:[]},{id:'b',name:'B',gp:1,cards:[]}], {}).teams
  expect(results.map((row) => [row.gigaRisk,row.finalGP])).toEqual([[-2,3],[-2,0]])
})
it('converts the fixed strike to a two GP gain with Reflect', () => {
  const card = {id:'reflect',name:'Epic Reflect Card',type:'Epic',effect:'Defense',effect_action:'Convert damage to GP'}
  const result = resolveTacticalEffects([{id:'a',name:'A',gp:5,cards:[card]}], {a:{cards:['reflect'],skipped:false}}).teams[0]
  expect([result.gigaRisk,result.finalGP,result.usedCards]).toEqual([2,7,1])
})
it('applies the strike before a selected heal card', () => {
  const card = {id:'heal',name:'Rare Heal Card',type:'Rare',effect:'Heal',effect_action:'+3 GP'}
  const result = resolveTacticalEffects([{id:'a',name:'A',gp:5,cards:[card]}], {a:{cards:['heal'],skipped:false}}).teams[0]
  expect(result.finalGP).toBe(6)
  expect(result.effects).toContain('+3 Heal')
})
it('limits selection to two owned cards and lets a click remove a selection', () => {
  const first = chooseTacticalCard(empty, 'red', 'a', ['a', 'b', 'c'])
  const second = chooseTacticalCard(first, 'red', 'b', ['a', 'b', 'c'])
  expect(() => chooseTacticalCard(second, 'red', 'c', ['a', 'b', 'c'])).toThrow('at most 2')
  expect(chooseTacticalCard(second, 'red', 'a', ['a', 'b', 'c']).choices.red.cards).toEqual(['b'])
  expect(empty.choices).toEqual({})
})
it('rejects another team’s cards and freezes choices after reveal', () => {
  expect(() => chooseTacticalCard(empty, 'red', 'other', ['a'])).toThrow('earned by this team')
  expect(() => chooseTacticalCard({ ...empty, revealed: true }, 'red', 'a', ['a'])).toThrow('Return to Tactical Phase')
})
it('selecting a card replaces skip with a ready selection', () => {
  expect(chooseTacticalCard({ ...empty, choices: { red: { cards: [], skipped: true } } }, 'red', 'a', ['a']).choices.red).toEqual({ cards: ['a'], skipped: false })
})
it('blocks missing tactical selections and cards that are not owned in this challenge', () => {
  const teams = [{id:'a',name:'A',gp:5,cards:[]}]
  expect(() => validateTacticalAttack(teams, empty)).toThrow(TACTICAL_REQUIRED_MESSAGE)
  expect(() => validateTacticalAttack(teams, {choices:{a:{cards:['stale'],skipped:false}},revealed:false})).toThrow(TACTICAL_REQUIRED_MESSAGE)
  expect(teams[0].gp).toBe(5)
})
it('requires an explicit opponent and follows the selected target and action amount', () => {
  const card = {id:'steal',name:'Custom card',type:'Normal',effect:'Utility',effect_action:'Ambil 2 guard point dari tim lawan.'}
  const teams = [{id:'a',name:'A',gp:8,cards:[card]},{id:'b',name:'B',gp:8,cards:[]},{id:'c',name:'C',gp:8,cards:[]}]
  const missing: TacticalPhase = {revealed:false,choices:{a:{cards:['steal'],skipped:false}}}
  expect(() => validateTacticalAttack(teams,missing)).toThrow('Pilih tim lawan')
  const valid: TacticalPhase = {revealed:false,choices:{a:{cards:['steal'],skipped:false,targets:{steal:'c'}}}}
  expect(() => validateTacticalAttack(teams,valid)).not.toThrow()
  expect(resolveTacticalEffects(teams,valid.choices).teams.map((team)=>team.finalGP)).toEqual([8,6,4])
  expect(() => validateTacticalAttack(teams,{...valid,choices:{a:{...valid.choices.a,targets:{steal:'a'}}}})).toThrow('Pilih tim lawan')
})
