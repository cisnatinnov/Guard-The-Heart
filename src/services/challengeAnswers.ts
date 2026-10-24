import type { Transaction } from 'sequelize'
import { Challenge, ChallengeAnswer, ChallengePoint, Team } from '../models'
import { flushDatabase, getSequelize, refreshDatabaseFromStorage, withDatabaseMutation, withDatabaseWriteLock } from '../db/sequelize-provider'
import { DB_EVENTS, dbEvents } from '../hooks/useDbEvents'
import { MAX_ENTRIES_PER_CHALLENGE } from './rankRules'
import { MATCHING_ATTEMPT_SECONDS, MATCHING_PREVIEW_SECONDS } from './games/wordAssembly'
import { recalculateTotalScoreboard, rerankChallenge } from './scoreboardAggregator'

async function changeScore(challenge: string, team: string, delta: number, transaction: Transaction) {
  const entry = await ChallengePoint.findOne({ where: { challenge, team }, transaction })
  const score = (entry?.score ?? 0) + delta
  if (score < -999 || score > 999) throw new Error('Challenge scores must stay between -999 and 999')
  if (entry) await entry.update({ score, raw_score_only: false }, { transaction })
  else {
    if (await ChallengePoint.count({ where: { challenge }, transaction }) >= MAX_ENTRIES_PER_CHALLENGE) throw new Error('A challenge supports at most five teams')
    await ChallengePoint.create({ challenge, team, score, raw_score_only: false, rank: 0, challenge_point: 0, guard_power: 0, card: 0 }, { transaction })
  }
}

async function write<T>(challenge: string, operation: (transaction: Transaction) => Promise<T>): Promise<T> {
  return withDatabaseWriteLock(async () => {
    await refreshDatabaseFromStorage()
    return withDatabaseMutation(async () => {
      const result = await getSequelize().transaction(operation)
      await rerankChallenge(challenge)
      await recalculateTotalScoreboard(challenge)
      await flushDatabase()
      dbEvents.emit(DB_EVENTS.CHALLENGE_POINTS_CHANGED)
      dbEvents.emit(DB_EVENTS.SCOREBOARD_CHANGED)
      return result
    })
  })
}

export async function recordChallengeAnswer(input: { id: string; challenge: string; team: string; correct: boolean; jaw?: boolean; opponent?: string; matching?: boolean }): Promise<ChallengeAnswer> {
  return write(input.challenge, async (transaction) => {
    const existing = await ChallengeAnswer.findByPk(input.id, { transaction })
    if (existing) {
      if (existing.challenge !== input.challenge || existing.team !== input.team || existing.correct !== input.correct) throw new Error('This answer was already recorded')
      return existing
    }
    if (!await Challenge.findByPk(input.challenge, { transaction })) throw new Error('Challenge not found')
    const team = await Team.findByPk(input.team, { transaction })
    if (!team || team.status !== 'active') throw new Error('Choose an active answering team')
    if (input.jaw && await ChallengeAnswer.findOne({ where: { challenge: input.challenge, settled: false }, transaction })) throw new Error('Finish the pending tooth press first')
    const pressing = input.jaw ? input.correct ? input.opponent : input.team : null
    if (input.jaw && input.correct) {
      const opponent = pressing ? await Team.findByPk(pressing, { transaction }) : null
      if (!opponent || opponent.status !== 'active' || pressing === input.team) throw new Error('Choose a different active opponent')
    }
    if (input.matching) await ChallengeAnswer.update({ matching_deadline: null }, { where: { challenge: input.challenge }, transaction })
    await changeScore(input.challenge, input.team, input.correct ? 10 : -10, transaction)
    return ChallengeAnswer.create({ id: input.id, challenge: input.challenge, team: input.team, correct: input.correct, pressing_team: pressing, settled: !input.jaw, bitten: null, press_count: 0, matching_pairs: '[]', matching_deadline: input.matching && input.correct ? Date.now() + (MATCHING_PREVIEW_SECONDS + MATCHING_ATTEMPT_SECONDS) * 1000 : null }, { transaction })
  })
}

export async function settleChallengeTooth(id: string, bitten: boolean, expectedPress = 0): Promise<{ answer: ChallengeAnswer; applied: boolean }> {
  const existing = await ChallengeAnswer.findByPk(id)
  if (!existing) throw new Error('Record an answer before pressing a tooth')
  return write(existing.challenge, async (transaction) => {
    const answer = await ChallengeAnswer.findByPk(id, { transaction })
    if (!answer?.pressing_team) throw new Error('This answer has no tooth press')
    if (answer.settled || answer.press_count !== expectedPress) return { answer, applied: false }
    if (bitten) await changeScore(answer.challenge, answer.pressing_team, -5, transaction)
    return { answer: await answer.update({ press_count: answer.press_count + 1, settled: answer.press_count + 1 >= 2, bitten: answer.bitten || bitten }, { transaction }), applied: true }
  })
}

export function pendingChallengeTooth(challenge: string): Promise<ChallengeAnswer | null> {
  return ChallengeAnswer.findOne({ where: { challenge, settled: false }, order: [['createdAt', 'ASC']] })
}

/** Refresh rank rewards before claiming cards, including legacy score-only rows. */
export async function finalizeChallengeScores(challenge: string): Promise<void> {
  await write(challenge, async (transaction) => {
    await ChallengePoint.update({ raw_score_only: false }, { where: { challenge }, transaction })
  })
}

/** Persist each matched pair once, even after reloads or duplicate host submissions. */
export async function recordMatchingPair(id: string, pair: number): Promise<void> {
  const existing = await ChallengeAnswer.findByPk(id)
  if (!existing) throw new Error('Record a right answer before matching')
  await write(existing.challenge, async (transaction) => {
    const answer = await ChallengeAnswer.findByPk(id, { transaction })
    if (!answer?.correct || !answer.matching_deadline) throw new Error('Record a right answer before matching')
    const pairs = JSON.parse(answer.matching_pairs) as number[]
    if (pairs.includes(pair)) return
    if (!Number.isInteger(pair) || pair < 1 || pair > 10) throw new Error('Invalid matched pair')
    if (Date.now() < Number(answer.matching_deadline) - MATCHING_ATTEMPT_SECONDS * 1000 || Date.now() >= Number(answer.matching_deadline)) throw new Error('The matching attempt is not active')
    await changeScore(answer.challenge, answer.team, 5, transaction)
    await answer.update({ matching_pairs: JSON.stringify([...pairs, pair]) }, { transaction })
  })
}
