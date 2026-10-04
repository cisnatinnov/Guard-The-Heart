import { MAX_ENTRIES_PER_CHALLENGE } from '../rankRules'

/**
 * A team that is following a challenge. `eliminated` means the team answered the
 * current question wrong; it is out for the rest of that question and becomes
 * eligible again when the next question begins.
 */
export type TeamRunState = 'following' | 'eliminated'

export interface TeamRun {
  team: string
  score: number
  state: TeamRunState
  /** Questions the team has already answered, correct or not. */
  answered: number
  /** Questions the team answered correctly. */
  correct: number
}

export interface ChallengeRun {
  challenge: string
  questionIndex: number
  questionCount: number
  pointsPerQuestion: number
  runs: TeamRun[]
}

export interface AnswerOutcome {
  run: ChallengeRun
  team: TeamRun
  gained: number
  eliminated: boolean
  /** True when the team was out before this answer and could not be graded. */
  skipped: boolean
}

export function startChallengeRun(input: {
  challenge: string
  teams: string[]
  questionCount: number
  pointsPerQuestion: number
}): ChallengeRun {
  const unique = Array.from(new Set(input.teams.map((team) => team.trim()).filter(Boolean)))
  if (unique.length === 0) throw new Error('Choose at least one team to follow the challenge')
  if (unique.length > MAX_ENTRIES_PER_CHALLENGE) {
    throw new Error(
      `A challenge can hold at most ${MAX_ENTRIES_PER_CHALLENGE} teams (rank 1-${MAX_ENTRIES_PER_CHALLENGE})`
    )
  }
  if (input.questionCount < 1) throw new Error('A challenge needs at least one question')
  if (input.pointsPerQuestion < 0) throw new Error('Points cannot be negative')

  return {
    challenge: input.challenge,
    questionIndex: 0,
    questionCount: input.questionCount,
    pointsPerQuestion: input.pointsPerQuestion,
    runs: unique.map((team) => ({
      team,
      score: 0,
      state: 'following' as TeamRunState,
      answered: 0,
      correct: 0,
    })),
  }
}

function replaceRun(run: ChallengeRun, team: TeamRun): ChallengeRun {
  return { ...run, runs: run.runs.map((entry) => (entry.team === team.team ? team : entry)) }
}

export function runFor(run: ChallengeRun, team: string): TeamRun | undefined {
  return run.runs.find((entry) => entry.team === team)
}

/** Teams that may answer the current question. */
export function activeTeams(run: ChallengeRun): TeamRun[] {
  return run.runs.filter((entry) => entry.state === 'following')
}

export function eliminatedTeams(run: ChallengeRun): TeamRun[] {
  return run.runs.filter((entry) => entry.state === 'eliminated')
}

export interface QuestionOutcome {
  /** Points the team earned, already clamped at zero. */
  points: number
  /** False eliminates the team until the next question begins. */
  correct: boolean
}

/**
 * Applies a graded answer. An eliminated team is skipped rather than graded,
 * which is what makes elimination last exactly one question.
 */
export function applyAnswer(run: ChallengeRun, team: string, outcome: QuestionOutcome): AnswerOutcome {
  const current = runFor(run, team)
  if (!current) throw new Error('That team is not following this challenge')
  if (current.state === 'eliminated') {
    return { run, team: current, gained: 0, eliminated: true, skipped: true }
  }
  if (current.answered >= run.questionCount) {
    return { run, team: current, gained: 0, eliminated: false, skipped: true }
  }

  const next: TeamRun = {
    ...current,
    score: current.score + outcome.points,
    answered: current.answered + 1,
    correct: current.correct + (outcome.correct ? 1 : 0),
    state: outcome.correct ? 'following' : 'eliminated',
  }
  return { run: replaceRun(run, next), team: next, gained: outcome.points, eliminated: !outcome.correct, skipped: false }
}

/** Applies one graded answer to several teams against the same question. */
export function applyAnswerForTeams(
  run: ChallengeRun,
  teamIds: string[],
  outcome: QuestionOutcome
): ChallengeRun {
  return teamIds.reduce((current, team) => applyAnswer(current, team, outcome).run, run)
}

/** Opens the next question, which is when every team may follow again. */
export function beginNextQuestion(run: ChallengeRun): ChallengeRun {
  if (run.questionIndex >= run.questionCount - 1) return run
  const runs = run.runs.map((entry) => ({ ...entry, state: 'following' as TeamRunState }))
  return { ...run, questionIndex: run.questionIndex + 1, runs }
}

export function previousQuestion(run: ChallengeRun): ChallengeRun {
  if (run.questionIndex === 0) return run
  const runs = run.runs.map((entry) => ({ ...entry, state: 'following' as TeamRunState }))
  return { ...run, questionIndex: run.questionIndex - 1, runs }
}

/** The question number a team still has to answer before the run is over. */
export function questionsRemaining(run: ChallengeRun, team: string): number {
  const entry = runFor(run, team)
  if (!entry) return 0
  return Math.max(0, run.questionCount - entry.answered)
}

export function isRunComplete(run: ChallengeRun): boolean {
  return run.runs.every((entry) => entry.answered >= run.questionCount)
}

export function runMaximumScore(run: ChallengeRun): number {
  return run.questionCount * run.pointsPerQuestion
}

/** True when every team that answered the current question got it wrong. */
export function questionWasClean(run: ChallengeRun): boolean {
  const active = run.runs.filter((entry) => entry.state === 'eliminated')
  return active.length > 0
}