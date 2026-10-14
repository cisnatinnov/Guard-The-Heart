import { beforeAll, expect, it } from 'vitest'
import { rankGuardPointStandings, rewardsForRank } from '../src/services/rankRules'
import { initializeAppDatabase } from '../src/db/database'
import { ChallengeController } from '../src/controllers/ChallengeController'
import { TeamController } from '../src/controllers/TeamController'
import { ChallengePointController } from '../src/controllers/ChallengePointController'
import { ScoreboardController } from '../src/controllers/ScoreboardController'

beforeAll(async()=>{await initializeAppDatabase()})
it('ranks GP first and breaks GP ties with earned CP, sharing rank only when both tie',()=>{
 const ranked=rankGuardPointStandings([
  {team:'A',guardPower:7,points:6}, {team:'Z',guardPower:7,points:8},
  {team:'B',guardPower:8,points:2}, {team:'C',guardPower:7,points:6},
 ])
 expect(ranked.map(row=>[row.team,row.rank])).toEqual([['B',1],['Z',2],['A',3],['C',3]])
})
it('keeps raw scores separate from exact rank rewards and aggregates reward CP',async()=>{
 const challenge=await ChallengeController.create('Score and CP separation')
 for(let index=0;index<5;index++){
  const team=await TeamController.create(`Rank reward ${index}`)
  await ChallengePointController.create({challenge:challenge.id,team:team.id,score:100-index*10})
 }
 const entries=await ChallengePointController.listByChallenge(challenge.id)
 for(const [index,entry] of entries.entries()){
  const reward=rewardsForRank(index+1)
  expect(entry.score).toBe(100-index*10)
  expect(entry.challenge_point).toBe(reward.challenge_point)
  expect(entry.guard_power).toBe(reward.guard_power)
  expect((await ScoreboardController.getByTeam(entry.team))?.total_cp).toBe(reward.challenge_point)
 }
 expect(entries[3].guard_power).toBe(1)
 expect(entries[4].guard_power).toBe(1)
})
