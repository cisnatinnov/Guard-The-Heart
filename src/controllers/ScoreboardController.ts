import { Challenge, ChallengePoint, Scoreboard, Team } from '../models'
import { recalculateTotalScoreboard } from '../services/scoreboardAggregator'

export interface ChallengeScoreDetail {
  challengeId: string
  challengeName: string
  challenge_point: number
  rank: number
}

type ScoreWithChallenge = ChallengePoint & { challengeRef?: Challenge }

export type ScoreboardEntry = Scoreboard & {
  teamRef?: Team
  challengeScores?: ChallengeScoreDetail[]
}

export class ScoreboardController {
  static async list(): Promise<ScoreboardEntry[]> {
    const rows = await Scoreboard.findAll({
      include: [{ model: Team, as: 'teamRef' }],
      order: [
        ['rank', 'ASC'],
        ['total_cp', 'DESC'],
      ],
    })

    const challengePoints = (await ChallengePoint.findAll({
      include: [{ model: Challenge, as: 'challengeRef', attributes: ['id', 'name'] }],
      order: [[{ model: Challenge, as: 'challengeRef' }, 'name', 'ASC']],
    })) as ScoreWithChallenge[]

    const scoresByTeam = new Map<string, ChallengeScoreDetail[]>()
    for (const point of challengePoints) {
      const scores = scoresByTeam.get(point.team) ?? []
      scores.push({
        challengeId: point.challenge,
        challengeName: point.challengeRef?.name ?? 'Unknown',
        challenge_point: point.challenge_point,
        rank: point.rank,
      })
      scoresByTeam.set(point.team, scores)
    }

    return rows.map((row) => {
      const entry = row as ScoreboardEntry
      entry.challengeScores = scoresByTeam.get(row.team) ?? []
      return entry
    })
  }

  static async getByTeam(teamId: string): Promise<Scoreboard | null> {
    return Scoreboard.findOne({ where: { team: teamId } })
  }

  static async recalculate(): Promise<ScoreboardEntry[]> {
    await recalculateTotalScoreboard()
    return ScoreboardController.list()
  }

  static async remove(id: string): Promise<boolean> {
    const deleted = await Scoreboard.destroy({ where: { id } })
    return deleted > 0
  }
}