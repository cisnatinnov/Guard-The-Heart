import type { Transaction } from 'sequelize'
import { Card, ChallengePoint, TeamCard, type CardType } from '../models'
import { cardDesignKey, cardTitleFor } from '../data/card-pool'
import { getTeamCards } from './cardDraw'
import { MAX_TOTAL_CARD } from './rankRules'
import { isFortuneCard, usedTacticalCardIds, type FortuneOption, type TacticalResolution } from './tacticalPhase'

/** Shuffle physical Rare copies, preferring different designs, without consuming the offers. */
export async function prepareFortuneOptions(teamId: string): Promise<FortuneOption[]> {
  const owned = new Set((await getTeamCards(teamId)).map(cardDesignKey))
  const candidates = (await Card.findAll({ where: { type: 'Rare', challenge: null, team: null } }))
    .filter((card) => !isFortuneCard(card) && !owned.has(cardDesignKey(card)))
  for (let index = candidates.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[candidates[index], candidates[target]] = [candidates[target], candidates[index]]
  }
  const designs = new Set<string>()
  const distinct = candidates.filter((card) => {
    const key = cardDesignKey(card)
    if (designs.has(key)) return false
    designs.add(key)
    return true
  })
  const options = [...distinct, ...candidates.filter((card) => !distinct.includes(card))].slice(0, 3)
  if (options.length !== 3) throw new Error('Fortune Draw: perlu 3 kartu Rare yang dapat dimiliki tim ini di deck.')
  return options.map((card) => ({ id: card.id, name: card.name, type: 'Rare', effect: card.effect, effect_action: card.effect_action, icon: card.icon }))
}

function recordFortuneEffect(result: TacticalResolution['teams'][number], sourceId: string, name: string, type: CardType) {
  const effect = `Fortune Draw: +1 Rare ${cardTitleFor(name, type).replace(/ Card$/, '')} (untuk challenge berikutnya)`
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
      if (draw.options.length !== 3 || new Set(draw.options).size !== 3 || !draw.options.includes(draw.selected)) throw new Error('Fortune Draw: pilih 1 dari 3 kartu Rare.')
      const selected = await Card.findByPk(draw.selected, { transaction })
      if (draw.rewardId) {
        const reward = owned.find((entry) => entry.id === draw.rewardId)
        if (!reward || reward.name !== selected?.name || selected?.team !== result.teamId || selected.challenge !== challengeId) {
          throw new Error('Kartu pilihan Fortune Draw tidak tersedia. Muat ulang sebelum melanjutkan.')
        }
        recordFortuneEffect(result, source.id, selected.name, selected.type)
        continue
      }
      if (!selected || selected.type !== 'Rare' || isFortuneCard(selected) || selected.challenge || selected.team) {
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
