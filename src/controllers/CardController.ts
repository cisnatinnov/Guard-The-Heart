import { Card, TeamCard } from '../models'
import {
  isChallengeComplete,
  isChallengeCardsDrawn,
  getTeamsWithCardRewards,
  drawBonusCardsForChallenge,
  getTeamDrawnCards,
  getChallengeBonusCards,
  getTeamCards,
  getCardPoolStatus,
  getAvailableDrawnCards,
  getAllAvailableDrawnCards,
  assignCardToTeam as assignCardToTeamFn,
  replaceTeamCard as replaceTeamCardFn,
  getTeamCardById,
  getEligibleTeamsForChallenge,
  getEligibleTeamsForAllChallenges,
  type CardPoolStatus,
  type TeamCardReward,
} from '../services/cardDraw'
import { dbEvents, DB_EVENTS } from '../hooks/useDbEvents'

export class CardController {
  static async checkChallengeComplete(challengeId: string): Promise<boolean> {
    return isChallengeComplete(challengeId)
  }

  static async getTeamsEligibleForBonus(challengeId: string): Promise<Array<{ teamId: string; guardPower: number }>> {
    return getTeamsWithCardRewards(challengeId)
  }

  static async isChallengeCardsDrawn(challengeId: string): Promise<boolean> {
    return isChallengeCardsDrawn(challengeId)
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

  /** Get available drawn cards for a challenge (challenge ref, no team) for admin assignment. */
  static async getAvailableDrawnCards(challengeId: string): Promise<Card[]> {
    return getAvailableDrawnCards(challengeId)
  }

  /** Get all available drawn cards across all challenges. */
  static async getAllAvailableDrawnCards(): Promise<Card[]> {
    return getAllAvailableDrawnCards()
  }

  /** Get eligible teams for a challenge with their card rewards based on rank. */
  static async getEligibleTeamsForChallenge(challengeId: string): Promise<TeamCardReward[]> {
    return getEligibleTeamsForChallenge(challengeId)
  }

  /** Get eligible teams for all challenges. */
  static async getEligibleTeamsForAllChallenges(): Promise<Record<string, TeamCardReward[]>> {
    return getEligibleTeamsForAllChallenges()
  }

  /** Assign a drawn card from challenge pool to a team with eligibility check. */
  static async assignCardToTeam(cardId: string, teamId: string): Promise<TeamCard> {
    const card = await Card.findByPk(cardId)
    if (!card) throw new Error('Card not found')
    if (!card.challenge) throw new Error('Card is not from a challenge pool')
    if (card.team) throw new Error('Card already assigned to a team')

    // Check if team is eligible for this challenge's cards
    const eligibleTeams = await getEligibleTeamsForChallenge(card.challenge)
    const eligible = eligibleTeams.find((t) => t.teamId === teamId)
    if (!eligible || eligible.cardCount === 0) {
      throw new Error(`Team is not eligible for cards from this challenge`)
    }

    // Check how many cards this team has already received from this challenge
    const assignedFromChallenge = await Card.count({
      where: { challenge: card.challenge, team: teamId },
    })
    if (assignedFromChallenge >= eligible.cardCount) {
      throw new Error(`Team has already received all ${eligible.cardCount} cards for this challenge`)
    }

    const result = await assignCardToTeamFn(cardId, teamId)
    dbEvents.emit(DB_EVENTS.CARDS_CHANGED)
    dbEvents.emit(DB_EVENTS.SCOREBOARD_CHANGED)
    return result
  }

  /** Replace a team's card with a new drawn card. */
  static async replaceTeamCard(teamId: string, oldTeamCardId: string, newCardId: string): Promise<TeamCard> {
    const result = await replaceTeamCardFn(teamId, oldTeamCardId, newCardId)
    dbEvents.emit(DB_EVENTS.CARDS_CHANGED)
    dbEvents.emit(DB_EVENTS.SCOREBOARD_CHANGED)
    return result
  }

  /** Get a team card by ID. */
  static async getTeamCardById(teamCardId: string): Promise<TeamCard | null> {
    return getTeamCardById(teamCardId)
  }
}