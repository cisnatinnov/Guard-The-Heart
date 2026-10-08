import { Scoreboard, Team } from '../models'
import { recalculateTotalScoreboard } from '../services/scoreboardAggregator'

export type ScoreboardEntry = Scoreboard & { teamRef?: Team }

export class ScoreboardController {
  static async list(): Promise<ScoreboardEntry[]> {
    return Scoreboard.findAll({
      include: [{ model: Team, as: 'teamRef' }],
      order: [
        ['rank', 'ASC'],
        ['total_cp', 'DESC'],
      ],
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