import { Team } from '../models'
import { ChallengeScoreboardController } from './ChallengeScoreboardController'
import type { ChallengeScoreEntry } from './ChallengeScoreboardController'
import { ChallengeController } from './ChallengeController'
import type { ChallengeGameId } from '../services/games'
import { challengeQuestionsFor, gradeQuestion, type ChallengeQuestion } from '../services/games/challengeQuestions'
import {
  applyAnswer,
  beginNextQuestion,
  isRunComplete,
  runFor,
  startChallengeRun,
  type ChallengeRun,
} from '../services/games/teamRun'
import { MAX_ENTRIES_PER_CHALLENGE } from '../services/rankRules'

const MAX_SCORE = 999

export interface TeamAnswerResult {
  teamId: string
  teamName: string
  points: number
  correct: boolean
  /** Jaws of Risk reports the bite separately from a merely wrong answer. */
  bitten: boolean
  eliminated: boolean
  /** True when the team was already out and the answer was not graded. */
  skipped: boolean
  /** The score persisted to the challenge scoreboard for this team. */
  recordedScore: number | null
  error: string | null
}

/**
 * A team run adds score to `challenge_scoreboard` as the challenge is played.
 * It reuses ChallengeScoreboardController so ranks, guard power, bonus cards and
 * the overall totals stay consistent no matter how a score was produced.
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
    return startChallengeRun({
      challenge: input.challengeId,
      teams: input.teamIds,
      questionCount: questionSet.questions.length,
      pointsPerQuestion: questionSet.pointsPerQuestion,
    })
  }

  static questionsFor(gameId: ChallengeGameId): ChallengeQuestion[] {
    return challengeQuestionsFor(gameId).questions
  }

  static currentQuestion(gameId: ChallengeGameId, run: ChallengeRun): ChallengeQuestion {
    const questions = challengeQuestionsFor(gameId).questions
    return questions[run.questionIndex] ?? questions[0]
  }

  /** Opens the next question, which is when every team may follow again. */
  static nextQuestion(run: ChallengeRun): ChallengeRun {
    return beginNextQuestion(run)
  }

  static complete(run: ChallengeRun): boolean {
    return isRunComplete(run)
  }

  /**
   * Grades one team against the current question and persists its running total.
   * A team that is already out is skipped, so an eliminated team never has an
   * answer written against it for that question.
   */
  static async answer(input: {
    gameId: ChallengeGameId
    run: ChallengeRun
    teamId: string
    answer: string
  }): Promise<{ run: ChallengeRun; result: TeamAnswerResult }> {
    const team = await ChallengeRunController.teamName(input.teamId)
    const question = ChallengeRunController.currentQuestion(input.gameId, input.run)
    const graded = gradeQuestion(question, input.answer)
    const applied = applyAnswer(input.run, input.teamId, {
      points: graded.points,
      correct: graded.correct,
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
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    }

    return {
      run: applied.run,
      result: {
        teamId: input.teamId,
        teamName: team,
        points: graded.points,
        correct: graded.correct,
        bitten: graded.bitten,
        eliminated: applied.team.state === 'eliminated',
        skipped: false,
        recordedScore,
        error,
      },
    }
  }

  /** Grades several teams against the same question in one call. */
  static async answerAll(input: {
    gameId: ChallengeGameId
    run: ChallengeRun
    answers: { teamId: string; answer: string }[]
  }): Promise<{ run: ChallengeRun; results: TeamAnswerResult[] }> {
    let run = input.run
    const results: TeamAnswerResult[] = []
    for (const entry of input.answers) {
      const outcome = await ChallengeRunController.answer({
        gameId: input.gameId,
        run,
        teamId: entry.teamId,
        answer: entry.answer,
      })
      run = outcome.run
      results.push(outcome.result)
    }
    return { run, results }
  }

  /**
   * Creates the entry on the first score and corrects it afterwards, so a team
   * that follows the challenge always has a row on the scoreboard.
   */
  static async recordScore(challengeId: string, teamId: string, score: number): Promise<number> {
    const clamped = Math.max(0, Math.min(MAX_SCORE, Math.trunc(score)))
    const entries = await ChallengeScoreboardController.listByChallenge(challengeId)
    const entry = entries.find((row) => row.team === teamId)

    if (!entry) {
      const created = await ChallengeScoreboardController.create({
        challenge: challengeId,
        team: teamId,
        score: clamped,
      })
      return created.score
    }
    if (entry.score === clamped) return entry.score
    const updated = await ChallengeScoreboardController.update(entry.id, { score: clamped })
    return updated?.score ?? entry.score
  }

  /** Puts the run on the scoreboard for every team, including those still on zero. */
  static async syncAll(run: ChallengeRun): Promise<void> {
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

  static scoreboardEntries(run: ChallengeRun): Promise<ChallengeScoreEntry[]> {
    return ChallengeScoreboardController.listByChallenge(run.challenge)
  }

  private static async teamName(teamId: string): Promise<string> {
    const team = await Team.findByPk(teamId)
    return team?.name ?? 'Team'
  }
}