import { expect, it } from 'vitest'
import { CARD_POOL } from '../src/data/card-pool'
import { cardTargetCount, teamUsedCardEffects, resolveTacticalEffects, validateTacticalAttack } from '../src/services/tacticalPhase'
function card(prefix: string) { const found=CARD_POOL.find((card)=>card.name.startsWith(prefix))!; return {...found,id:prefix} }
it('matches the twelve current card actions, including owner-and-target Protect',()=>{
 const actions:Record<string,string>={
  'Rare Fortune Draw Card':'Ambil 1 dari 3 kartu.',
  'Normal Heal Card':'Menambah +2 Guard Point (GP).',
  'Normal Shield Card':'Melindungi 1 Guard Point (GP) dari serangan Gigarisk.',
  'Normal Thief Card':'Ambil 1 Guard Point (GP) dari satu tim lawan.',
  'Rare Heal Card':'Menambah +3 Guard Point (GP).',
  'Rare Protect Card':'Pemilik kartu dan tim target tidak kehilangan Guard Point (GP) dari satu kali serangan Gigarisk.',
  'Epic Reverse Card':'Ambil 1 Guard Point (GP) dari setiap tim lawan.',
  'Rare Thief Card':'Ambil 2 Guard Point (GP) dari satu tim lawan.',
  'Epic Swallow Card':'Menelan efek serangan GigaRisk dan mengubahnya menjadi +4 Guard Point (GP).',
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
  ['Rare Protect Card', [5, 5, 3, 3], 0],
  ['Rare Thief Card', [5, 1, 3, 3], -2],
  ['Epic Reverse Card', [6, 2, 2, 2], -2],
  ['Epic Swallow Card', [9, 3, 3, 3], 4],
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
    expect(results.map((team) => team.finalGP)).toEqual(target === 'a' ? [5,3] : [5,5])
    expect(results.find((team) => team.teamId === target)?.effects).toContain('+2 Protect')
  }
  for (const targets of [[],['missing'],['a','b']]) {
    const choices = {a:{...choice,targets:{[protect.id]:targets}}}
    expect(() => validateTacticalAttack(teams,{choices,revealed:false})).toThrow('Pilih tim target')
    expect(() => resolveTacticalEffects(teams,choices)).toThrow('Pilih tim target')
  }
})
it('selected Second Chance activates at zero and is consumed only when triggered', () => {
  const passive = card('Legendary Second Chance Card')
  for (const gp of [0,1,2,5]) {
    const result = resolveTacticalEffects([{id:'a',name:'A',gp,cards:[passive]}],{a:{cards:[passive.id],skipped:false}}).teams[0]
    expect(result.finalGP).toBe(gp === 0 ? 0 : gp <= 2 ? 1 : 3)
    expect(result.usedCardIds).toEqual(gp <= 2 ? [passive.id] : [])
    expect(result.usedCards).toBe(gp <= 2 ? 1 : 0)
  }
})
it('activates Second Chance at zero damage before applying the deferred Heal', () => {
  const passive = card('Legendary Second Chance Card'), heal = card('Normal Heal Card')
  const result = resolveTacticalEffects([{id:'a',name:'A',gp:1,cards:[passive,heal]}],{a:{cards:[heal.id,passive.id],skipped:false}}).teams[0]
  expect(result.finalGP).toBe(3)
  expect(result.effects).toEqual(['+1 Second Chance','+2 Heal'])
  expect(result.usedCardIds).toEqual([heal.id,passive.id])
})
it('Second Chance revives a theft victim only once during an attack', () => {
  const passive = card('Legendary Second Chance Card'), thief = card('Rare Thief Card')
  const teams = [{id:'a',name:'A',gp:5,cards:[thief]},{id:'b',name:'B',gp:3,cards:[passive]},{id:'c',name:'C',gp:5,cards:[{...thief,id:'second'}]}]
  const result = resolveTacticalEffects(teams,{a:{cards:[thief.id],skipped:false,targets:{[thief.id]:'b'}},b:{cards:[passive.id],skipped:false},c:{cards:['second'],skipped:false,targets:{second:'b'}}}).teams
  expect(result.map((team) => team.finalGP)).toEqual([5,0,4])
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
it('grants Swallow +4 alongside Protect without losing GP', () => {
  const protect = card('Rare Protect Card'), swallow = card('Epic Swallow Card')
  const result = resolveTacticalEffects([{id:'a',name:'A',gp:5,cards:[protect]},{id:'b',name:'B',gp:5,cards:[swallow]}],{
    a:{cards:[protect.id],skipped:false,targets:{[protect.id]:'b'}},b:{cards:[swallow.id],skipped:false},
  }).teams
  expect(result.map((team) => team.finalGP)).toEqual([5,9])
  expect(result[1].gigaRisk).toBe(4)
})

it('attributes targeted protection and theft to their caster without changing GP activity', () => {
 const protect=card('Rare Protect Card'), thief=card('Rare Thief Card')
 const teams=[{id:'a',name:'A',gp:5,cards:[protect]},{id:'b',name:'B',gp:5,cards:[thief]},{id:'c',name:'C',gp:5,cards:[]}]
 const results=resolveTacticalEffects(teams,{a:{cards:[protect.id],skipped:false,targets:{[protect.id]:'c'}},b:{cards:[thief.id],skipped:false,targets:{[thief.id]:'c'}},c:{cards:[],skipped:true}}).teams
 expect(results.map((result)=>result.finalGP)).toEqual([5,5,3])
 expect(results[0].usedCardEffects).toEqual(['Protect untuk A: terlindungi dari serangan GigaRisk','Protect untuk C: terlindungi dari serangan GigaRisk'])
 expect(results[1].usedCardEffects).toEqual(['+2 Dicuri dari C'])
 expect(results[2].usedCardEffects).toEqual([])
 expect(results[2].effects).toEqual(['-2 Dicuri oleh B','+2 Protect'])
})
it('shows Unity only for the team that played it', () => {
 const unity=card('Legendary Gardian Unity')
 const results=resolveTacticalEffects([{id:'a',name:'A',gp:5,cards:[unity]},{id:'b',name:'B',gp:5,cards:[]}],{a:{cards:[unity.id],skipped:false},b:{cards:[],skipped:true}}).teams
 expect(results[0].usedCardEffects).toEqual(['Gardian Unity: semua tim terlindungi dari serangan GigaRisk','Gardian Unity: masing-masing tim +1 GP'])
 expect(results[1].usedCardEffects).toEqual([])
 expect(results[1].effects).toEqual(['+2 Gardian Unity protection','+1 Gardian Unity'])
 expect(results.map((result)=>result.finalGP)).toEqual([6,6])
})
it('shows revival as the passive owner action without incoming theft', () => {
 const passive=card('Legendary Second Chance Card'), thief=card('Rare Thief Card')
 const results=resolveTacticalEffects([{id:'a',name:'A',gp:5,cards:[thief]},{id:'b',name:'B',gp:3,cards:[passive]}],{a:{cards:[thief.id],skipped:false,targets:{[thief.id]:'b'}},b:{cards:[passive.id],skipped:false}}).teams
 expect(results[1].usedCardEffects).toEqual(['+1 Second Chance'])
 expect(results[1].effects).toContain('-2 Dicuri oleh A')
})
it('filters older archives by actual played cards without replaying their effects', () => {
 const swallow=card('Epic Swallow Card'), protect=card('Rare Protect Card')
 const result={teamId:'a',initialGP:5,finalGP:8,gigaRisk:4,usedCards:1,effects:['+4 Swallow','-1 Reverse oleh B','+1 Gardian Unity','+2 Protect']}
 expect(teamUsedCardEffects(result,[swallow])).toEqual(['+4 Swallow'])
 expect(teamUsedCardEffects(result,[])).toEqual([])
 expect(teamUsedCardEffects(result,[protect])).toEqual([protect.effect_action])
 expect(result.finalGP).toBe(8)
})
it('records a zero transfer as the action of the played thief card', () => {
 const thief=card('Normal Thief Card')
 const result=resolveTacticalEffects([{id:'a',name:'A',gp:5,cards:[thief]},{id:'b',name:'B',gp:0,cards:[]}],{a:{cards:[thief.id],skipped:false,targets:{[thief.id]:'b'}}}).teams
 expect(result[0].usedCardEffects).toEqual(['+0 Dicuri dari B'])
 expect(result.map((team)=>team.finalGP)).toEqual([3,0])
})
