import { afterEach, expect, it, vi } from 'vitest'
import { attackTacticalPhaseOnce, publishTacticalPhase, readTacticalPhase, type TacticalPhase } from '../src/services/tacticalPhase'
afterEach(() => vi.unstubAllGlobals())
it('attacks once per challenge and keeps the completed result after tactical data is overwritten', async () => {
  const storage = new Map<string,string>()
  vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)})
  vi.stubGlobal('window',{dispatchEvent:vi.fn()})
  const phase: TacticalPhase={revealed:false,choices:{a:{cards:[],skipped:true}}}
  const teams=[{id:'a',name:'A',gp:5,cards:[]}]
  publishTacticalPhase('challenge-a',phase)
  const result=await attackTacticalPhaseOnce('challenge-a',teams)
  await expect(attackTacticalPhaseOnce('challenge-a',teams)).rejects.toThrow('sudah diserang')
  publishTacticalPhase('challenge-a',{revealed:false,choices:{}})
  expect(readTacticalPhase('challenge-a').resolution).toEqual(result)
  storage.delete('guard-the-heart-tactical:challenge-a')
  expect(readTacticalPhase('challenge-a').resolution?.teams[0].finalGP).toBe(3)
  await expect(attackTacticalPhaseOnce('challenge-a',teams)).rejects.toThrow('sudah diserang')
  publishTacticalPhase('challenge-b',phase)
  expect((await attackTacticalPhaseOnce('challenge-b',teams)).teams[0].finalGP).toBe(3)
})
