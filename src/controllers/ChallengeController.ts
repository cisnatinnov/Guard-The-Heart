import { Challenge } from '../models'
import { recalculateTotalScoreboard } from '../services/scoreboardAggregator'
import { isLockedChallengeName } from '../services/challengeSeeds'
import { releaseChallengeBonusCards } from '../services/cardDraw'

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
    // The six playable challenges ship as challenge data, so their names are
    // reserved and cannot be taken by a second row.
    if (isLockedChallengeName(trimmed)) {
      throw new Error(`Challenge "${trimmed}" is built in and cannot be added again`)
    }
    const duplicate = await Challenge.findOne({ where: { name: trimmed } })
    if (duplicate) throw new Error(`Challenge "${trimmed}" already exists`)
    return Challenge.create({ name: trimmed })
  }

  static async rename(id: string, name: string): Promise<Challenge | null> {
    const challenge = await Challenge.findByPk(id)
    if (!challenge) return null
    if (isLockedChallengeName(challenge.name)) {
      throw new Error(`Challenge "${challenge.name}" is built in and cannot be renamed`)
    }
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Challenge name is required')
    if (isLockedChallengeName(trimmed)) {
      throw new Error(`"${trimmed}" is a built-in challenge name and cannot be reused`)
    }
    const duplicate = await Challenge.findOne({ where: { name: trimmed } })
    if (duplicate && duplicate.id !== id) throw new Error(`Challenge "${trimmed}" already exists`)
    await challenge.update({ name: trimmed })
    return challenge
  }

  static async remove(id: string): Promise<boolean> {
    const challenge = await Challenge.findByPk(id)
    if (!challenge) return false
    if (isLockedChallengeName(challenge.name)) {
      throw new Error(`Challenge "${challenge.name}" is built in and cannot be deleted`)
    }
    await releaseChallengeBonusCards(id)
    const deleted = await Challenge.destroy({ where: { id } })
    if (deleted > 0) {
      // Cascading deletes remove the entries, so derived totals and team
      // guard power have to be rebuilt from what is left.
      await recalculateTotalScoreboard()
    }
    return deleted > 0
  }
}