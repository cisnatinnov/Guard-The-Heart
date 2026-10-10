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
  nextTeamIndex: number
  attemptedTeams: string[]
  questionResolved: boolean
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

/** Applies an answer given by the team selected to receive a passed question. */
export function applyPassedAnswer(run: ChallengeRun, fromTeam: string, toTeam: string, correct: boolean): ChallengeRun {
  if (run.questionResolved || run.questionIndex >= run.questionCount) throw new Error('This question is already resolved')
  if (fromTeam === toTeam) throw new Error('Choose a different team to receive the question')
  if (run.attemptedTeams.includes(toTeam)) throw new Error('Choose a team that has not tried this question')
  const from = runFor(run, fromTeam)
  const to = runFor(run, toTeam)
  if (!from || !to) throw new Error('Both teams must be following this challenge')
  if (teamForQuestion(run)?.team !== fromTeam) throw new Error("It is not that team's turn to pass")
  const fromPoints = correct ? -10 : -5
  const toPoints = correct ? 5 : -5
  const updated = run.runs.map((entry) => {
    if (entry.team === fromTeam) return { ...entry, score: entry.score + fromPoints, answered: entry.answered + 1, state: 'eliminated' as TeamRunState }
    if (entry.team === toTeam) return { ...entry, score: entry.score + toPoints, answered: entry.answered + 1, correct: entry.correct + (correct ? 1 : 0), state: correct ? 'following' as TeamRunState : 'eliminated' as TeamRunState }
    return entry
  })
  const attemptedTeams = Array.from(new Set([...run.attemptedTeams, fromTeam, toTeam]))
  const nextTeamIndex = (run.runs.findIndex((entry) => entry.team === toTeam) + 1) % run.runs.length
  return {
    ...run,
    runs: updated,
    attemptedTeams,
    nextTeamIndex,
    questionResolved: correct || attemptedTeams.length >= run.runs.length,
  }
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
    nextTeamIndex: 0,
    attemptedTeams: [],
    questionResolved: false,
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

/** The next eligible team gets a chance to answer the current question. */
export function teamForQuestion(run: ChallengeRun): TeamRun | undefined {
  if (run.questionResolved) return undefined
  for (let offset = 0; offset < run.runs.length; offset += 1) {
    const index = (run.nextTeamIndex + offset) % run.runs.length
    const entry = run.runs[index]
    if (!run.attemptedTeams.includes(entry.team)) return entry
  }
  return undefined
}

export function eliminatedTeams(run: ChallengeRun): TeamRun[] {
  return run.runs.filter((entry) => entry.state === 'eliminated')
}

export interface QuestionOutcome {
  /** Points the team earned, already clamped at zero. */
  points: number
  /** False lets the next team try the same question. */
  correct: boolean
  /** True when this attempt was submitted because its timer expired. */
  timedOut?: boolean
}

/**
 * Applies one attempt. Wrong answers hand the same question to the next team;
 * a correct answer or exhausted team list resolves the question. A timeout is
 * treated like an incorrect answer, so the next eligible team can try it.
 */
export function applyAnswer(run: ChallengeRun, team: string, outcome: QuestionOutcome): AnswerOutcome {
  const current = runFor(run, team)
  if (!current) throw new Error('That team is not following this challenge')
  if (run.questionIndex >= run.questionCount) throw new Error('This challenge run is complete')
  if (teamForQuestion(run)?.team !== team) throw new Error("It is not that team's turn to answer")

  const attemptedTeams = [...run.attemptedTeams, team]
  const nextTeamIndex = (run.runs.findIndex((entry) => entry.team === team) + 1) % run.runs.length
  const questionResolved = outcome.correct || attemptedTeams.length >= run.runs.length
  const next: TeamRun = {
    ...current,
    score: current.score + outcome.points,
    answered: current.answered + 1,
    correct: current.correct + (outcome.correct ? 1 : 0),
    state: outcome.correct ? 'following' : 'eliminated',
  }
  return {
    run: {
      ...replaceRun(run, next),
      attemptedTeams,
      nextTeamIndex,
      questionResolved,
    },
    team: next,
    gained: outcome.points,
    eliminated: !outcome.correct,
    skipped: false,
  }
}

/** Opens the next question after a correct answer or exhausted attempts. */
export function beginNextQuestion(run: ChallengeRun): ChallengeRun {
  if (isRunComplete(run)) return run
  if (!run.questionResolved) {
    throw new Error('The question must be answered correctly or exhaust all teams first')
  }
  const runs = run.runs.map((entry) => ({ ...entry, state: 'following' as TeamRunState }))
  return {
    ...run,
    questionIndex: run.questionIndex + 1,
    attemptedTeams: [],
    questionResolved: false,
    runs,
  }
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
  return (
    run.questionIndex >= run.questionCount ||
    (run.questionIndex === run.questionCount - 1 && run.questionResolved)
  )
}

export function runMaximumScore(run: ChallengeRun): number {
  return run.questionCount * run.pointsPerQuestion
}

/** True when every team that answered the current question got it wrong. */
export function questionWasClean(run: ChallengeRun): boolean {
  const active = run.runs.filter((entry) => entry.state === 'eliminated')
  return active.length > 0
}
