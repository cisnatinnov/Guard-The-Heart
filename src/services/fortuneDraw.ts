import { Op, type Transaction } from 'sequelize'
import { Card, Challenge, ChallengePoint, TeamCard, type CardType } from '../models'
import { cardDesignKey, cardTitleFor } from '../data/card-pool'
import { getTeamCards } from './cardDraw'
import { MAX_TOTAL_CARD } from './rankRules'
import { fortuneEffectKey, hasDistinctFortuneEffects, isFortuneCard, usedTacticalCardIds, type FortuneOption, type TacticalResolution } from './tacticalPhase'
import { challengeDrawPhase } from './cardDrawRules'

/** Shuffle physical copies, respecting challenge/rank rarity limits and distinct actions. */
export async function prepareFortuneOptions(teamId: string, retainId?: string, challengeId?: string): Promise<FortuneOption[]> {
  const challenge = challengeId ? await Challenge.findByPk(challengeId) : null
  const point = challengeId ? await ChallengePoint.findOne({where:{challenge:challengeId,team:teamId}}) : null
  const phase = challenge ? challengeDrawPhase(challenge.id, challenge.name) : 1
  const rank = point?.rank ?? (challengeId ? 5 : 1)
  const rarities: CardType[] = ['Normal','Normal',rank <= 3 ? 'Rare' : 'Normal']
  if (phase === 3 && rank === 1) rarities.push('Epic')
  const owned = new Set((await getTeamCards(teamId)).map(cardDesignKey))
  const candidates = (await Card.findAll({ where: { challenge: null, team: null } }))
    .filter((card) => rarities.includes(card.type) && !isFortuneCard(card) && !owned.has(cardDesignKey(card)))
  for (let index = candidates.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[candidates[index], candidates[target]] = [candidates[target], candidates[index]]
  }
  const retained = retainId ? await Card.findByPk(retainId) : null
  const keep = retained && rarities.includes(retained.type) && !isFortuneCard(retained)
    && (retained.team === teamId || !retained.team && !retained.challenge && !owned.has(cardDesignKey(retained))) ? [retained] : []
  const slots = [...rarities]
  if (keep.length) slots.splice(slots.indexOf(keep[0].type), 1)
  slots.sort((a,b) => Number(a === 'Normal') - Number(b === 'Normal'))
  const designs = candidates.filter((card,index) => candidates.findIndex((entry) => entry.type === card.type && fortuneEffectKey(entry) === fortuneEffectKey(card)) === index)
  // Search the small set of designs: a greedy Rare pick can otherwise block
  // a Normal slot even though a complete distinct-effect offer is available.
  const fill = (slot:number, chosen:Card[]):Card[] => {
    if (slot === slots.length) return chosen
    let best = chosen
    for (const card of designs) {
      if (card.type !== slots[slot] || chosen.some((entry) => fortuneEffectKey(entry) === fortuneEffectKey(card))) continue
      const result = fill(slot+1,[...chosen,card])
      if (result.length === rarities.length) return result
      if (result.length > best.length) best = result
    }
    const skipped = fill(slot+1,chosen)
    return skipped.length > best.length ? skipped : best
  }
  const options = fill(0,[...keep])
  if (!options.length) throw new Error('Fortune Draw: tidak ada efek berbeda yang tersedia dan belum dimiliki tim ini.')
  for (let index = options.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[options[index],options[target]] = [options[target],options[index]]
  }
  return options.map((card) => ({ id: card.id, name: card.name, type: card.type, effect: card.effect, effect_action: card.effect_action, icon: card.icon }))
}

function recordFortuneEffect(result: TacticalResolution['teams'][number], sourceId: string, name: string, type: CardType) {
  const effect = `Fortune Draw: +1 ${type} ${cardTitleFor(name, type).replace(/ Card$/, '')} (untuk challenge berikutnya)`
  if (!result.effects.includes(effect)) result.effects.push(effect)
  if (!(result.usedCardEffects ??= []).includes(effect)) result.usedCardEffects.push(effect)
  ;(result.cardEffects ??= {})[sourceId] = [effect]
}

/** Undo editable grants before awarding the new selection, in the same transaction. */
export async function reconcileFortuneDraws(challengeId: string, next: TacticalResolution, previous: TacticalResolution | undefined, transaction: Transaction): Promise<void> {
  const reserved = usedTacticalCardIds(challengeId)
  for (const team of previous?.teams ?? []) for (const draw of team.fortuneDraws ?? []) {
    if (!draw.rewardId) continue
    const replacement = next.teams.find((entry) => entry.teamId === team.teamId)?.fortuneDraws?.find((entry) => entry.cardId === draw.cardId)
    if (replacement?.selected === draw.selected) {
      replacement.rewardId = draw.rewardId
      continue
    }
    if (reserved.has(draw.rewardId)) throw new Error('Fortune Draw sudah dipakai pada challenge lain; pilihan tidak dapat diubah.')
    const physical = await Card.findByPk(draw.selected, { transaction })
    const reward = await TeamCard.findByPk(draw.rewardId, { transaction })
    if (!physical || physical.team !== team.teamId || physical.challenge !== challengeId || !reward || reward.team !== team.teamId) {
      throw new Error('Kartu Fortune Draw telah berubah. Muat ulang sebelum mengubah pilihan.')
    }
    await reward.destroy({ transaction })
    await physical.update({ team: null, challenge: null, challenge_point: null }, { transaction })
  }
  await settleFortuneDraws(challengeId, next, transaction, true)
}

/** Grant on confirmation; completed attacks retain the same reward without replaying it. */
export async function settleFortuneDraws(challengeId: string, resolution: TacticalResolution, transaction: Transaction, allowPending = false): Promise<void> {
  const used = usedTacticalCardIds(challengeId)
  for (const result of resolution.teams) {
    if (!result.fortuneDraws?.length) continue
    const owned = await TeamCard.findAll({ where: { team: result.teamId }, transaction })
    const available = owned.filter((card) => !used.has(card.id) && !result.usedCardIds?.includes(card.id))
    const point = await ChallengePoint.findOne({ where: { challenge: challengeId, team: result.teamId }, transaction })
    for (const draw of result.fortuneDraws ?? []) {
      if (allowPending && !draw.selected) continue
      const source = owned.find((card) => card.id === draw.cardId && isFortuneCard(card))
      if (!source || used.has(source.id) || !result.usedCardIds?.includes(source.id)) throw new Error('Fortune Draw sudah digunakan atau bukan milik tim ini.')
      if (!draw.options.length || draw.options.length > 4 || new Set(draw.options).size !== draw.options.length || !draw.options.includes(draw.selected)) throw new Error('Fortune Draw: pilih 1 kartu dari tawaran.')
      const offered = await Card.findAll({ where: { id: { [Op.in]: draw.options } }, transaction })
      if (offered.length !== draw.options.length || !hasDistinctFortuneEffects(offered as FortuneOption[])) throw new Error('Fortune Draw: perlu kartu dengan efek berbeda.')
      const selected = await Card.findByPk(draw.selected, { transaction })
      if (draw.rewardId) {
        const reward = owned.find((entry) => entry.id === draw.rewardId)
        if (!reward || reward.name !== selected?.name || selected?.team !== result.teamId || selected.challenge !== challengeId) {
          throw new Error('Kartu pilihan Fortune Draw tidak tersedia. Muat ulang sebelum melanjutkan.')
        }
        recordFortuneEffect(result, source.id, selected.name, selected.type)
        continue
      }
      const challenge = await Challenge.findByPk(challengeId, {transaction})
      const rank = point?.rank ?? 5
      const stage = challenge ? challengeDrawPhase(challenge.id,challenge.name) : 1
      if (!selected || selected.type === 'Legendary' || selected.type === 'Rare' && rank > 3 || selected.type === 'Epic' && (rank !== 1 || stage !== 3) || isFortuneCard(selected) || selected.challenge || selected.team) {
        throw new Error('Kartu pilihan Fortune Draw tidak tersedia. Pilih kartu Rare lain dari tawaran yang tersimpan.')
      }
      if (available.some((card) => cardDesignKey(card) === cardDesignKey(selected))) throw new Error('Tim sudah memiliki desain kartu pilihan Fortune Draw.')
      if (available.length >= MAX_TOTAL_CARD) throw new Error('Koleksi tim penuh; tidak dapat menerima Fortune Draw.')
      await selected.update({ challenge: challengeId, team: result.teamId, challenge_point: point?.id ?? null }, { transaction })
      const reward = await TeamCard.create({ name: selected.name, type: selected.type, effect: selected.effect,
        effect_action: selected.effect_action, icon: selected.icon, team: result.teamId, challenge_point: point?.id ?? null }, { transaction })
      available.push(reward)
      draw.rewardId = reward.id
      recordFortuneEffect(result, source.id, selected.name, selected.type)
    }
  }
}
