import { closeUnmatchedWordAssemblyCards, createWordAssemblyState, revealWordAssemblyCard, WORD_ASSEMBLY_SECONDS_PER_MATCH, WORD_ASSEMBLY_SECONDS_PER_QUESTION, MATCHING_CLOSE_SECONDS, type WordAssemblyState } from './wordAssembly'
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
  manualTeamSelection?: boolean
  matchingOnly?: boolean
  /** Initial all-card preview ends at this shared absolute time. */
  matchingPreviewDeadline?: number
  /** Absolute deadline for displaying an unmatched pair; separate from a turn timer. */
  matchingCloseDeadline?: number
  matchingBoard?: WordAssemblyState
  matchingPhase?: 'matching' | 'matched-delay' | 'choice' | 'answer' | 'handoff-delay'
  matchingTurn?: number
  matchedByTeam?: string
  matchingTeamIndex?: number
  passedByTeam?: string
  /** Shared deadline keeps the host and projector timers synchronized. */
  turnDeadline?: number
  secondsPerTurn?: number
  answerAttempts?: number
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
  if (run.matchingBoard) throw new Error('Choose the answering team before submitting its answer')
  if (run.questionResolved || run.questionIndex >= run.questionCount) throw new Error('This question is already resolved')
  if (fromTeam === toTeam) throw new Error('Choose a different team to receive the question')
  if (run.attemptedTeams.includes(toTeam)) throw new Error('Choose a team that has not tried this question')
  const from = runFor(run, fromTeam)
  const to = runFor(run, toTeam)
  if (!from || !to) throw new Error('Both teams must be following this challenge')
  if (teamForQuestion(run)?.team !== fromTeam) throw new Error("It is not that team's turn to pass")
  return scorePassedAnswer(run, fromTeam, toTeam, correct)
}

function scorePassedAnswer(run: ChallengeRun, fromTeam: string, toTeam: string, correct: boolean): ChallengeRun {
  const fromPoints = correct ? -10 : -5
  const toPoints = correct ? 5 : -5
  const updated = run.runs.map((entry) => {
    if (entry.team === fromTeam) return { ...entry, score: entry.score + fromPoints,
      answered: entry.answered + (run.matchingBoard ? 0 : 1),
      state: run.matchingBoard ? entry.state : 'eliminated' as TeamRunState }
    if (entry.team === toTeam) return { ...entry, score: entry.score + toPoints, answered: entry.answered + 1, correct: entry.correct + (correct ? 1 : 0), state: correct ? 'following' as TeamRunState : 'eliminated' as TeamRunState }
    return entry
  })
  // Giving an unlocked matching question is not an answer attempt by the giver.
  const attemptedTeams = Array.from(new Set([...run.attemptedTeams,
    ...(run.matchingBoard ? [] : [fromTeam]), toTeam]))
  const nextTeamIndex = (run.runs.findIndex((entry) => entry.team === toTeam) + 1) % run.runs.length
  const questionResolved = correct || attemptedTeams.length >= run.runs.length
  const delayForNextTeam = !!run.matchingBoard && !correct && !questionResolved
  return {
    ...run,
    runs: updated,
    attemptedTeams,
    nextTeamIndex,
    questionResolved,
    answerAttempts: 0,
    passedByTeam: undefined,
    ...(delayForNextTeam ? { matchingPhase: 'handoff-delay' as const } : {}),
    turnDeadline: delayForNextTeam ? Date.now() + 5000 : run.matchingBoard ? Date.now() + WORD_ASSEMBLY_SECONDS_PER_QUESTION * 1000
      : run.secondsPerTurn ? Date.now() + run.secondsPerTurn * 1000 : undefined,
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
  /** Signed points earned or lost by the team. */
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

  if (run.matchingBoard && !isMatchingQuestionUnlocked(run)) {
    throw new Error('Match a pair first to unlock its question')
  }
  if (run.matchingBoard && run.matchingPhase !== 'answer') {
    throw new Error('Choose who will answer the matched question first')
  }
  const attempts = (run.answerAttempts ?? 0) + 1
  if (run.matchingBoard && !outcome.correct && !outcome.timedOut && attempts < 2) {
    return {
      run: { ...run, answerAttempts: attempts },
      team: current, gained: 0, eliminated: false, skipped: false,
    }
  }
  if (run.passedByTeam) {
    const updated = scorePassedAnswer(run, run.passedByTeam, team, outcome.correct)
    const next = runFor(updated, team)!
    return { run: updated, team: next, gained: next.score - current.score, eliminated: !outcome.correct, skipped: false }
  }
  const attemptedTeams = [...run.attemptedTeams, team]
  const nextTeamIndex = (run.runs.findIndex((entry) => entry.team === team) + 1) % run.runs.length
  const questionResolved = outcome.correct || attemptedTeams.length >= run.runs.length
  const delayForNextTeam = !!run.matchingBoard && !outcome.correct && !questionResolved
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
      answerAttempts: 0,
      nextTeamIndex,
      questionResolved,
      ...(delayForNextTeam ? { matchingPhase: 'handoff-delay' as const } : {}),
      turnDeadline: delayForNextTeam ? Date.now() + 5000 : run.matchingBoard ? Date.now() + WORD_ASSEMBLY_SECONDS_PER_QUESTION * 1000
      : run.secondsPerTurn ? Date.now() + run.secondsPerTurn * 1000 : undefined,
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
    turnDeadline: run.secondsPerTurn ? Date.now() + run.secondsPerTurn * 1000 : undefined,
    answerAttempts: 0,
    attemptedTeams: [],
    questionResolved: false,
    runs,
    ...(run.matchingBoard ? {
      nextTeamIndex: ((run.matchingTeamIndex ?? run.nextTeamIndex) + 1) % run.runs.length,
      matchingBoard: run.matchingBoard.matchedCardIds.length === run.matchingBoard.board.length
        ? createWordAssemblyState(Math.random, Math.min(10, run.questionCount - run.questionIndex - 1))
        : run.matchingBoard,
      matchingPhase: 'matching' as const,
      matchingTurn: (run.matchingTurn ?? 0) + 1,
      matchedByTeam: undefined,
      passedByTeam: undefined,
      turnDeadline: Date.now() + WORD_ASSEMBLY_SECONDS_PER_MATCH * 1000,
    } : {}),
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

/** Matching progress is part of the shared run, including public spectators. */
export function flipRunCard(run: ChallengeRun, cardId: string): ChallengeRun {
  if (run.matchingOnly && Date.now() < (run.matchingPreviewDeadline ?? 0)) return run
  if (!run.matchingBoard || run.questionResolved || isRunComplete(run) ||
      (run.matchingPhase !== undefined && run.matchingPhase !== 'matching') || isMatchingQuestionUnlocked(run) ||
      (!run.matchingOnly && run.turnDeadline !== undefined && Date.now() >= run.turnDeadline)) return run
  const board = revealWordAssemblyCard(run.matchingBoard, cardId)
  if (board === run.matchingBoard) return run
  const matched = board.matchedQuestionIds.length > run.matchingBoard.matchedQuestionIds.length
  if (run.matchingOnly) {
    if (!matched) return { ...run, matchingBoard: board, turnDeadline: undefined,
      matchingCloseDeadline: board.revealed.length === 2 ? Date.now() + MATCHING_CLOSE_SECONDS * 1000 : undefined }
    const team = teamForQuestion(run)
    return {
      ...run, matchingBoard: { ...board, revealed: [] }, questionIndex: board.matchedQuestionIds.length,
      runs: run.runs.map((entry) => entry.team === team?.team
        ? { ...entry, answered: entry.answered + 1, correct: entry.correct + 1 } : entry),
      nextTeamIndex: run.manualTeamSelection ? run.nextTeamIndex : (run.nextTeamIndex + 1) % run.runs.length,
      matchingTurn: (run.matchingTurn ?? 0) + 1,
      turnDeadline: undefined,
      matchingCloseDeadline: undefined,
    }
  }
  return {
    ...run, matchingBoard: board,
    ...(matched ? { matchingPhase: 'matched-delay' as const, matchedByTeam: teamForQuestion(run)?.team, matchingTeamIndex: run.nextTeamIndex, turnDeadline: Date.now() + 5000 } : {}),
  }
}

/** Completes the shared five-second pause after a match or a wrong answer. */
export function advanceMatchingTransition(run: ChallengeRun): ChallengeRun {
  if (!run.matchingBoard || run.turnDeadline === undefined || Date.now() < run.turnDeadline) return run
  if (run.matchingPhase === 'matched-delay') {
    return { ...run, matchingPhase: 'choice', turnDeadline: undefined }
  }
  if (run.matchingPhase === 'handoff-delay') {
    return { ...run, matchingPhase: 'answer', turnDeadline: Date.now() + WORD_ASSEMBLY_SECONDS_PER_QUESTION * 1000 }
  }
  return run
}

export function enableRunMatching(run: ChallengeRun): ChallengeRun {
  return {
    ...run, matchingBoard: createWordAssemblyState(Math.random, Math.min(10, run.questionCount)), answerAttempts: 0,
    matchingPhase: 'matching', matchingTurn: 0,
    turnDeadline: Date.now() + WORD_ASSEMBLY_SECONDS_PER_MATCH * 1000,
  }
}

export function isMatchingQuestionUnlocked(run: ChallengeRun): boolean {
  if (run.matchingOnly) return false
  return run.matchingPhase !== undefined ? ['choice', 'answer', 'handoff-delay'].includes(run.matchingPhase)
    : (run.matchingBoard?.matchedQuestionIds.length ?? 0) > run.questionIndex
}

/** A mismatch or matching timeout hands the board to the next roulette team. */
export function advanceMatchingTurn(run: ChallengeRun, timedOut = false): ChallengeRun {
  if (!run.matchingBoard || isMatchingQuestionUnlocked(run) || isRunComplete(run)) return run
  if (!timedOut && run.matchingBoard.revealed.length !== 2) return run
  if (run.matchingOnly && run.matchingCloseDeadline !== undefined && Date.now() < run.matchingCloseDeadline) return run
  if (timedOut && run.turnDeadline !== undefined && Date.now() < run.turnDeadline) return run
  const team = teamForQuestion(run)
  if (!team) return run
  return {
    ...run,
    matchingBoard: closeUnmatchedWordAssemblyCards(run.matchingBoard),
    matchingCloseDeadline: undefined,
    nextTeamIndex: run.manualTeamSelection ? run.nextTeamIndex : (run.runs.findIndex((entry) => entry.team === team.team) + 1) % run.runs.length,
    matchingTurn: (run.matchingTurn ?? 0) + 1,
    turnDeadline: run.matchingOnly ? undefined : Date.now() + WORD_ASSEMBLY_SECONDS_PER_MATCH * 1000,
  }
}

/** Pick the next matching team directly, independently of the Urutan Main page. */
export function selectMatchingTeam(run: ChallengeRun, teamId: string): ChallengeRun {
  if (run.matchingOnly && Date.now() < (run.matchingPreviewDeadline ?? 0)) return run
  if (!run.matchingOnly || !run.matchingBoard || isRunComplete(run)) throw new Error('Choose a team during an active Flipping Connect run')
  const index = run.runs.findIndex((entry) => entry.team === teamId)
  if (index < 0) throw new Error('Choose a team participating in this run')
  if (run.matchingBoard.revealed.length === 2 && run.matchingCloseDeadline !== undefined && Date.now() < run.matchingCloseDeadline) return run
  return { ...run, manualTeamSelection:true, nextTeamIndex:index,
    matchingBoard:closeUnmatchedWordAssemblyCards(run.matchingBoard),
    matchingCloseDeadline:undefined,
    matchingTurn:(run.matchingTurn ?? 0)+1,
    turnDeadline:undefined }
}

/** The team that found the pair commits to answering or gives it to a recipient. */
export function chooseMatchingAnswerTeam(run: ChallengeRun, teamId: string): ChallengeRun {
  if (run.matchingPhase !== 'choice' || run.questionResolved) throw new Error('Match a pair before choosing who answers')
  const index = run.runs.findIndex((entry) => entry.team === teamId)
  if (index < 0 || run.attemptedTeams.includes(teamId)) throw new Error('Choose an eligible team')
  return {
    ...run, matchingPhase: 'answer', nextTeamIndex: index,
    passedByTeam: teamId !== run.matchedByTeam ? run.matchedByTeam : undefined,
    answerAttempts: 0,
    turnDeadline: Date.now() + WORD_ASSEMBLY_SECONDS_PER_QUESTION * 1000,
  }
}
