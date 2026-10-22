import { Team } from '../models'
import { ChallengePointController } from './ChallengePointController'
import type { ChallengePointEntry } from './ChallengePointController'
import { ChallengeController } from './ChallengeController'
import type { ChallengeGameId } from '../services/games'
import { challengeQuestionsFor, gradeQuestion, type ChallengeQuestion } from '../services/games/challengeQuestions'
import {
  enableRunMatching,
  flipRunCard,
  advanceMatchingTurn,
  advanceMatchingTransition,
  chooseMatchingAnswerTeam,
  applyAnswer,
  applyPassedAnswer,
  beginNextQuestion,
  isRunComplete,
  runFor,
  startChallengeRun,
  teamForQuestion,
  type ChallengeRun,
} from '../services/games/teamRun'
import { MATCHING_PREVIEW_SECONDS } from '../services/games/wordAssembly'
import { MAX_ENTRIES_PER_CHALLENGE } from '../services/rankRules'

const MAX_CHALLENGE_POINT = 999

export interface TeamAnswerResult {
  teamId: string
  teamName: string
  points: number
  correct: boolean
  /** Jaws of Risk reports the bite separately from a merely wrong answer. */
  bitten: boolean
  timedOut: boolean
  eliminated: boolean
  /** True when the team was already out and the answer was not graded. */
  skipped: boolean
  /** The score persisted to the challenge scoreboard for this team. */
  recordedScore: number | null
  error: string | null
}

/**
 * A team run adds challenge point to `challenge_point` as the challenge is played.
 * It reuses ChallengePointController so ranks, guard power, bonus cards and
 * the overall totals stay consistent no matter how a challenge point was produced.
 */
export class ChallengeRunController {
  /** Builds a run for the teams chosen to follow the challenge. */
  static start(input: {
    gameId: ChallengeGameId
    challengeId: string
    teamIds: string[]
  }): ChallengeRun {
    const questionSet = challengeQuestionsFor(input.gameId)
    if (questionSet.questions.length === 0) {
      throw new Error('This challenge cannot be answered question by question')
    }
    const run = startChallengeRun({
      challenge: input.challengeId,
      teams: input.teamIds,
      questionCount: questionSet.questions.length,
      pointsPerQuestion: questionSet.pointsPerQuestion,
    })
    return input.gameId === 'word-assembly' ? enableRunMatching(run)
      : questionSet.secondsPerQuestion ? { ...run, secondsPerTurn: questionSet.secondsPerQuestion,
        turnDeadline: Date.now() + questionSet.secondsPerQuestion * 1000 } : run
  }

  static questionsFor(gameId: ChallengeGameId): ChallengeQuestion[] {
    return challengeQuestionsFor(gameId).questions
  }

  static currentQuestion(gameId: ChallengeGameId, run: ChallengeRun): ChallengeQuestion {
    const questions = challengeQuestionsFor(gameId).questions
    return questions[run.questionIndex] ?? questions[0]
  }

  /** Opens the next question after a correct answer or exhausted attempts. */
  static nextQuestion(run: ChallengeRun): ChallengeRun {
    return beginNextQuestion(run)
  }

  static complete(run: ChallengeRun): boolean {
    return isRunComplete(run)
  }

  static chooseAnswerTeam(run: ChallengeRun, teamId: string): ChallengeRun {
    return chooseMatchingAnswerTeam(run, teamId)
  }

  static async finishMatchingTurn(run: ChallengeRun, timedOut = false): Promise<ChallengeRun> {
    const updated = advanceMatchingTurn(run, timedOut)
    await ChallengeRunController.recordChangedScores(run, updated)
    return updated
  }

  static startMatchingOnly(challengeId: string, teamIds: string[]): ChallengeRun {
    return { ...enableRunMatching(startChallengeRun({ challenge: challengeId, teams: teamIds, questionCount: 10, pointsPerQuestion: 0 })), matchingOnly: true, manualTeamSelection: true, turnDeadline: undefined, matchingPreviewDeadline: Date.now() + MATCHING_PREVIEW_SECONDS * 1000 }
  }

  static async flipMatchingOnly(run: ChallengeRun, cardId: string): Promise<ChallengeRun> {
    return flipRunCard(run, cardId)
  }

  static finishMatchingTransition(run: ChallengeRun): ChallengeRun {
    return advanceMatchingTransition(run)
  }

  private static async recordChangedScores(previous: ChallengeRun, next: ChallengeRun): Promise<void> {
    for (const entry of next.runs) {
      if (entry.score !== runFor(previous, entry.team)?.score) {
        await ChallengeRunController.recordScore(next.challenge, entry.team, entry.score)
      }
    }
  }

  /**
   * Grades the current team's attempt and persists its running total. A wrong
   * answer passes the same question to the next team.
   */
  static async answer(input: {
    gameId: ChallengeGameId
    run: ChallengeRun
    teamId: string
    answer: string
    timedOut?: boolean
  }): Promise<{ run: ChallengeRun; result: TeamAnswerResult }> {
    const team = await ChallengeRunController.teamName(input.teamId)
    const question = ChallengeRunController.currentQuestion(input.gameId, input.run)
    const graded = gradeQuestion(question, input.timedOut ? '' : input.answer)
    const applied = applyAnswer(input.run, input.teamId, {
      points: graded.correct ? 10 : -10,
      correct: graded.correct,
      timedOut: input.timedOut,
    })

    if (applied.skipped) {
      return {
        run: applied.run,
        result: {
          teamId: input.teamId,
          teamName: team,
          points: 0,
          correct: false,
          bitten: false,
          timedOut: false,
          eliminated: true,
          skipped: true,
          recordedScore: applied.team.score,
          error: null,
        },
      }
    }

    let recordedScore: number | null = null
    let error: string | null = null
    try {
      recordedScore = await ChallengeRunController.recordScore(
        input.run.challenge,
        input.teamId,
        applied.team.score
      )
      // A given question can also change the giver's score.
      for (const entry of applied.run.runs) {
        if (entry.team !== input.teamId && entry.score !== runFor(input.run, entry.team)?.score) {
          await ChallengeRunController.recordScore(input.run.challenge, entry.team, entry.score)
        }
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    }

    return {
      run: applied.run,
      result: {
        teamId: input.teamId,
        teamName: team,
        points: applied.gained,
        correct: graded.correct,
        bitten: graded.bitten,
        timedOut: input.timedOut === true,
        eliminated: applied.team.state === 'eliminated',
        skipped: false,
        recordedScore: recordedScore,
        error,
      },
    }
  }

  /** Grades a question thrown by the current team to a selected opponent. */
  static async pass(input: { gameId: ChallengeGameId; run: ChallengeRun; fromTeamId: string; toTeamId: string; answer: string }): Promise<ChallengeRun> {
    const question = ChallengeRunController.currentQuestion(input.gameId, input.run)
    const correct = gradeQuestion(question, input.answer).correct
    const run = applyPassedAnswer(input.run, input.fromTeamId, input.toTeamId, correct)
    for (const entry of run.runs) {
      const previous = input.run.runs.find((item) => item.team === entry.team)
      if (entry.score !== previous?.score) await ChallengeRunController.recordScore(run.challenge, entry.team, entry.score)
    }
    return run
  }

  /**
     * Stores the raw game score and corrects it afterwards, so a team
   * that follows the challenge always has a row on the scoreboard.
   */
  static async recordScore(challengeId: string, teamId: string, challengePoint: number): Promise<number> {
    const clamped = Math.max(-MAX_CHALLENGE_POINT, Math.min(MAX_CHALLENGE_POINT, Math.trunc(challengePoint)))
    const entries = await ChallengePointController.listByChallenge(challengeId)
    const entry = entries.find((row) => row.team === teamId)

    if (!entry) {
      const created = await ChallengePointController.create({
        challenge: challengeId,
        team: teamId,
        score: clamped,
      })
      return created.score
    }
    if (entry.score === clamped) return entry.score
    const updated = await ChallengePointController.update(entry.id, { score: clamped })
    return updated?.score ?? entry.score
  }

  /** Puts the run on the scoreboard for every team, including those still on zero. */
  static async syncAll(run: ChallengeRun): Promise<void> {
    if (run.matchingOnly) return
    const challenge = await ChallengeController.getById(run.challenge)
    if (!challenge) throw new Error('Related challenge was not found')
    if (run.runs.length > MAX_ENTRIES_PER_CHALLENGE) {
      throw new Error(
        `A challenge can hold at most ${MAX_ENTRIES_PER_CHALLENGE} teams (rank 1-${MAX_ENTRIES_PER_CHALLENGE})`
      )
    }
    for (const entry of run.runs) {
      await ChallengeRunController.recordScore(run.challenge, entry.team, entry.score)
    }
  }

  static runTeam(run: ChallengeRun, teamId: string) {
    return runFor(run, teamId)
  }

  static teamForQuestion(run: ChallengeRun) {
    return teamForQuestion(run)
  }

  static scoreboardEntries(run: ChallengeRun): Promise<ChallengePointEntry[]> {
    return ChallengePointController.listByChallenge(run.challenge)
  }

  private static async teamName(teamId: string): Promise<string> {
    const team = await Team.findByPk(teamId)
    return team?.name ?? 'Team'
  }
}
