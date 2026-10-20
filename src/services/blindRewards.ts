import type { Transaction } from 'sequelize'
import { BlindReward, Card, Challenge, ChallengePoint, TeamCard, type CardEffect } from '../models'
import { cardDesignKey } from '../data/card-pool'
import { flushDatabase, getSequelize, refreshDatabaseFromStorage, withDatabaseWriteLock } from '../db/sequelize-provider'
import { readTacticalPhase, usedTacticalCardIds } from './tacticalPhase'
import { MAX_TOTAL_CARD } from './rankRules'
import { dbEvents, DB_EVENTS } from '../hooks/useDbEvents'

export const FALSE_HOPE_IMAGE = '/cards/Zonk_False_Hope Card.png'
export interface BlindOption { id:string; name:string; type:'Normal'; effect:CardEffect; effect_action:string; icon:string; zonk?:boolean }
export const blindRewardId = (challenge:string, team:string) => `rank5:${challenge}:${team}`

/** Add the new draw to an already-drawn, unfinished round without replaying rewards. */
export async function ensureRankFiveRewards(challengeId:string):Promise<void> {
  const phase = readTacticalPhase(challengeId)
  if (phase.resolution || phase.strike) return
  if (!(await Challenge.findByPk(challengeId))?.cards_drawn_at) return
  const entries = await ChallengePoint.findAll({where:{challenge:challengeId,rank:5}})
  if (!(await Promise.all(entries.map((entry)=>BlindReward.findByPk(blindRewardId(challengeId,entry.team))))).some((offer)=>!offer)) return
  await withDatabaseWriteLock(async()=>{
    if (typeof window !== 'undefined') await refreshDatabaseFromStorage()
    const latest = readTacticalPhase(challengeId)
    if (latest.resolution || latest.strike) return
    await getSequelize().transaction(async(transaction)=>{
      const remaining = new Set(await Card.findAll({where:{challenge:null,team:null},transaction}))
      for (const entry of entries) if (!await BlindReward.findByPk(blindRewardId(challengeId,entry.team),{transaction})) await prepareRankFiveReward(entry,remaining,transaction)
    })
    if (typeof window !== 'undefined') await flushDatabase()
  })
}

export async function prepareRankFiveReward(entry:ChallengePoint, remaining:Set<Card>, transaction:Transaction):Promise<void> {
  const used = usedTacticalCardIds()
  const owned = (await TeamCard.findAll({where:{team:entry.team},transaction})).filter((card) => !used.has(card.id))
  const designs = new Set(owned.map(cardDesignKey))
  const pool = [...remaining].filter((card) => card.type === 'Normal' && !designs.has(cardDesignKey(card)))
  for (let i=pool.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  const cards:Card[] = []
  for (const card of pool) {
    if (cards.some((chosen) => cardDesignKey(chosen) === cardDesignKey(card))) continue
    cards.push(card)
    if (cards.length === 2) break
  }
  if (cards.length !== 2) throw new Error('Rank 5: perlu dua desain Normal berbeda yang belum dimiliki tim.')
  for (const card of cards) {
    remaining.delete(card)
    await card.update({challenge:entry.challenge,challenge_point:entry.id},{transaction})
  }
  const options:BlindOption[] = cards.map((card) => ({id:card.id,name:card.name,type:'Normal',effect:card.effect,effect_action:card.effect_action,icon:card.icon}))
  options.push({id:'zonk',name:'False Hope',type:'Normal',effect:'Utility',effect_action:'Zonk — tidak mendapatkan kartu.',icon:'',zonk:true})
  for (let i=options.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1));[options[i],options[j]]=[options[j],options[i]]}
  await BlindReward.create({id:blindRewardId(entry.challenge,entry.team),challenge:entry.challenge,team:entry.team,options:JSON.stringify(options),selected:null,reward_id:null},{transaction})
}

export async function chooseRankFiveReward(challengeId:string,teamId:string,optionId:string):Promise<void> {
  await withDatabaseWriteLock(async () => {
    if (typeof window !== 'undefined') await refreshDatabaseFromStorage()
    await getSequelize().transaction(async (transaction) => {
      const offer = await BlindReward.findByPk(blindRewardId(challengeId,teamId),{transaction})
      const point = await ChallengePoint.findOne({where:{challenge:challengeId,team:teamId},transaction})
      if (!offer || point?.rank !== 5) throw new Error('Tawaran rank 5 tidak tersedia.')
      if (offer.selected) throw new Error('Kartu sudah dipilih. Pilihan tidak dapat diulang.')
      const options = JSON.parse(offer.options) as BlindOption[]
      const selected = options.find((option) => option.id === optionId)
      if (!selected) throw new Error('Pilih salah satu kartu tertutup.')
      let rewardId:string|null = null
      if (!selected.zonk) {
        const physical = await Card.findByPk(selected.id,{transaction})
        const used = usedTacticalCardIds()
        const owned = (await TeamCard.findAll({where:{team:teamId},transaction})).filter((card) => !used.has(card.id))
        if (!physical || physical.team || physical.challenge_point !== point.id) throw new Error('Kartu tidak tersedia.')
        if (physical.type !== 'Normal') throw new Error('Rank 5 hanya dapat menerima 1 kartu Normal atau False Hope.')
        if (await TeamCard.count({where:{team:teamId,challenge_point:point.id},transaction})) throw new Error('Rank 5 sudah menerima hasil untuk challenge ini.')
        if (owned.length >= MAX_TOTAL_CARD || owned.some((card) => cardDesignKey(card) === cardDesignKey(physical))) throw new Error('Koleksi penuh atau desain kartu sudah dimiliki.')
        await physical.update({team:teamId},{transaction})
        const reward = await TeamCard.create({name:physical.name,type:physical.type,effect:physical.effect,effect_action:physical.effect_action,icon:physical.icon,team:teamId,challenge_point:point.id},{transaction})
        rewardId = reward.id
      }
      for (const option of options) if (!option.zonk && option.id !== selected.id) {
        await Card.update({challenge:null,challenge_point:null,team:null},{where:{id:option.id,challenge_point:point.id,team:null},transaction})
      }
      await offer.update({selected:selected.id,reward_id:rewardId},{transaction})
    })
    if (typeof window !== 'undefined') await flushDatabase()
  })
  dbEvents.emit(DB_EVENTS.CARDS_CHANGED)
}

export async function pendingBlindCardIds():Promise<Set<string>> {
  const ids = new Set<string>()
  for (const offer of await BlindReward.findAll({where:{selected:null}})) {
    for (const option of JSON.parse(offer.options) as BlindOption[]) if (!option.zonk) ids.add(option.id)
  }
  return ids
}
