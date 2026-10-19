import type { Transaction } from 'sequelize'
import { Card, ChallengePoint, TeamCard } from '../models'
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

/** Award the chosen copy for another challenge without activating or consuming it now. */
export async function settleFortuneDraws(challengeId: string, resolution: TacticalResolution, transaction: Transaction): Promise<void> {
  const used = usedTacticalCardIds(challengeId)
  for (const result of resolution.teams) {
    if (!result.fortuneDraws?.length) continue
    const owned = await TeamCard.findAll({ where: { team: result.teamId }, transaction })
    const available = owned.filter((card) => !used.has(card.id) && !result.usedCardIds?.includes(card.id))
    const point = await ChallengePoint.findOne({ where: { challenge: challengeId, team: result.teamId }, transaction })
    for (const draw of result.fortuneDraws ?? []) {
      const source = owned.find((card) => card.id === draw.cardId && isFortuneCard(card))
      if (!source || used.has(source.id) || !result.usedCardIds?.includes(source.id)) throw new Error('Fortune Draw sudah digunakan atau bukan milik tim ini.')
      if (draw.options.length !== 3 || new Set(draw.options).size !== 3 || !draw.options.includes(draw.selected)) throw new Error('Fortune Draw: pilih 1 dari 3 kartu Rare.')
      const selected = await Card.findByPk(draw.selected, { transaction })
      if (!selected || selected.type !== 'Rare' || isFortuneCard(selected) || selected.challenge || selected.team) {
        throw new Error('Kartu pilihan Fortune Draw tidak tersedia. Pilih kartu Rare lain dari tawaran yang tersimpan.')
      }
      if (available.some((card) => cardDesignKey(card) === cardDesignKey(selected))) throw new Error('Tim sudah memiliki desain kartu pilihan Fortune Draw.')
      if (available.length >= MAX_TOTAL_CARD) throw new Error('Koleksi tim penuh; tidak dapat menerima Fortune Draw.')
      await selected.update({ challenge: challengeId, team: result.teamId, challenge_point: point?.id ?? null }, { transaction })
      const reward = await TeamCard.create({ name: selected.name, type: selected.type, effect: selected.effect,
        effect_action: selected.effect_action, icon: selected.icon, team: result.teamId, challenge_point: point?.id ?? null }, { transaction })
      available.push(reward)
      const effect = `Fortune Draw: +1 Rare ${cardTitleFor(selected.name, selected.type).replace(/ Card$/, '')} (untuk challenge berikutnya)`
      result.effects.push(effect)
      ;(result.usedCardEffects ??= []).push(effect)
      ;(result.cardEffects ??= {})[source.id] = [effect]
    }
  }
}
