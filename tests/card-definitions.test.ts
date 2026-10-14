import { expect, it } from 'vitest'
import { CARD_POOL } from '../src/data/card-pool'
import { resolveTacticalEffects } from '../src/services/tacticalPhase'
function card(prefix: string) { const found=CARD_POOL.find((card)=>card.name.startsWith(prefix))!; return {...found,id:prefix} }
it('matches all eleven effect_action descriptions printed on the supplied card images',()=>{
 const actions:Record<string,string>={
  'Normal Heal Card':'Menambah +2 Guard Point (GP).',
  'Normal Shield Card':'Melindungi 1 Guard Point (GP) dari serangan Gigarisk.',
  'Normal Thief Card':'Ambil 1 Guard Point (GP) dari satu tim lawan.',
  'Rare Heal Card':'Menambah +3 Guard Point (GP).',
  'Rare Protect Card':'Target tim tidak kehilangan Guard Point (GP) dari satu kali serangan Gigarisk.',
  'Rare Reverse Card':'Ambil 1 Guard Point (GP) dari setiap tim lawan.',
  'Rare Thief Card':'Ambil 2 Guard Point (GP) dari satu tim lawan.',
  'Epic Reflect Card':'Damage Gigarisk yang diterima dikonversi menjadi Guard Point (GP).',
  'Epic Reverse Card':'Ambil 2 Guard Point (GP) dari setiap tim lawan.',
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
