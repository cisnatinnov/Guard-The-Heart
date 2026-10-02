import { Op } from 'sequelize'
import { Card, ChallengeScoreboard, Team, TeamCard } from '../models'

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

function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function drawRandomCards(count: number): CardPoolEntry[] {
  const shuffled = shuffle(CARD_POOL)
  return shuffled.slice(0, count)
}

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
  const isComplete = await isChallengeComplete(challengeId)
  if (!isComplete) {
    throw new Error('Challenge not complete: not all 5 teams have participated')
  }

  const teamsWithRewards = await getTeamsWithCardRewards(challengeId)
  if (teamsWithRewards.length === 0) {
    return []
  }

  const drawnCards: Card[] = []

  for (const { teamId, cardCount } of teamsWithRewards) {
    const cardsToDraw = Math.min(cardCount, 3)
    const drawn = drawRandomCards(cardsToDraw)

    for (const cardData of drawn) {
      const card = await Card.create({
        ...cardData,
        challenge: challengeId,
        team: teamId,
      })
      drawnCards.push(card)

      // Also store permanently in TeamCard table (team reference only, no challenge)
      await TeamCard.create({
        ...cardData,
        team: teamId,
      })
    }
  }

  return drawnCards
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