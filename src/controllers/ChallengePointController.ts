import { Op } from 'sequelize'
import { Challenge, ChallengePoint, Team } from '../models'
import type { ChallengePoint as ChallengePointModel } from '../models'
import {
  MAX_ENTRIES_PER_CHALLENGE,
  MAX_RANK,
  MIN_RANK,
} from '../services/rankRules'
import { recalculateTotalScoreboard, rerankChallenge } from '../services/scoreboardAggregator'
import { dbEvents, DB_EVENTS } from '../hooks/useDbEvents'

export interface ChallengePointInput {
  challenge: string
  team: string
  challenge_point: number
}

export type ChallengePointEntry = ChallengePointModel & {
  challengeRef?: Challenge
  teamRef?: Team
}

function parseChallengePoint(raw: number): number {
  const cp = Math.trunc(Number(raw))
  if (!Number.isFinite(cp)) throw new Error('Challenge point must be a number')
  if (cp < -999) throw new Error('Challenge point cannot be less than -999')
  if (cp > 999) throw new Error('Challenge point cannot exceed 999')
  return cp
}

export class ChallengePointController {
  static async listByChallenge(challengeId: string): Promise<ChallengePointEntry[]> {
    return ChallengePoint.findAll({
      where: { challenge: challengeId },
      include: [
        { model: Challenge, as: 'challengeRef' },
        { model: Team, as: 'teamRef' },
      ],
      order: [
        ['rank', 'ASC'],
        ['challenge_point', 'DESC'],
      ],
    })
  }

  static async listAll(): Promise<ChallengePointEntry[]> {
    return ChallengePoint.findAll({
      include: [
        { model: Challenge, as: 'challengeRef' },
        { model: Team, as: 'teamRef' },
      ],
      order: [
        ['challenge', 'ASC'],
        ['rank', 'ASC'],
        ['challenge_point', 'DESC'],
      ],
    })
  }

  static async getById(id: string): Promise<ChallengePoint | null> {
    return ChallengePoint.findByPk(id)
  }

  static async create(input: ChallengePointInput): Promise<ChallengePoint> {
    const challenge = await Challenge.findByPk(input.challenge)
    if (!challenge) throw new Error('Related challenge was not found')

    const team = await Team.findByPk(input.team)
    if (!team) throw new Error('Related team was not found')

    const challenge_point = parseChallengePoint(input.challenge_point)

    const [existing] = await ChallengePoint.findAll({
      where: { challenge: input.challenge, team: input.team },
      limit: 1,
    })
    if (existing) throw new Error(`${team.name} already has an entry for this challenge`)

    const total = await ChallengePoint.count({ where: { challenge: input.challenge } })
    if (total >= MAX_ENTRIES_PER_CHALLENGE) {
      throw new Error(
        `A challenge can hold at most ${MAX_ENTRIES_PER_CHALLENGE} entries (rank ${MIN_RANK}-${MAX_RANK})`
      )
    }

    const entry = await ChallengePoint.create({
      challenge: input.challenge,
      team: input.team,
      rank: 0,
      challenge_point,
      guard_power: 0,
      card: 0,
    })

    await rerankChallenge(input.challenge)
    await recalculateTotalScoreboard()
    dbEvents.emit(DB_EVENTS.CHALLENGE_POINTS_CHANGED)
    dbEvents.emit(DB_EVENTS.SCOREBOARD_CHANGED)
    return (await ChallengePoint.findByPk(entry.id)) as ChallengePoint
  }

  static async update(
    id: string,
    input: { challenge_point?: number; team?: string }
  ): Promise<ChallengePoint | null> {
    const entry = await ChallengePoint.findByPk(id)
    if (!entry) return null

    if (input.challenge_point !== undefined) {
      await entry.update({ challenge_point: parseChallengePoint(input.challenge_point) })
    }

    if (input.team !== undefined) {
      const team = await Team.findByPk(input.team)
      if (!team) throw new Error('Related team was not found')
      const clash = await ChallengePoint.findOne({
        where: { challenge: entry.challenge, team: input.team, id: { [Op.ne]: id } },
      })
      if (clash) throw new Error(`${team.name} already has an entry for this challenge`)
      await entry.update({ team: input.team })
    }

    await rerankChallenge(entry.challenge)
    await recalculateTotalScoreboard()
    dbEvents.emit(DB_EVENTS.CHALLENGE_POINTS_CHANGED)
    dbEvents.emit(DB_EVENTS.SCOREBOARD_CHANGED)
    return ChallengePoint.findByPk(id)
  }

  static async remove(id: string): Promise<boolean> {
    const entry = await ChallengePoint.findByPk(id)
    if (!entry) return false
    const challengeId = entry.challenge
    const deleted = await ChallengePoint.destroy({ where: { id } })
    if (deleted === 0) return false
    await rerankChallenge(challengeId)
    await recalculateTotalScoreboard()
    dbEvents.emit(DB_EVENTS.CHALLENGE_POINTS_CHANGED)
    dbEvents.emit(DB_EVENTS.SCOREBOARD_CHANGED)
    return true
  }
}
