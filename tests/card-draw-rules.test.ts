import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { Card, Challenge, ChallengePoint, TeamCard } from '../src/models'
import { TeamController } from '../src/controllers/TeamController'
import { ChallengePointController } from '../src/controllers/ChallengePointController'
import { CardController } from '../src/controllers/CardController'
import { drawBonusCardsForChallenge, isChallengeCardsDrawn, assignCardToTeam, replaceTeamCard } from '../src/services/cardDraw'
import { challengeDrawPhase, rewardRarity } from '../src/services/cardDrawRules'
import { CHALLENGE_GAMES } from '../src/services/games'

beforeAll(async () => { await initializeAppDatabase() })
afterEach(() => vi.restoreAllMocks())

const expected = [
 [[57,40,0,3],[59,40,0,1],[90,10,0,0],[100,0,0,0]],
 [[52,45,0,3],[54,45,0,1],[85,15,0,0],[100,0,0,0]],
 [[51,38,8,3],[49,50,0,1],[80,20,0,0],[100,0,0,0]],
]
it.each([1,2,3])('uses the attachment percentages for every rank in challenge %i', (phase) => {
 for (let rank=1;rank<=4;rank++) {
  const counts = {Normal:0,Rare:0,Epic:0,Legendary:0}
  for (let roll=0;roll<100;roll++) counts[rewardRarity(phase,rank,()=>(roll+.5)/100)!]++
  expect([counts.Normal,counts.Rare,counts.Epic,counts.Legendary]).toEqual(expected[phase-1][rank-1])
 }
 expect(rewardRarity(phase,5)).toBeNull()
})
it('uses built-in ids or numbered custom names and a phase-one default', () => {
 CHALLENGE_GAMES.forEach((game,index) => expect(challengeDrawPhase(game.challengeId,'Renamed')).toBe(index+1))
 expect(challengeDrawPhase('custom','Challenge 2 - Bonus')).toBe(2)
 expect(challengeDrawPhase('custom','Fase 3')).toBe(3)
 expect(challengeDrawPhase('custom','Arena')).toBe(1)
})

async function fixture(name: string) {
 const challenge = await Challenge.create({name})
 const teams = await Promise.all(['A','B','C','D','E'].map((suffix)=>TeamController.create(`${name} ${suffix}`)))
 for (const [index,team] of teams.entries()) await ChallengePointController.create({challenge:challenge.id,team:team.id,score:100-index*10})
 return {challenge,teams}
}
it('keeps rolled rarities with their ranked recipient through automatic assignment', async () => {
 const {challenge,teams} = await fixture('Challenge 2 - Weighted rewards')
 vi.spyOn(Math,'random').mockReturnValue(.65)
 const drawn = await CardController.drawBonusCards(challenge.id)
 expect(drawn).toHaveLength(8)
 const expectedTypes = [['Rare','Rare','Rare'],['Rare','Rare'],['Normal','Normal'],['Normal'],[]]
 for (const [index,team] of teams.entries()) {
  const owned = await TeamCard.findAll({where:{team:team.id}})
  expect(owned.map((card)=>card.type)).toEqual(expectedTypes[index])
  expect(owned.every((card)=>!!card.challenge_point)).toBe(true)
 }
 const ids = (await Card.findAll({where:{challenge:challenge.id}})).map((card)=>card.id).sort()
 await expect(CardController.drawBonusCards(challenge.id)).rejects.toThrow(/already been drawn/)
 expect((await Card.findAll({where:{challenge:challenge.id}})).map((card)=>card.id).sort()).toEqual(ids)
})
it('rejects assigning a reserved reward to a different ranked team', async () => {
 const {challenge,teams} = await fixture('Reserved draw')
 vi.spyOn(Math,'random').mockReturnValue(0)
 const drawn = await drawBonusCardsForChallenge(challenge.id)
 await expect(assignCardToTeam(drawn[0].id,teams[1].id)).rejects.toThrow('another team')
 expect((await Card.findByPk(drawn[0].id))?.team).toBeNull()
 await assignCardToTeam(drawn[0].id,teams[0].id)
 expect(await TeamCard.count({where:{team:teams[0].id}})).toBe(1)
 const old = (await TeamCard.findOne({where:{team:teams[0].id}}))!
 await expect(replaceTeamCard(teams[0].id,old.id,drawn[3].id)).rejects.toThrow('another team')
 expect(await TeamCard.findByPk(old.id)).not.toBeNull()
})
it('can draw and assign a Legendary card to rank one', async () => {
 const {challenge,teams} = await fixture('Legendary weighted rewards')
 let calls=0
 vi.spyOn(Math,'random').mockImplementation(()=>calls++===0?.99:0)
 await CardController.drawBonusCards(challenge.id)
 expect(await TeamCard.count({where:{team:teams[0].id,type:'Legendary'}})).toBe(1)
 for (const team of teams.slice(1)) expect(await TeamCard.count({where:{team:team.id,type:'Legendary'}})).toBe(0)
})
it('rolls back the entire draw when the rolled rarity is exhausted', async () => {
 const {challenge} = await fixture('Exhausted draw')
 const reserve = await Challenge.create({name:'Reserved Rare inventory'})
 const rare = await Card.findAll({where:{type:'Rare',challenge:null}})
 for (const card of rare) await card.update({challenge:reserve.id})
 const before = await Card.count({where:{challenge:null}})
 let calls=0
 vi.spyOn(Math,'random').mockImplementation(()=> ++calls <= 2 ? 0 : .59)
 await expect(drawBonusCardsForChallenge(challenge.id)).rejects.toThrow('No Rare cards remain')
 expect(await Card.count({where:{challenge:challenge.id}})).toBe(0)
 expect(await Card.count({where:{challenge:null}})).toBe(before)
 expect(await isChallengeCardsDrawn(challenge.id)).toBe(false)
 expect(await ChallengePoint.count({where:{challenge:challenge.id}})).toBe(5)
})

it('limits rank 4 to one Normal reward and rejects higher-rarity assignment or replacement',async()=>{
 const challenge=await Challenge.create({name:`Rank four limit ${crypto.randomUUID()}`})
 const team=await TeamController.create(`Rank four ${crypto.randomUUID()}`)
 const point=await ChallengePoint.create({challenge:challenge.id,team:team.id,rank:4,score:0,challenge_point:4,guard_power:1})
 const make=async(name:string,type:'Normal'|'Rare')=>Card.create({name,type,effect:'Utility',effect_action:'Test reward',icon:'',challenge:challenge.id,challenge_point:point.id,team:null})
 const first=await make('Normal Heal Card #98','Normal'),second=await make('Normal Shield Card #98','Normal'),rare=await make('Rare Thief Card #98','Rare')
 await expect(assignCardToTeam(rare.id,team.id)).rejects.toThrow('hanya dapat menerima kartu Normal')
 const reward=await assignCardToTeam(first.id,team.id)
 await expect(assignCardToTeam(second.id,team.id)).rejects.toThrow('1 kartu Normal per challenge')
 await expect(replaceTeamCard(team.id,reward.id,rare.id)).rejects.toThrow('hanya dapat menerima kartu Normal')
 expect(await TeamCard.count({where:{team:team.id}})).toBe(1)
 const older=await TeamCard.create({name:'Normal Thief Card #99',type:'Normal',effect:'Thief',effect_action:'Earlier reward',icon:'',team:team.id,challenge_point:null})
 await expect(replaceTeamCard(team.id,older.id,second.id)).rejects.toThrow('1 kartu Normal per challenge')
 expect(await TeamCard.count({where:{team:team.id,challenge_point:point.id}})).toBe(1)
})
