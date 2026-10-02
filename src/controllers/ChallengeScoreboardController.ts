import { Op } from 'sequelize'
import { Challenge, ChallengeScoreboard, Team } from '../models'
import type { ChallengeScoreboard as ChallengeScoreboardModel } from '../models'
import {
  MAX_ENTRIES_PER_CHALLENGE,
  MAX_RANK,
  MIN_RANK,
} from '../services/rankRules'
import { recalculateTotalScoreboard, rerankChallenge } from '../services/scoreboardAggregator'
import { drawBonusCardsForChallenge, isChallengeComplete } from '../services/cardDraw'

export interface ChallengeScoreInput {
  challenge: string
  team: string
  score: number
}

// The `challenge` and `team` columns hold uuids, so the joined models are
// exposed under distinct aliases instead of colliding with those fields.
export type ChallengeScoreEntry = ChallengeScoreboardModel & {
  challengeRef?: Challenge
  teamRef?: Team
}

function parseScore(raw: number): number {
  const score = Math.trunc(Number(raw))
  if (!Number.isFinite(score)) throw new Error('Score must be a number')
  if (score < 0) throw new Error('Score cannot be negative')
  if (score > 999) throw new Error('Score cannot exceed 999')
  return score
}

export class ChallengeScoreboardController {
  static async listByChallenge(challengeId: string): Promise<ChallengeScoreEntry[]> {
    return ChallengeScoreboard.findAll({
      where: { challenge: challengeId },
      include: [
        { model: Challenge, as: 'challengeRef' },
        { model: Team, as: 'teamRef' },
      ],
      order: [
        ['rank', 'ASC'],
        ['score', 'DESC'],
      ],
    })
  }

  static async listAll(): Promise<ChallengeScoreEntry[]> {
    return ChallengeScoreboard.findAll({
      include: [
        { model: Challenge, as: 'challengeRef' },
        { model: Team, as: 'teamRef' },
      ],
      order: [
        ['challenge', 'ASC'],
        ['rank', 'ASC'],
        ['score', 'DESC'],
      ],
    })
  }

  static async getById(id: string): Promise<ChallengeScoreboard | null> {
    return ChallengeScoreboard.findByPk(id)
  }

  static async create(input: ChallengeScoreInput): Promise<ChallengeScoreboard> {
    const challenge = await Challenge.findByPk(input.challenge)
    if (!challenge) throw new Error('Related challenge was not found')

    const team = await Team.findByPk(input.team)
    if (!team) throw new Error('Related team was not found')

    const score = parseScore(input.score)

    const [existing] = await ChallengeScoreboard.findAll({
      where: { challenge: input.challenge, team: input.team },
      limit: 1,
    })
    if (existing) throw new Error(`${team.name} already has a score for this challenge`)

    const total = await ChallengeScoreboard.count({ where: { challenge: input.challenge } })
    if (total >= MAX_ENTRIES_PER_CHALLENGE) {
      throw new Error(
        `A challenge can hold at most ${MAX_ENTRIES_PER_CHALLENGE} entries (rank ${MIN_RANK}-${MAX_RANK})`
      )
    }

    const entry = await ChallengeScoreboard.create({
      challenge: input.challenge,
      team: input.team,
      score,
      rank: 0,
      challenge_point: 0,
      guard_power: 0,
      card: 0,
    })

    await rerankChallenge(input.challenge)
    await recalculateTotalScoreboard()
    const complete = await isChallengeComplete(input.challenge)
    if (complete) {
      await drawBonusCardsForChallenge(input.challenge)
    }
    return (await ChallengeScoreboard.findByPk(entry.id)) as ChallengeScoreboard
  }

  static async update(
    id: string,
    input: { score?: number; team?: string }
  ): Promise<ChallengeScoreboard | null> {
    const entry = await ChallengeScoreboard.findByPk(id)
    if (!entry) return null

    if (input.score !== undefined) {
      await entry.update({ score: parseScore(input.score) })
    }

    if (input.team !== undefined) {
      const team = await Team.findByPk(input.team)
      if (!team) throw new Error('Related team was not found')
      const clash = await ChallengeScoreboard.findOne({
        where: { challenge: entry.challenge, team: input.team, id: { [Op.ne]: id } },
      })
      if (clash) throw new Error(`${team.name} already has a score for this challenge`)
      await entry.update({ team: input.team })
    }

    await rerankChallenge(entry.challenge)
    await recalculateTotalScoreboard()
    const complete = await isChallengeComplete(entry.challenge)
    if (complete) {
      await drawBonusCardsForChallenge(entry.challenge)
    }
    return ChallengeScoreboard.findByPk(id)
  }

  static async remove(id: string): Promise<boolean> {
    const entry = await ChallengeScoreboard.findByPk(id)
    if (!entry) return false
    const challengeId = entry.challenge
    const deleted = await ChallengeScoreboard.destroy({ where: { id } })
    if (deleted === 0) return false
    await rerankChallenge(challengeId)
    await recalculateTotalScoreboard()
    const complete = await isChallengeComplete(challengeId)
    if (complete) {
      await drawBonusCardsForChallenge(challengeId)
    }
    return true
  }
}