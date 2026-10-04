import { Card, TeamCard } from '../models'
import {
  isChallengeComplete,
  getTeamsWithCardRewards,
  drawBonusCardsForChallenge,
  getTeamDrawnCards,
  getChallengeBonusCards,
  getTeamCards,
  getCardPoolStatus,
  type CardPoolStatus,
} from '../services/cardDraw'

export class CardController {
  static async checkChallengeComplete(challengeId: string): Promise<boolean> {
    return isChallengeComplete(challengeId)
  }

  static async getTeamsEligibleForBonus(challengeId: string): Promise<Array<{ teamId: string; cardCount: number }>> {
    return getTeamsWithCardRewards(challengeId)
  }

  static async drawBonusCards(challengeId: string): Promise<Card[]> {
    return drawBonusCardsForChallenge(challengeId)
  }

  static async listTeamCards(teamId: string): Promise<Card[]> {
    return getTeamDrawnCards(teamId)
  }

  static async listChallengeBonusCards(challengeId: string): Promise<Card[]> {
    return getChallengeBonusCards(challengeId)
  }

  static async listTeamCardsPermanent(teamId: string): Promise<TeamCard[]> {
    return getTeamCards(teamId)
  }

  static async getPoolStatus(): Promise<CardPoolStatus> {
    return getCardPoolStatus()
  }
}