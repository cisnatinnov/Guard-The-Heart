import { Op, type Transaction } from 'sequelize'
import { Challenge, GPTransaction, Team } from '../models'
import { getSequelize, flushDatabase } from '../db/sequelize-provider'
import { teamGuardPower } from './rankRules'
import { readTacticalPhase, type TacticalResolution } from './tacticalPhase'
import { dbEvents, DB_EVENTS } from '../hooks/useDbEvents'
let queue: Promise<void> = Promise.resolve()
function serialize<T>(operation:()=>Promise<T>):Promise<T>{ const pending=queue.then(operation,operation);queue=pending.then(()=>undefined,()=>undefined);return pending }
async function opening(team:Team,transaction?:Transaction){
 if(await GPTransaction.findOne({where:{source_key:`opening:${team.id}`},transaction}))return
 await GPTransaction.create({team:team.id,team_name:team.name,challenge:null,challenge_name:'',source_key:`opening:${team.id}`,category:'opening',gp_before:0,delta:team.total_gp,gp_after:team.total_gp,description:team.total_gp===5?'Saldo awal tim':'Saldo awal dari data sebelumnya'},{transaction})
}
export async function openGPAccount(team:Team):Promise<void>{
 await serialize(()=>opening(team))
 dbEvents.emit(DB_EVENTS.GP_TRANSACTIONS_CHANGED)
}
export async function initializeGPTransactions():Promise<void>{
 await serialize(async()=>{for(const team of await Team.findAll())await opening(team)})
 // Import already completed attacks without running their card effects again.
 for(const challenge of await Challenge.findAll()){
  const phase=readTacticalPhase(challenge.id);const resolution=phase.resolution??phase.strike
  if(resolution)await recordGigaRiskGP(challenge.id,resolution,true)
 }
}
export async function syncRewardGP(earned:Map<string,number>,challengeId?:string):Promise<void>{
 await serialize(async()=>{
  const challenge=challengeId?await Challenge.findByPk(challengeId):null
  for(const team of await Team.findAll()){
   await opening(team)
   const combat=await GPTransaction.findAll({where:{team:team.id,category:{[Op.in]:['attack','card']}}})
   const next=Math.max(0,teamGuardPower(earned.get(team.id)??0)+combat.reduce((sum,row)=>sum+row.delta,0))
   if(next===team.total_gp)continue
   await getSequelize().transaction(async(transaction)=>{
    await GPTransaction.create({team:team.id,team_name:team.name,challenge:challenge?.id??null,challenge_name:challenge?.name??'',source_key:`reward:${crypto.randomUUID()}`,category:'reward',gp_before:team.total_gp,delta:next-team.total_gp,gp_after:next,description:challenge?`Perubahan hadiah GP: ${challenge.name}`:'Rekalkulasi hadiah GP challenge'},{transaction})
    await team.update({total_gp:next},{transaction})
   })
  }
 })
 dbEvents.emit(DB_EVENTS.GP_TRANSACTIONS_CHANGED)
}
export async function recordGigaRiskGP(challengeId:string,resolution:TacticalResolution,allowExisting=false):Promise<void>{
 await serialize(async()=>{
  const existing=await GPTransaction.findOne({where:{challenge:challengeId,category:'attack'}})
  if(existing){if(allowExisting)return;throw new Error('Challenge ini sudah diserang GigaRisk.')}
  const challenge=await Challenge.findByPk(challengeId)
  if(!challenge)throw new Error('Challenge tidak ditemukan')
  await getSequelize().transaction(async(transaction)=>{
   for(const result of resolution.teams){
    const team=await Team.findByPk(result.teamId,{transaction})
    if(!team)throw new Error('Tim tidak ditemukan')
    await opening(team,transaction)
    const before=team.total_gp
    const afterAttack=Math.max(0,before-2)
    const after=Math.max(0,before+result.finalGP-result.initialGP)
    const shared={team:team.id,team_name:team.name,challenge:challenge.id,challenge_name:challenge.name}
    await GPTransaction.create({...shared,source_key:`attack:${challengeId}:${team.id}`,category:'attack',gp_before:before,delta:afterAttack-before,gp_after:afterAttack,description:'Serangan GigaRisk −2 GP'},{transaction})
    if(after!==afterAttack||result.effects.length){await GPTransaction.create({...shared,source_key:`card:${challengeId}:${team.id}`,category:'card',gp_before:afterAttack,delta:after-afterAttack,gp_after:after,description:result.effects.join('; ')||'Efek kartu: perlindungan dari serangan GigaRisk'},{transaction})}
    await team.update({total_gp:after},{transaction})
   }
  })
 })
 if(typeof window!=='undefined')await flushDatabase()
 dbEvents.emit(DB_EVENTS.TEAMS_CHANGED)
 dbEvents.emit(DB_EVENTS.GP_TRANSACTIONS_CHANGED)
}
export async function listGPTransactions(team?:string){return GPTransaction.findAll({where:team?{team}:{},order:[['createdAt','DESC'],['id','DESC']],limit:500})}
