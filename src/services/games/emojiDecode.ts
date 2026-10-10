import raw from '../../data/emoji-decode.json'
import { getGameQuestions } from '../gameQuestionCache'

export interface EmojiDecodeQuestion {
  id: string
  emojis: string[]
  answer: string
  hint: string
}

export function getEmojiDecodeQuestions(): EmojiDecodeQuestion[] {
  const fromDatabase = getGameQuestions('image-decode')
  if (fromDatabase.length > 0) {
    return fromDatabase.map((question) => ({
      id: question.id,
      emojis: [question.prompt],
      answer: question.answer,
      hint: question.hint,
    }))
  }
  return raw.questions.map((question) => ({
    id: question.id,
    emojis: question.emojis,
    answer: question.answer,
    hint: question.hint,
  }))
}

/** Static fallback retained for pure game-service callers before DB startup. */
export const EMOJI_DECODE_QUESTIONS: EmojiDecodeQuestion[] = raw.questions.map((question) => ({
  id: question.id,
  emojis: question.emojis,
  answer: question.answer,
  hint: question.hint,
}))

export const EMOJI_DECODE_QUESTION_COUNT = EMOJI_DECODE_QUESTIONS.length
export const EMOJI_DECODE_EMOJIS_PER_QUESTION = raw.emojiPerQuestion
export const EMOJI_DECODE_SECONDS_PER_QUESTION = 30
export const EMOJI_DECODE_POINTS_PER_ANSWER = 10
export const EMOJI_DECODE_DECK_PATH = '/ui/Image_Decode.pptx'
export const EMOJI_DECODE_CHALLENGE_ID = '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'

export function normalizeEmojiAnswer(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function checkEmojiAnswer(question: EmojiDecodeQuestion, guess: string): boolean {
  const normalizedGuess = normalizeEmojiAnswer(guess)
  if (normalizedGuess.length === 0) return false
  return normalizedGuess === normalizeEmojiAnswer(question.answer)
}

export interface EmojiDecodeAttempt {
  questionId: string
  guess: string
  correct: boolean
}

export function scoreEmojiDecode(attempts: EmojiDecodeAttempt[]): {
  solved: number
  attempted: number
  score: number
  maximum: number
} {
  const solved = attempts.filter((attempt) => attempt.correct).length
  return {
    solved,
    attempted: attempts.length,
    score: solved * EMOJI_DECODE_POINTS_PER_ANSWER,
    maximum: getEmojiDecodeQuestions().length * EMOJI_DECODE_POINTS_PER_ANSWER,
  }
}
