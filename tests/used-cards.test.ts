import { afterEach, expect, it, vi } from 'vitest'
import { usedTacticalCardIds } from '../src/services/tacticalPhase'
afterEach(()=>vi.unstubAllGlobals())
it('deducts only played cards from completed attacks and keeps reveal history',()=>{
 const resolved={choices:{a:{cards:['played'],skipped:false},b:{cards:['skipped'],skipped:true}},resolution:{resolvedAt:1,teams:[]},revealed:true}
 const records=new Map([['guard-the-heart-gigarisk-completed:c',JSON.stringify(resolved)],['guard-the-heart-tactical:c',JSON.stringify(resolved)],['guard-the-heart-tactical:pending',JSON.stringify({choices:{a:{cards:['waiting'],skipped:false}},revealed:true})]])
 vi.stubGlobal('localStorage',{length:records.size,key:(index:number)=>[...records.keys()][index],getItem:(key:string)=>records.get(key)??null})
 expect([...usedTacticalCardIds()]).toEqual(['played'])
 expect(records.get('guard-the-heart-gigarisk-completed:c')).toContain('played')
})

it('archives an automatically triggered passive and preserves an unused passive',()=>{
 const phase={choices:{a:{cards:[],skipped:true},b:{cards:['unused-passive'],skipped:false}},resolution:{resolvedAt:1,teams:[{teamId:'a',usedCardIds:['triggered-passive']},{teamId:'b',usedCardIds:[]}]},revealed:true}
 const records=new Map([['guard-the-heart-gigarisk-completed:c',JSON.stringify(phase)]])
 vi.stubGlobal('localStorage',{length:records.size,key:(index:number)=>[...records.keys()][index],getItem:(key:string)=>records.get(key)??null})
 expect([...usedTacticalCardIds()]).toEqual(['triggered-passive'])
})
