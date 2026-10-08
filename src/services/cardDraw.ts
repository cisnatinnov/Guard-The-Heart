import { Op } from 'sequelize'
import { Card, Challenge, ChallengePoint, Team, TeamCard, type CardEffect, type CardType } from '../models'
import { CARD_POOL as CARD_CATALOG } from '../data/card-pool'

async function findChallengePointForCard(card: Card, teamId: string): Promise<ChallengePoint | null> {
  if (!card.challenge) return null
  return ChallengePoint.findOne({
    where: { challenge: card.challenge, team: teamId },
    attributes: ['id'],
  })
}

export interface CardPoolEntry {
  name: string
  type: CardType
  effect: CardEffect
  effect_action: string
  icon: string
}

const CARD_POOL: CardPoolEntry[] = CARD_CATALOG
const CARD_POOL_KEYS = new Set(CARD_POOL.map(poolEntryKey))

export const CARD_TYPES: CardType[] = ['Normal', 'Rare', 'Epic', 'Legendary']
export const CARD_POOL_TOTAL = CARD_POOL.length

export interface CardPoolTypeStatus {
  total: number
  drawn: number
  remaining: number
}

export interface CardPoolStatus {
  total: number
  drawn: number
  remaining: number
  byType: Record<CardType, CardPoolTypeStatus>
}

function poolEntryKey(
  entry: Pick<CardPoolEntry, 'name' | 'type' | 'effect' | 'effect_action' | 'icon'>
): string {
  return [entry.type, entry.name, entry.effect, entry.effect_action, entry.icon].join('|')
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function availablePoolCards(drawnKeys: ReadonlySet<string>): CardPoolEntry[] {
  return CARD_POOL.filter((entry) => !drawnKeys.has(poolEntryKey(entry)))
}

export function drawCardsFromPool(drawnKeys: Set<string>, count: number): CardPoolEntry[] {
  const picked = shuffle(availablePoolCards(drawnKeys)).slice(0, Math.max(0, Math.trunc(count)))
  for (const card of picked) {
    drawnKeys.add(poolEntryKey(card))
  }
  return picked
}

async function loadDrawnPoolKeys(): Promise<Set<string>> {
  const drawnCards = await Card.findAll({
    where: { challenge: { [Op.ne]: null } },
    attributes: ['name', 'type', 'effect', 'effect_action', 'icon'],
  })
  return new Set(drawnCards.map((card) => poolEntryKey(card)))
}

/** Seeds each finite-pool card as a permanent, unassigned database row. */
export async function seedCardPool(): Promise<void> {
  const inventory = await Card.findAll({
    attributes: ['id', 'name', 'type', 'effect', 'effect_action', 'icon', 'challenge', 'team'],
    order: [['createdAt', 'ASC']],
  })
  const catalogNames = new Set(CARD_POOL.map((card) => card.name))
  const existingByName = new Map<string, Card>()
  const legacyCards: Card[] = []
  for (const card of inventory) {
    if (catalogNames.has(card.name) && !existingByName.has(card.name)) {
      existingByName.set(card.name, card)
    } else {
      legacyCards.push(card)
    }
  }

  for (const legacy of legacyCards) {
    const replacement =
      legacy.challenge || legacy.team
        ? CARD_POOL.find((card) => card.type === legacy.type && !existingByName.has(card.name))
        : undefined
    if (!replacement) {
      await legacy.destroy()
      continue
    }
    await legacy.update({ ...replacement })
    existingByName.set(replacement.name, legacy)
  }

  for (const card of CARD_POOL) {
    const existing = existingByName.get(card.name)
    if (existing) {
      if (
        existing.type !== card.type ||
        existing.effect !== card.effect ||
        existing.effect_action !== card.effect_action ||
        existing.icon !== card.icon
      ) {
        await existing.update({
          type: card.type,
          effect: card.effect,
          effect_action: card.effect_action,
          icon: card.icon,
        })
      }
      continue
    }
    const created = await Card.create({ ...card, challenge: null, team: null })
    existingByName.set(card.name, created)
  }
}

async function returnCardsToPool(cards: Card[]): Promise<void> {
  if (cards.length === 0) return
  await Card.update(
    { challenge: null, team: null },
    { where: { id: cards.map((card) => card.id) } }
  )

  const drawnKeys = await loadDrawnPoolKeys()
  const returnedKeys = new Set<string>()
  for (const card of cards) {
    const key = poolEntryKey(card)
    if (!CARD_POOL_KEYS.has(key) || drawnKeys.has(key) || returnedKeys.has(key)) {
      await Card.destroy({ where: { id: card.id } })
      continue
    }
    returnedKeys.add(key)
  }
}

export async function getCardPoolStatus(): Promise<CardPoolStatus> {
  const drawnKeys = await loadDrawnPoolKeys()
  const byType: Record<CardType, CardPoolTypeStatus> = {
    Normal: { total: 0, drawn: 0, remaining: 0 },
    Rare: { total: 0, drawn: 0, remaining: 0 },
    Epic: { total: 0, drawn: 0, remaining: 0 },
    Legendary: { total: 0, drawn: 0, remaining: 0 },
  }

  for (const entry of CARD_POOL) {
    const bucket = byType[entry.type]
    bucket.total += 1
    if (drawnKeys.has(poolEntryKey(entry))) bucket.drawn += 1
    else bucket.remaining += 1
  }

  return {
    total: CARD_POOL_TOTAL,
    drawn: CARD_TYPES.reduce((sum, type) => sum + byType[type].drawn, 0),
    remaining: CARD_TYPES.reduce((sum, type) => sum + byType[type].remaining, 0),
    byType,
  }
}

const challengeDrawsInFlight = new Map<string, Promise<Card[]>>()
let poolOperationQueue: Promise<void> = Promise.resolve()

function serializePoolOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = poolOperationQueue.then(operation, operation)
  poolOperationQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

export async function isChallengeComplete(challengeId: string): Promise<boolean> {
  const count = await ChallengePoint.count({ where: { challenge: challengeId } })
  return count >= 5
}

export interface TeamCardReward {
  teamId: string
  teamName?: string
  rank: number
  cardCount: number
  guardPower: number
}

export async function getTeamsWithCardRewards(challengeId: string): Promise<Array<{ teamId: string; guardPower: number }>> {
  const entries = await ChallengePoint.findAll({
    where: { challenge: challengeId },
    attributes: ['team', 'guard_power'],
    raw: true,
  })
  return entries.map((e) => ({ teamId: e.team, guardPower: e.guard_power }))
}

export async function getEligibleTeamsForChallenge(challengeId: string): Promise<TeamCardReward[]> {
  const entries = await ChallengePoint.findAll({
    where: { challenge: challengeId },
    attributes: ['team', 'rank', 'guard_power'],
    include: [{ model: Team, as: 'teamRef', attributes: ['name'] }],
    order: [['rank', 'ASC']],
  })

  const cardRewardsByRank: Record<number, number> = { 1: 3, 2: 2, 3: 2, 4: 1, 5: 0 }

  return entries.map((entry) => ({
    teamId: entry.team,
    teamName: (entry as any).teamRef?.name,
    rank: entry.rank,
    cardCount: cardRewardsByRank[entry.rank] ?? 0,
    guardPower: entry.guard_power,
  }))
}

export async function getEligibleTeamsForAllChallenges(): Promise<Record<string, TeamCardReward[]>> {
  const challenges = await Challenge.findAll({ attributes: ['id'] })
  const result: Record<string, TeamCardReward[]> = {}
  for (const challenge of challenges) {
    result[challenge.id] = await getEligibleTeamsForChallenge(challenge.id)
  }
  return result
}

export async function isChallengeCardsDrawn(challengeId: string): Promise<boolean> {
  const challenge = await Challenge.findByPk(challengeId, { attributes: ['id', 'cards_drawn_at'] })
  return Boolean(challenge?.cards_drawn_at)
}

/**
 * Draws a completed challenge's bonus cards exactly once into the challenge pool
 * (with challenge reference but no team). The drawn cards become available for
 * admin to assign to teams via Card Reveal. A second draw request is rejected.
 */
export async function drawBonusCardsForChallenge(challengeId: string): Promise<Card[]> {
  const inFlight = challengeDrawsInFlight.get(challengeId)
  if (inFlight) return inFlight

  const draw = serializePoolOperation(() => drawChallengeCardsOnce(challengeId))
  challengeDrawsInFlight.set(challengeId, draw)
  try {
    return await draw
  } finally {
    if (challengeDrawsInFlight.get(challengeId) === draw) {
      challengeDrawsInFlight.delete(challengeId)
    }
  }
}

async function drawChallengeCardsOnce(challengeId: string): Promise<Card[]> {
  const challenge = await Challenge.findByPk(challengeId)
  if (!challenge) throw new Error('Challenge was not found')
  if (challenge.cards_drawn_at) {
    throw new Error(`Cards for "${challenge.name}" have already been drawn`)
  }
  if (!(await isChallengeComplete(challengeId))) {
    throw new Error('Challenge not complete: not all 5 teams have participated')
  }

  const entries = await ChallengePoint.findAll({
    where: { challenge: challengeId },
    attributes: ['team', 'rank'],
    order: [['rank', 'ASC']],
  })
  const drawnPoolKeys = await loadDrawnPoolKeys()
  const drawnCards: Card[] = []

  for (const entry of entries) {
    // Card count based on rank (blueprint):
    // Rank 1: 3 cards, Rank 2: 2 cards, Rank 3: 2 cards, Rank 4: 1 card, Rank 5: 0 cards
    const cardRewardsByRank: Record<number, number> = { 1: 3, 2: 2, 3: 2, 4: 1, 5: 0 }
    const cardCount = cardRewardsByRank[entry.rank] ?? 0
    for (const cardData of drawCardsFromPool(drawnPoolKeys, cardCount)) {
      const poolCard = await Card.findOne({
        where: {
          name: cardData.name,
          type: cardData.type,
          effect: cardData.effect,
          effect_action: cardData.effect_action,
          icon: cardData.icon,
          challenge: null,
          team: null,
        },
      })
      if (!poolCard) throw new Error(`Card pool inventory is missing "${cardData.name}"`)
      // Assign to challenge only (no team yet - admin will assign later)
      await poolCard.update({ challenge: challengeId, team: null })
      drawnCards.push(poolCard)
    }
  }

  await challenge.update({ cards_drawn_at: new Date() })
  return drawnCards
}

/** Releases a challenge's drawn inventory before the challenge row is deleted. */
export async function releaseChallengeBonusCards(challengeId: string): Promise<void> {
  const existingCards = await Card.findAll({
    where: { challenge: challengeId },
    order: [['createdAt', 'ASC']],
  })
  await returnCardsToPool(existingCards)
  await Challenge.update({ cards_drawn_at: null }, { where: { id: challengeId } })
}

/**
 * Startup reconciliation. Challenges whose cards were drawn by an older build
 * are marked as drawn. No automatic team assignment - admin handles that.
 */
export async function synchronizeAllChallengeBonusCards(): Promise<void> {
  const assigned = await Card.findAll({
    where: { challenge: { [Op.ne]: null } },
    attributes: ['challenge'],
  })
  const drawnChallengeIds = [...new Set(assigned.map((card) => card.challenge as string))]
  if (drawnChallengeIds.length > 0) {
    await Challenge.update(
      { cards_drawn_at: new Date() },
      { where: { id: { [Op.in]: drawnChallengeIds }, cards_drawn_at: null } }
    )
  }
}

/**
 * Admin assigns a drawn card (from challenge pool) to a team.
 * If team already has 8 cards, the admin must choose one to replace.
 */
export async function assignCardToTeam(cardId: string, teamId: string): Promise<TeamCard> {
  const card = await Card.findByPk(cardId)
  if (!card) throw new Error('Card not found')
  if (!card.challenge) throw new Error('Card is not from a challenge pool')
  if (card.team) throw new Error('Card already assigned to a team')

  const team = await Team.findByPk(teamId)
  if (!team) throw new Error('Team not found')

  // Find the ChallengePoint for this team+challenge to link the card
  const challengePoint = await findChallengePointForCard(card, teamId)

  // Assign card to team and link to ChallengePoint
  await card.update({ team: teamId, challenge_point: challengePoint?.id ?? null })

  // Add to permanent TeamCard collection
  const teamCard = await TeamCard.create({
    name: card.name,
    type: card.type,
    effect: card.effect,
    effect_action: card.effect_action,
    icon: card.icon,
    team: teamId,
    challenge_point: challengePoint?.id ?? null,
  })

  return teamCard
}

/**
 * Admin replaces a team's card: removes one TeamCard and assigns a new drawn card.
 */
export async function replaceTeamCard(teamId: string, oldTeamCardId: string, newCardId: string): Promise<TeamCard> {
  const team = await Team.findByPk(teamId)
  if (!team) throw new Error('Team not found')

  const oldTeamCard = await TeamCard.findByPk(oldTeamCardId)
  if (!oldTeamCard || oldTeamCard.team !== teamId) throw new Error('Team card not found')

  const newCard = await Card.findByPk(newCardId)
  if (!newCard) throw new Error('New card not found')
  if (!newCard.challenge) throw new Error('New card is not from a challenge pool')
  if (newCard.team) throw new Error('New card already assigned to a team')

  // Find the ChallengePoint for this team+challenge to link the card
  const challengePoint = await findChallengePointForCard(newCard, teamId)

  // Remove old team card
  await oldTeamCard.destroy()

  // Assign new card to team and link to ChallengePoint
  await newCard.update({ team: teamId, challenge_point: challengePoint?.id ?? null })

  // Add new card to TeamCard
  const teamCard = await TeamCard.create({
    name: newCard.name,
    type: newCard.type,
    effect: newCard.effect,
    effect_action: newCard.effect_action,
    icon: newCard.icon,
    team: teamId,
    challenge_point: challengePoint?.id ?? null,
  })

  return teamCard
}

/**
 * Get available drawn cards for a challenge (cards with challenge ref but no team).
 */
export async function getAvailableDrawnCards(challengeId: string): Promise<Card[]> {
  return Card.findAll({
    where: { challenge: challengeId, team: null },
    include: [{ model: Challenge, as: 'challengeBonusRef' }],
    order: [['createdAt', 'ASC']],
  })
}

/**
 * Get all available drawn cards across all challenges (for admin overview).
 */
export async function getAllAvailableDrawnCards(): Promise<Card[]> {
  return Card.findAll({
    where: { challenge: { [Op.ne]: null }, team: null },
    include: [
      { model: Challenge, as: 'challengeBonusRef' },
      { model: Team, as: 'teamRef' },
    ],
    order: [['challenge', 'ASC'], ['createdAt', 'ASC']],
  })
}

export async function getTeamDrawnCards(teamId: string): Promise<Card[]> {
  return Card.findAll({
    where: { team: teamId },
    include: [{ model: Team, as: 'teamRef' }],
    order: [['createdAt', 'DESC']],
  })
}

export async function getChallengeBonusCards(challengeId: string): Promise<Card[]> {
  return Card.findAll({
    where: { challenge: challengeId },
    include: [
      { model: Team, as: 'teamRef' },
      { model: ChallengePoint, as: 'challengePointRef' },
    ],
    order: [['createdAt', 'DESC']],
  })
}

export async function getTeamCards(teamId: string): Promise<TeamCard[]> {
  return TeamCard.findAll({
    where: { team: teamId },
    order: [['createdAt', 'DESC']],
  })
}

export async function getTeamCardById(teamCardId: string): Promise<TeamCard | null> {
  return TeamCard.findByPk(teamCardId)
}