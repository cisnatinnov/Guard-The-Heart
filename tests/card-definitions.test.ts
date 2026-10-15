import { expect, it } from 'vitest'
import { CARD_POOL } from '../src/data/card-pool'
import { cardTargetCount, resolveTacticalEffects, validateTacticalAttack } from '../src/services/tacticalPhase'
function card(prefix: string) { const found=CARD_POOL.find((card)=>card.name.startsWith(prefix))!; return {...found,id:prefix} }
it('matches all eleven effect_action descriptions printed on the supplied card images',()=>{
 const actions:Record<string,string>={
  'Normal Heal Card':'Menambah +2 Guard Point (GP).',
  'Normal Shield Card':'Melindungi 1 Guard Point (GP) dari serangan Gigarisk.',
  'Normal Thief Card':'Ambil 1 Guard Point (GP) dari satu tim lawan.',
  'Rare Heal Card':'Menambah +3 Guard Point (GP).',
  'Rare Protect Card':'Target tim tidak kehilangan Guard Point (GP) dari satu kali serangan Gigarisk.',
  'Epic Reverse Card':'Ambil 1 Guard Point (GP) dari setiap tim lawan.',
  'Rare Thief Card':'Ambil 2 Guard Point (GP) dari satu tim lawan.',
  'Epic Reflect Card':'Damage Gigarisk yang diterima dikonversi double menjadi Guard Point (GP).',
  'Epic Thief Card':'Ambil 2 Guard Point (GP) dari dua tim lawan.',
  'Legendary Gardian Unity':'Semua team terlindungi dari serangan Gigarisk dan masing-masing +1 Guard Point (GP).',
  'Legendary Second Chance Card':'(Passive Skill) Otomatis bangkit dengan penambahan +1 Guard Point (GP) saat Guard Point (GP) mencapai 0.',
 }
 for(const [prefix,action] of Object.entries(actions))expect(card(prefix).effect_action).toBe(action)
})
it('uses the fixed Normal Heal +2 definition for every random seed', () => {
  const heal=card('Normal Heal Card')
  expect(heal.effect_action).toBe('Menambah +2 Guard Point (GP).')
  for(const value of [0,.99]) expect(resolveTacticalEffects([{id:'a',name:'A',gp:5,cards:[heal]}],{a:{cards:[heal.id],skipped:false}},()=>value).teams[0].finalGP).toBe(5)
})
it('uses the fixed one GP Normal Shield protection for every random seed', () => {
  const shield=card('Normal Shield Card')
  expect(shield.effect_action).toBe('Melindungi 1 Guard Point (GP) dari serangan Gigarisk.')
  for(const value of [0,.99]) { const result=resolveTacticalEffects([{id:'a',name:'A',gp:5,cards:[shield]}],{a:{cards:[shield.id],skipped:false}},()=>value).teams[0];expect([result.gigaRisk,result.finalGP]).toEqual([-1,4]) }
})

const actionCases = [
  ['Normal Heal Card', [5, 3, 3, 3], -2],
  ['Normal Shield Card', [4, 3, 3, 3], -1],
  ['Normal Thief Card', [4, 2, 3, 3], -2],
  ['Rare Heal Card', [6, 3, 3, 3], -2],
  ['Rare Protect Card', [3, 5, 3, 3], -2],
  ['Rare Thief Card', [5, 1, 3, 3], -2],
  ['Epic Reverse Card', [6, 2, 2, 2], -2],
  ['Epic Reflect Card', [9, 3, 3, 3], 4],
  ['Epic Thief Card', [7, 1, 1, 3], -2],
  ['Legendary Gardian Unity', [6, 6, 6, 6], 0],
] as const
it.each(actionCases)('executes %s as printed on its image', (prefix, balances, strike) => {
  const selected = card(prefix)
  const teams = ['a','b','c','d'].map((id) => ({id,name:id,gp:5,cards:id === 'a' ? [selected] : []}))
  const count = cardTargetCount(selected)
  const phase = {revealed:false,choices:{a:{cards:[selected.id],skipped:false,targets:{[selected.id]:['b','c'].slice(0,count)}}}}
  expect(() => validateTacticalAttack(teams,phase)).not.toThrow()
  const result = resolveTacticalEffects(teams,phase.choices).teams
  expect(result.map((team) => team.finalGP)).toEqual(balances)
  expect(result[0].gigaRisk).toBe(strike)
  expect(result[0].usedCardIds).toEqual([selected.id])
})
it('Protect can target its owner or another team and requires a valid target', () => {
  const protect = card('Rare Protect Card')
  const teams = ['a','b'].map((id) => ({id,name:id,gp:5,cards:id === 'a' ? [protect] : []}))
  const choice = {cards:[protect.id],skipped:false}
  for (const target of ['a','b']) {
    const choices = {a:{...choice,targets:{[protect.id]:target}}}
    expect(() => validateTacticalAttack(teams,{choices,revealed:false})).not.toThrow()
    const results = resolveTacticalEffects(teams,choices).teams
    expect(results.map((team) => team.finalGP)).toEqual(target === 'a' ? [5,3] : [3,5])
    expect(results.find((team) => team.teamId === target)?.effects).toContain('+2 Protect')
  }
  for (const targets of [[],['missing'],['a','b']]) {
    const choices = {a:{...choice,targets:{[protect.id]:targets}}}
    expect(() => validateTacticalAttack(teams,{choices,revealed:false})).toThrow('Pilih tim target')
    expect(() => resolveTacticalEffects(teams,choices)).toThrow('Pilih tim target')
  }
})
it('Second Chance is passive even when skipping, and is consumed only when triggered', () => {
  const passive = card('Legendary Second Chance Card')
  for (const gp of [0,1,2,5]) {
    const result = resolveTacticalEffects([{id:'a',name:'A',gp,cards:[passive]}],{a:{cards:[],skipped:true}}).teams[0]
    expect(result.finalGP).toBe(gp <= 2 ? 1 : 3)
    expect(result.usedCardIds).toEqual(gp <= 2 ? [passive.id] : [])
    expect(result.usedCards).toBe(gp <= 2 ? 1 : 0)
  }
})
it('Second Chance triggers immediately when the strike reaches zero before healing', () => {
  const passive = card('Legendary Second Chance Card'), heal = card('Normal Heal Card')
  const result = resolveTacticalEffects([{id:'a',name:'A',gp:1,cards:[passive,heal]}],{a:{cards:[heal.id],skipped:false}}).teams[0]
  expect(result.finalGP).toBe(3)
  expect(result.effects).toEqual(['+1 Second Chance','+2 Heal'])
  expect(result.usedCardIds).toEqual([heal.id,passive.id])
})
it('Second Chance revives a theft victim only once during an attack', () => {
  const passive = card('Legendary Second Chance Card'), thief = card('Rare Thief Card')
  const teams = [{id:'a',name:'A',gp:5,cards:[thief]},{id:'b',name:'B',gp:3,cards:[passive]},{id:'c',name:'C',gp:5,cards:[{...thief,id:'second'}]}]
  const result = resolveTacticalEffects(teams,{a:{cards:[thief.id],skipped:false,targets:{[thief.id]:'b'}},c:{cards:['second'],skipped:false,targets:{second:'b'}}}).teams
  expect(result.map((team) => team.finalGP)).toEqual([4,0,4])
  expect(result[1].effects.filter((effect) => effect.includes('Second Chance'))).toHaveLength(1)
  expect(result[1].usedCardIds).toEqual([passive.id])
})
it('defenses block GigaRisk but do not block theft', () => {
  const protect = card('Rare Protect Card'), thief = card('Rare Thief Card')
  const result = resolveTacticalEffects([{id:'a',name:'A',gp:5,cards:[protect]},{id:'b',name:'B',gp:5,cards:[thief]}],{
    a:{cards:[protect.id],skipped:false,targets:{[protect.id]:'a'}},b:{cards:[thief.id],skipped:false,targets:{[thief.id]:'a'}},
  }).teams
  expect(result.map((team) => team.finalGP)).toEqual([3,5])
})
it('does not reflect damage blocked by a targeted Protect', () => {
  const protect = card('Rare Protect Card'), reflect = card('Epic Reflect Card')
  const result = resolveTacticalEffects([{id:'a',name:'A',gp:5,cards:[protect]},{id:'b',name:'B',gp:5,cards:[reflect]}],{
    a:{cards:[protect.id],skipped:false,targets:{[protect.id]:'b'}},b:{cards:[reflect.id],skipped:false},
  }).teams
  expect(result.map((team) => team.finalGP)).toEqual([3,5])
  expect(result[1].gigaRisk).toBe(0)
})
