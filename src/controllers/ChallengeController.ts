import { Challenge } from '../models'
import { recalculateTotalScoreboard } from '../services/scoreboardAggregator'

export class ChallengeController {
  static async list(): Promise<Challenge[]> {
    return Challenge.findAll({ order: [['name', 'ASC']] })
  }

  static async getById(id: string): Promise<Challenge | null> {
    return Challenge.findByPk(id)
  }

  static async create(name: string): Promise<Challenge> {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Challenge name is required')
    const duplicate = await Challenge.findOne({ where: { name: trimmed } })
    if (duplicate) throw new Error(`Challenge "${trimmed}" already exists`)
    return Challenge.create({ name: trimmed })
  }

  static async rename(id: string, name: string): Promise<Challenge | null> {
    const challenge = await Challenge.findByPk(id)
    if (!challenge) return null
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Challenge name is required')
    const duplicate = await Challenge.findOne({ where: { name: trimmed } })
    if (duplicate && duplicate.id !== id) throw new Error(`Challenge "${trimmed}" already exists`)
    await challenge.update({ name: trimmed })
    return challenge
  }

  static async remove(id: string): Promise<boolean> {
    const deleted = await Challenge.destroy({ where: { id } })
    if (deleted > 0) {
      // Cascading deletes remove the entries, so derived totals and team
      // guard power have to be rebuilt from what is left.
      await recalculateTotalScoreboard()
    }
    return deleted > 0
  }
}