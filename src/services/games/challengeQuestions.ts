import {
  EMOJI_DECODE_POINTS_PER_ANSWER,
  EMOJI_DECODE_QUESTIONS,
  EMOJI_DECODE_SECONDS_PER_QUESTION,
  checkEmojiAnswer,
} from './emojiDecode'
import {
  JAWS_FALSE_FLAG_PENALTY,
  JAWS_HIT_POINTS,
  JAWS_LOOSE_COUNT,
  JAWS_TOOTH_COUNT,
  type JawsBoard,
} from './jawsOfRisk'
import {
  WORD_ASSEMBLY_MATCH_POINTS,
  WORD_ASSEMBLY_QUESTIONS,
  WORD_ASSEMBLY_SECONDS_PER_QUESTION,
} from './wordAssembly'
import type { ChallengeGameId } from './index'

/**
 * A single question a team can answer, with the rule that grades it.
 *
 * `grade` returns the points the team earned. A question that eliminates the
 * team returns `0`; whether that elimination is temporary is decided by
 * `eliminates`, which Jaws of Risk uses to bite instead of merely out-scoring.
 */
export interface ChallengeQuestion {
  id: string
  /** 1-based position, for display. */
  number: number
  prompt: string
  hint: string
  grade: (answer: string) => number
  /** When true a wrong answer removes the team until the next question. */
  eliminates: boolean
}

export interface ChallengeQuestionSet {
  questions: ChallengeQuestion[]
  pointsPerQuestion: number
  secondsPerQuestion?: number
}

/**
 * A question is graded against an exact answer, so answers are compared the way
 * the Image Decode game already does it: case and punctuation insensitive.
 */
function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function exactQuestion(
  id: string,
  number: number,
  prompt: string,
  hint: string,
  answer: string,
  points: number,
  eliminates = true
): ChallengeQuestion {
  const target = normalize(answer)
  return {
    id,
    number,
    prompt,
    hint,
    eliminates,
    grade: (value) => (normalize(value) === target && target.length > 0 ? points : 0),
  }
}

function emojiDecodeQuestions(): ChallengeQuestion[] {
  return EMOJI_DECODE_QUESTIONS.map((question, index) => ({
    id: question.id,
    number: index + 1,
    prompt: question.emojis.join(' '),
    hint: question.hint,
    eliminates: true,
    grade: (value) => (checkEmojiAnswer(question, value) ? EMOJI_DECODE_POINTS_PER_ANSWER : 0),
  }))
}

/** Team runs identify the picture represented by each matching-card pair. */
function wordAssemblyQuestions(): ChallengeQuestion[] {
  return WORD_ASSEMBLY_QUESTIONS.map((question, index) =>
    exactQuestion(
      question.id,
      index + 1,
      question.prompt,
      'Name the picture shown on the matching cards.',
      question.answer,
      WORD_ASSEMBLY_MATCH_POINTS
    )
  )
}

/**
 * Jaws of Risk is the one game where a wrong answer bites. Every tooth is a
 * question: naming a loose tooth scores, and naming a firm one is the bite that
 * sends the team out until the next tooth.
 */
function jawsQuestions(): ChallengeQuestion[] {
  const questions: ChallengeQuestion[] = []
  for (let number = 1; number <= JAWS_TOOTH_COUNT; number += 1) {
    questions.push({
      id: `jaw-tooth-${number}`,
      number,
      prompt: `Is tooth ${number} loose or firm?`,
      hint: `Type loose or firm. ${JAWS_LOOSE_COUNT} of ${JAWS_TOOTH_COUNT} teeth are loose.`,
      eliminates: true,
      grade: (value) => {
        const guess = normalize(value)
        if (guess !== 'loose' && guess !== 'firm') return 0
        return guess === 'loose' ? JAWS_HIT_POINTS : -JAWS_FALSE_FLAG_PENALTY
      },
    })
  }
  return questions
}

/**
 * Grades one answer. Scores are clamped at zero, matching the solo Jaws board,
 * while a negative grade is still reported so the view can say the team was
 * bitten rather than merely out-scored.
 */
export function gradeQuestion(
  question: ChallengeQuestion,
  answer: string
): { points: number; correct: boolean; bitten: boolean; graded: boolean } {
  const raw = question.grade(answer)
  return {
    points: Math.max(0, raw),
    correct: raw > 0,
    bitten: raw < 0,
    graded: raw !== 0,
  }
}

const BUILDERS: Record<ChallengeGameId, () => ChallengeQuestionSet> = {
  'emoji-decode': () => ({
    questions: emojiDecodeQuestions(),
    pointsPerQuestion: EMOJI_DECODE_POINTS_PER_ANSWER,
    secondsPerQuestion: EMOJI_DECODE_SECONDS_PER_QUESTION,
  }),
  'word-assembly': () => {
    const questions = wordAssemblyQuestions()
    return {
      questions,
      pointsPerQuestion: WORD_ASSEMBLY_MATCH_POINTS,
      secondsPerQuestion: WORD_ASSEMBLY_SECONDS_PER_QUESTION,
    }
  },
  'jaws-of-risk': () => {
    const questions = jawsQuestions()
    return { questions, pointsPerQuestion: JAWS_HIT_POINTS }
  },
}

/** True when a challenge can be answered question by question by teams. */
export function supportsTeamQuestions(gameId: ChallengeGameId): boolean {
  return BUILDERS[gameId]().questions.length > 0
}

export function challengeQuestionsFor(gameId: ChallengeGameId): ChallengeQuestionSet {
  return BUILDERS[gameId]()
}

/** The board a Jaws team run is graded against, for the host to reveal. */
export function jawsLooseNumbers(board: JawsBoard): number[] {
  return board.looseIds.map((id) => Number(id.replace('tooth-', '')))
}