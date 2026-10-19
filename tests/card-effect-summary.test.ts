import { expect, it } from 'vitest'
import { resolvedCardEffects, resolvedOwnCardEffects } from '../src/services/cardEffectSummary'
import { resolveTacticalEffects, type TacticalTeamResult } from '../src/services/tacticalPhase'

const swallow={id:'swallow',name:'Epic Swallow Card #01',type:'Epic',effect:'Defense',effect_action:'Menelan efek serangan GigaRisk dan mengubahnya menjadi +4 Guard Point (GP).'}
const result:TacticalTeamResult={teamId:'a',initialGP:5,finalGP:7,gigaRisk:4,effects:['+4 Swallow','-2 Dicuri oleh B'],usedCardEffects:['+4 Swallow'],usedCards:1,usedCardIds:['swallow']}
it('hides effects until the attack resolves',()=>expect(resolvedOwnCardEffects(undefined,[swallow])).toEqual([]))
it('uses compact own-card outcomes and leaves the complete activity log intact',()=>{
 expect(resolvedOwnCardEffects(result,[swallow])).toEqual(['+4 Swallow'])
 expect(result.effects).toContain('-2 Dicuri oleh B')
})
it('filters incoming effects from older archives without re-running combat',()=>{
 expect(resolvedOwnCardEffects({...result,usedCardEffects:undefined},[swallow])).toEqual(['+4 Swallow'])
 expect(resolvedOwnCardEffects({...result,usedCardEffects:undefined,usedCardIds:[]},[swallow])).toEqual([])
})
it('does not substitute printed descriptions or invent GP amounts for older archive gaps',()=>{
 const protect={...swallow,id:'protect',name:'Rare Protect Card #01',effect_action:'Target tim terlindungi dari serangan GigaRisk.'}
 expect(resolvedOwnCardEffects({...result,usedCardEffects:undefined,usedCardIds:['protect']},[protect])).toEqual(['Protect'])
})

it('keeps a thief and protect separate for the same team, including old archives',()=>{
 const thief={...swallow,id:'thief',name:'Normal Thief Card #01',type:'Normal',effect:'Thief',effect_action:'Ambil 1 Guard Point (GP) dari satu tim lawan.'}
 const protect={...swallow,id:'protect',name:'Rare Protect Card #01',type:'Rare',effect_action:'Target tim terlindungi dari serangan GigaRisk.'}
 const cards=[thief,protect]
 const resolved=resolveTacticalEffects([{id:'a',name:'A',gp:5,cards},{id:'b',name:'B',gp:5,cards:[]}],{a:{cards:['thief','protect'],skipped:false,targets:{thief:'b',protect:'a'}}}).teams[0]
 expect(resolvedCardEffects(resolved,cards,'thief')).toEqual(['+1 Dicuri dari B'])
 expect(resolvedCardEffects(resolved,cards,'protect')).toEqual(['Protect untuk A: terlindungi dari serangan GigaRisk'])
 const legacy={...resolved,cardEffects:undefined}
 expect(resolvedCardEffects(legacy,cards,'thief')).toEqual(['+1 Dicuri dari B'])
 expect(resolvedCardEffects(legacy,cards,'protect')).toEqual(['Protect untuk A: terlindungi dari serangan GigaRisk'])
})
it('attributes two thief cards to their exact targets and amounts',()=>{
 const normal={...swallow,id:'normal',name:'Normal Thief Card #01',type:'Normal',effect:'Thief',effect_action:'Ambil 1 Guard Point (GP) dari satu tim lawan.'}
 const rare={...normal,id:'rare',name:'Rare Thief Card #01',type:'Rare',effect_action:'Ambil 2 Guard Point (GP) dari satu tim lawan.'}
 const cards=[normal,rare]
 const resolved=resolveTacticalEffects([{id:'a',name:'A',gp:5,cards},{id:'b',name:'B',gp:8,cards:[]},{id:'c',name:'C',gp:8,cards:[]}],{a:{cards:['normal','rare'],skipped:false,targets:{normal:'b',rare:'c'}}}).teams[0]
 for(const record of [resolved,{...resolved,cardEffects:undefined}]){
  expect(resolvedCardEffects(record,cards,'normal')).toEqual(['+1 Dicuri dari B'])
  expect(resolvedCardEffects(record,cards,'rare')).toEqual(['+2 Dicuri dari C'])
 }
 expect(resolvedCardEffects(resolved,cards,'missing')).toEqual([])
 expect(resolvedCardEffects(undefined,cards,'normal')).toEqual([])
})
it('groups all targets of one Reverse card without including a companion Heal',()=>{
 const reverse={...swallow,id:'reverse',name:'Epic Reverse Card #01',effect:'Utility',effect_action:'Ambil 1 Guard Point (GP) dari setiap tim lawan.'}
 const heal={...swallow,id:'heal',name:'Normal Heal Card #01',type:'Normal',effect:'Heal',effect_action:'Menambah +2 Guard Point (GP).'}
 const cards=[reverse,heal]
 const resolved=resolveTacticalEffects([{id:'a',name:'A',gp:5,cards},{id:'b',name:'B',gp:5,cards:[]},{id:'c',name:'C',gp:5,cards:[]}],{a:{cards:['reverse','heal'],skipped:false}}).teams[0]
 expect(resolvedCardEffects(resolved,cards,'reverse')).toEqual(['+1 Reverse dari B','+1 Reverse dari C'])
 expect(resolvedCardEffects(resolved,cards,'heal')).toEqual(['+2 Heal'])
})
