import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { BlindReward, Card, Challenge, ChallengePoint, TeamCard } from '../src/models'
import { TeamController } from '../src/controllers/TeamController'
import { getSequelize } from '../src/db/sequelize-provider'
import { blindRewardId, chooseRankFiveReward, ensureRankFiveRewards, prepareRankFiveReward, type BlindOption } from '../src/services/blindRewards'
import { assignCardToTeam, getAvailableDrawnCards } from '../src/services/cardDraw'

beforeAll(async()=>{await initializeAppDatabase()})
afterEach(()=>vi.unstubAllGlobals())
beforeEach(async()=>{await BlindReward.destroy({where:{}});await TeamCard.destroy({where:{}});await Card.update({challenge:null,team:null,challenge_point:null},{where:{}})})
async function fixture() {
 const challenge=await Challenge.create({name:crypto.randomUUID()})
 const team=await TeamController.create(crypto.randomUUID())
 const entry=await ChallengePoint.create({challenge:challenge.id,team:team.id,rank:5,score:1,challenge_point:2,guard_power:1})
 await getSequelize().transaction(async(transaction)=>{await prepareRankFiveReward(entry,new Set(await Card.findAll({where:{team:null,challenge:null},transaction})),transaction)})
 const offer=(await BlindReward.findByPk(blindRewardId(challenge.id,team.id)))!
 return {challenge,team,entry,offer,options:JSON.parse(offer.options) as BlindOption[]}
}
it('reserves three distinct random cards and excludes them from automatic assignment',async()=>{
 const {challenge,team,options}=await fixture()
 expect(options).toHaveLength(3)
 expect(options.filter((card)=>card.zonk)).toHaveLength(0)
 expect(options.every((card)=>!!card.id)).toBe(true)
 expect(new Set(options.filter((card)=>!card.zonk).map((card)=>card.name.replace(/ #\d+$/,''))).size).toBe(3)
 expect(await getAvailableDrawnCards(challenge.id)).toHaveLength(0)
 await expect(assignCardToTeam(options.find((card)=>!card.zonk)!.id,team.id)).rejects.toThrow('three random cards')
})
it.each([0,1,2])('selects any option once and releases unchosen physical cards (index=%s)',async(index)=>{
 const {challenge,team,options,offer}=await fixture()
 const selected=options[index]
 await chooseRankFiveReward(challenge.id,team.id,selected.id)
 expect((await offer.reload()).selected).toBe(selected.id)
 expect(await TeamCard.count({where:{team:team.id}})).toBe(1)
 expect(await Card.count({where:{challenge:challenge.id}})).toBe(1)
 await expect(chooseRankFiveReward(challenge.id,team.id,options.find((card)=>card.id!==selected.id)!.id)).rejects.toThrow('sudah dipilih')
})
it('backfills an unfinished drawn round once, while preserving completed rounds',async()=>{
 const {challenge,team,offer}=await fixture()
 await Card.update({challenge:null,team:null,challenge_point:null},{where:{challenge:challenge.id}})
 await offer.destroy()
 await challenge.update({cards_drawn_at:new Date()})
 vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({revealed:true,choices:{},resolution:{resolvedAt:1,teams:[]}})})
 await ensureRankFiveRewards(challenge.id)
 expect(await BlindReward.count({where:{challenge:challenge.id}})).toBe(0)
 vi.unstubAllGlobals()
 await ensureRankFiveRewards(challenge.id)
 const saved=(await BlindReward.findByPk(blindRewardId(challenge.id,team.id)))!
 const options=saved.options
 await ensureRankFiveRewards(challenge.id)
 expect((await saved.reload()).options).toBe(options)
 expect(await BlindReward.count({where:{challenge:challenge.id}})).toBe(1)
})

it('allows a Rare card from the random offer',async()=>{
 const {challenge,team,offer,options}=await fixture()
 const selected=options.find((card)=>!card.zonk)!
 const physical=(await Card.findByPk(selected.id))!
 await physical.update({type:'Rare'})
 await chooseRankFiveReward(challenge.id,team.id,selected.id)
 expect((await offer.reload()).selected).toBe(selected.id)
 expect((await TeamCard.findOne({where:{team:team.id}}))?.type).toBe('Rare')
 await physical.update({type:'Normal'})
})
