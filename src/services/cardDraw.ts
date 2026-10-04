import { Op } from 'sequelize'
import { Card, Challenge, ChallengeScoreboard, Team, TeamCard, type CardType } from '../models'

export interface CardPoolEntry {
  name: string
  type: 'Normal' | 'Rare' | 'Epic'
  effect: 'Defense' | 'Attack' | 'Heal' | 'Utility' | 'Support'
  icon: string
}

const CARD_POOL: CardPoolEntry[] = [
  ...Array(48).fill(null).map((_, i) => ({
    name: `Normal Card ${i + 1}`,
    type: 'Normal' as const,
    effect: ['Defense', 'Attack', 'Heal', 'Utility', 'Support'][i % 5] as 'Defense' | 'Attack' | 'Heal' | 'Utility' | 'Support',
    icon: ['🛡️', '🗡️', '❤️', '🔀', '🤝'][i % 5],
  })),
  ...Array(24).fill(null).map((_, i) => ({
    name: `Rare Card ${i + 1}`,
    type: 'Rare' as const,
    effect: ['Defense', 'Attack', 'Heal', 'Utility', 'Support'][i % 5] as 'Defense' | 'Attack' | 'Heal' | 'Utility' | 'Support',
    icon: ['🛡️', '🗡️', '❤️', '🔀', '🤝'][i % 5],
  })),
  ...Array(6).fill(null).map((_, i) => ({
    name: `Epic Card ${i + 1}`,
    type: 'Epic' as const,
    effect: ['Defense', 'Attack', 'Heal', 'Utility', 'Support'][i % 5] as 'Defense' | 'Attack' | 'Heal' | 'Utility' | 'Support',
    icon: ['🛡️', '🗡️', '❤️', '🔀', '🤝'][i % 5],
  })),
]

export const CARD_TYPES: CardType[] = ['Normal', 'Rare', 'Epic']
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

function poolEntryKey(entry: Pick<CardPoolEntry, 'name' | 'type' | 'effect' | 'icon'>): string {
  return [entry.type, entry.name, entry.effect, entry.icon].join('|')
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
  const drawnCards = await Card.findAll({ attributes: ['name', 'type', 'effect', 'icon'] })
  return new Set(drawnCards.map((card) => poolEntryKey(card)))
}

export async function getCardPoolStatus(): Promise<CardPoolStatus> {
  const drawnKeys = await loadDrawnPoolKeys()
  const byType: Record<CardType, CardPoolTypeStatus> = {
    Normal: { total: 0, drawn: 0, remaining: 0 },
    Rare: { total: 0, drawn: 0, remaining: 0 },
    Epic: { total: 0, drawn: 0, remaining: 0 },
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

export async function isChallengeComplete(challengeId: string): Promise<boolean> {
  const count = await ChallengeScoreboard.count({ where: { challenge: challengeId } })
  return count >= 5
}

export async function getTeamsWithCardRewards(challengeId: string): Promise<Array<{ teamId: string; cardCount: number }>> {
  const entries = await ChallengeScoreboard.findAll({
    where: { challenge: challengeId, card: { [Op.gt]: 0 } },
    attributes: ['team', 'card'],
    raw: true,
  })
  return entries.map((e) => ({ teamId: e.team, cardCount: e.card }))
}

export async function drawBonusCardsForChallenge(challengeId: string): Promise<Card[]> {
  const inFlight = challengeDrawsInFlight.get(challengeId)
  if (inFlight) return inFlight

  const draw = synchronizeCompletedChallengeCards(challengeId)
  challengeDrawsInFlight.set(challengeId, draw)
  try {
    return await draw
  } finally {
    if (challengeDrawsInFlight.get(challengeId) === draw) {
      challengeDrawsInFlight.delete(challengeId)
    }
  }
}

async function synchronizeCompletedChallengeCards(challengeId: string): Promise<Card[]> {
  const isComplete = await isChallengeComplete(challengeId)
  if (!isComplete) {
    throw new Error('Challenge not complete: not all 5 teams have participated')
  }

  const entries = await ChallengeScoreboard.findAll({
    where: { challenge: challengeId },
    attributes: ['team', 'card'],
  })
  const existingCards = await Card.findAll({
    where: { challenge: challengeId },
    order: [['createdAt', 'ASC']],
  })
  const existingByTeam = new Map<string, Card[]>()
  for (const card of existingCards) {
    if (!card.team) continue
    const teamCards = existingByTeam.get(card.team) ?? []
    teamCards.push(card)
    existingByTeam.set(card.team, teamCards)
  }

  const affectedTeamIds = new Set<string>([
    ...entries.map((entry) => entry.team),
    ...existingCards.flatMap((card) => (card.team ? [card.team] : [])),
  ])
  const drawnPoolKeys = await loadDrawnPoolKeys()
  const cardsByTeam = new Map<string, Card[]>()

  for (const entry of entries) {
    const desiredCount = Math.min(3, Math.max(0, entry.card))
    const currentCards = existingByTeam.get(entry.team) ?? []
    const keepCount = Math.min(desiredCount, currentCards.length)

    if (currentCards.length > keepCount) {
      await Card.destroy({
        where: { id: currentCards.slice(keepCount).map((card) => card.id) },
      })
    }

    const keptCards = currentCards.slice(0, keepCount)
    const missingCards = drawCardsFromPool(drawnPoolKeys, desiredCount - keepCount)
    for (const cardData of missingCards) {
      keptCards.push(
        await Card.create({
          ...cardData,
          challenge: challengeId,
          team: entry.team,
        })
      )
    }

    cardsByTeam.set(entry.team, keptCards)
  }

  const syncedCards = [...cardsByTeam.values()].flat()
  await synchronizePermanentTeamCards([...affectedTeamIds])
  return syncedCards.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

export async function synchronizeChallengeBonusCards(challengeId: string): Promise<void> {
  if (await isChallengeComplete(challengeId)) {
    await drawBonusCardsForChallenge(challengeId)
    return
  }

  const existingCards = await Card.findAll({
    where: { challenge: challengeId },
    attributes: ['team'],
  })
  const affectedTeamIds = [...new Set(existingCards.flatMap((card) => (card.team ? [card.team] : [])))]
  await Card.destroy({ where: { challenge: challengeId } })
  await synchronizePermanentTeamCards(affectedTeamIds)
}

export async function synchronizeAllChallengeBonusCards(): Promise<void> {
  const challenges = await Challenge.findAll({ attributes: ['id'] })
  for (const challenge of challenges) {
    await synchronizeChallengeBonusCards(challenge.id)
  }
}

async function synchronizePermanentTeamCards(teamIds: string[]): Promise<void> {
  if (teamIds.length === 0) return

  const cards = await Card.findAll({
    where: { team: { [Op.in]: teamIds } },
    order: [['createdAt', 'ASC']],
  })
  const teamCards = await TeamCard.findAll({
    where: { team: { [Op.in]: teamIds } },
    order: [['createdAt', 'ASC']],
  })
  const fingerprint = (card: Pick<Card, 'team' | 'name' | 'type' | 'effect' | 'icon'>) =>
    JSON.stringify([card.team, card.name, card.type, card.effect, card.icon])
  const expectedByFingerprint = new Map<string, Card[]>()
  const actualByFingerprint = new Map<string, TeamCard[]>()

  for (const card of cards) {
    const key = fingerprint(card)
    const expected = expectedByFingerprint.get(key) ?? []
    expected.push(card)
    expectedByFingerprint.set(key, expected)
  }
  for (const card of teamCards) {
    const key = fingerprint(card)
    const actual = actualByFingerprint.get(key) ?? []
    actual.push(card)
    actualByFingerprint.set(key, actual)
  }

  for (const [key, actual] of actualByFingerprint) {
    const expectedCount = expectedByFingerprint.get(key)?.length ?? 0
    if (actual.length > expectedCount) {
      await TeamCard.destroy({
        where: { id: actual.slice(expectedCount).map((card) => card.id) },
      })
    }
  }

  for (const [key, expected] of expectedByFingerprint) {
    const actualCount = actualByFingerprint.get(key)?.length ?? 0
    for (const card of expected.slice(actualCount)) {
      await TeamCard.create({
        name: card.name,
        type: card.type,
        effect: card.effect,
        icon: card.icon,
        team: card.team,
      })
    }
  }
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
      { model: ChallengeScoreboard, as: 'challengeRef' },
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