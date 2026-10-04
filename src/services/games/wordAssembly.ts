import type { RandomSource } from './random'

export interface WordAssemblyQuestion {
  id: string
  prompt: string
  answer: string
}

export const WORD_ASSEMBLY_SECONDS_PER_QUESTION = 15
export const WORD_ASSEMBLY_QUESTIONS: WordAssemblyQuestion[] = [
  { id: 'word-1', prompt: 'Protected from danger', answer: 'SAFE' },
  { id: 'word-2', prompt: 'The chance of loss', answer: 'RISK' },
  { id: 'word-3', prompt: 'The centre that is guarded', answer: 'CORE' },
  { id: 'word-4', prompt: 'A piece of evidence', answer: 'CLUE' },
  { id: 'word-5', prompt: 'What secures a door', answer: 'LOCK' },
]

export const WORD_ASSEMBLY_SLOTS_PER_QUESTION = 4
export const WORD_ASSEMBLY_CARD_COUNT = WORD_ASSEMBLY_QUESTIONS.length * WORD_ASSEMBLY_SLOTS_PER_QUESTION
export const WORD_ASSEMBLY_MATCH_POINTS = 10
export const WORD_ASSEMBLY_CHALLENGE_ID = '7c4a2f96-08db-4e15-b3c7-1d9e5a80f463'
export const WORD_ASSEMBLY_MISMATCH_PENALTY = 5

export interface WordAssemblyCard {
  id: string
  letter: string
  questionId: string
  slot: number
}

export interface WordAssemblyState {
  board: WordAssemblyCard[]
  revealed: string[]
  placed: Record<string, string[]>
  mismatches: number
}

export function createWordAssemblyDeck(random: RandomSource = Math.random): WordAssemblyCard[] {
  const deck = WORD_ASSEMBLY_QUESTIONS.flatMap((question) =>
    Array.from(question.answer).map((letter, slot) => ({
      id: `${question.id}-slot-${slot}`,
      letter,
      questionId: question.id,
      slot,
    }))
  )
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const swap = deck[i]
    deck[i] = deck[j]
    deck[j] = swap
  }
  return deck
}

export function createWordAssemblyState(random: RandomSource = Math.random): WordAssemblyState {
  return { board: createWordAssemblyDeck(random), revealed: [], placed: {}, mismatches: 0 }
}

export function expectedLetter(question: WordAssemblyQuestion, slot: number): string {
  return question.answer[slot] ?? ''
}

export function placedLetters(state: WordAssemblyState, question: WordAssemblyQuestion): string[] {
  return (state.placed[question.id] ?? []).filter((letter): letter is string => Boolean(letter))
}

export function revealWordAssemblyCard(state: WordAssemblyState, cardId: string): WordAssemblyState {
  if (!state.board.some((card) => card.id === cardId) || state.revealed.includes(cardId)) return state
  return { ...state, revealed: [...state.revealed, cardId] }
}

export type WordAssemblyPlacement = 'matched' | 'mismatch' | 'unknown-card'

export interface WordAssemblyPlacementResult {
  state: WordAssemblyState
  placement: WordAssemblyPlacement
}

/**
 * Placing a card on a slot only works when the card belongs to that question and
 * slot. A wrong slot counts as a mismatch and hides the card again.
 */
export function placeWordAssemblyCard(
  state: WordAssemblyState,
  cardId: string,
  questionId: string,
  slot: number
): WordAssemblyPlacementResult {
  const card = state.board.find((entry) => entry.id === cardId)
  if (!card) return { state, placement: 'unknown-card' }

  if (card.questionId !== questionId || card.slot !== slot) {
    return {
      state: {
        ...state,
        revealed: state.revealed.filter((id) => id !== cardId),
        mismatches: state.mismatches + 1,
      },
      placement: 'mismatch',
    }
  }

  const question = WORD_ASSEMBLY_QUESTIONS.find((entry) => entry.id === questionId)
  if (!question || slot < 0 || slot >= WORD_ASSEMBLY_SLOTS_PER_QUESTION) {
    return { state, placement: 'unknown-card' }
  }

  const letters = [...(state.placed[questionId] ?? [])]
  letters[slot] = card.letter

  return {
    state: {
      board: state.board.filter((entry) => entry.id !== cardId),
      revealed: state.revealed.filter((id) => id !== cardId),
      placed: { ...state.placed, [questionId]: letters },
      mismatches: state.mismatches,
    },
    placement: 'matched',
  }
}

export function isWordAssemblyQuestionSolved(
  state: WordAssemblyState,
  question: WordAssemblyQuestion
): boolean {
  return placedLetters(state, question).join('') === question.answer
}

export interface WordAssemblyScore {
  matched: number
  mismatches: number
  questionsSolved: number
  score: number
  maximum: number
}

export function scoreWordAssembly(state: WordAssemblyState): WordAssemblyScore {
  const matched = Object.values(state.placed).reduce((total, letters) => total + letters.length, 0)
  const questionsSolved = WORD_ASSEMBLY_QUESTIONS.filter((question) =>
    isWordAssemblyQuestionSolved(state, question)
  ).length
  return {
    matched,
    mismatches: state.mismatches,
    questionsSolved,
    score: matched * WORD_ASSEMBLY_MATCH_POINTS - state.mismatches * WORD_ASSEMBLY_MISMATCH_PENALTY,
    maximum: WORD_ASSEMBLY_CARD_COUNT * WORD_ASSEMBLY_MATCH_POINTS,
  }
}