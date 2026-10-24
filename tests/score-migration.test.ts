import { expect, it } from 'vitest'
import { initDatabase } from '../src/db/sequelize-provider'
import { initializeAppDatabase } from '../src/db/database'
import { Challenge, ChallengePoint, GPTransaction, Team, ChallengeAnswer, defineModels } from '../src/models'

it('migrates an existing raw challenge_point into score without replacing teams or ledger history',async()=>{
 const sequelize=await initDatabase()
 defineModels(sequelize)
 await sequelize.sync()
 await sequelize.getQueryInterface().removeColumn('challenge_point','score')
 for (const column of ['press_count','matching_deadline','matching_pairs']) await sequelize.getQueryInterface().removeColumn('challenge_answer', column)
 const team=await Team.create({name:'Preserved migration team',total_gp:6})
 const challenge=await Challenge.create({name:'Preserved migration challenge'})
 const id=crypto.randomUUID()
 const timestamp=new Date().toISOString()
 await GPTransaction.create({team:team.id,team_name:team.name,challenge:challenge.id,challenge_name:challenge.name,source_key:`attack:${challenge.id}:${team.id}`,category:'attack',gp_before:8,delta:-2,gp_after:6,description:'Existing attack history'})
 await sequelize.getQueryInterface().bulkInsert('challenge_point',[{id,team:team.id,challenge:challenge.id,rank:1,challenge_point:77,guard_power:3,createdAt:timestamp,updatedAt:timestamp}])
 await sequelize.getQueryInterface().bulkInsert('challenge_answer',[{id:'legacy-answer', challenge:challenge.id,team:team.id,correct:false,pressing_team:team.id,settled:false,bitten:null,createdAt:timestamp,updatedAt:timestamp}])
 await initializeAppDatabase()
 expect(await ChallengeAnswer.findByPk('legacy-answer')).toMatchObject({press_count:0, matching_deadline:null, matching_pairs:'[]', settled:false})
 const entry=await ChallengePoint.findByPk(id)
 expect(entry).toMatchObject({team:team.id,challenge:challenge.id,score:77,challenge_point:3,guard_power:3})
 expect((await Team.findByPk(team.id))?.total_gp).toBe(6)
 expect(await GPTransaction.count({where:{team:team.id,category:'attack'}})).toBe(1)
 expect(await GPTransaction.count({where:{team:team.id,category:'opening'}})).toBe(1)
})
