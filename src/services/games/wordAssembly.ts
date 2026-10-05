import type { RandomSource } from './random'

export interface WordAssemblyQuestion {
  id: string
  prompt: string
  answer: string
  image: string
}

export const WORD_ASSEMBLY_SECONDS_PER_QUESTION = 15
export const WORD_ASSEMBLY_QUESTIONS: WordAssemblyQuestion[] = [
  {
    id: 'word-1',
    prompt: 'Logo Bank Syariah',
    answer: 'Syariah',
    image: '/match-card/Syariah.png',
  },
  {
    id: 'word-2',
    prompt: 'Bankir',
    answer: 'Bankir',
    image: '/match-card/Bankir.png',
  },
  {
    id: 'word-3',
    prompt: 'Tembok keamanan komputer',
    answer: 'Firewall',
    image: '/match-card/Firewall.png',
  },
  {
    id: 'word-4',
    prompt: 'Secure account',
    answer: 'Secure',
    image: '/match-card/Secure.png',
  },
  {
    id: 'word-5',
    prompt: 'Fraud',
    answer: 'Fraud',
    image: '/match-card/Fraud.png',
  },
  {
    id: 'word-6',
    prompt: 'Kartu',
    answer: 'Card',
    image: '/match-card/Card.png',
  },
  {
    id: 'word-7',
    prompt: 'Hukum',
    answer: 'Law',
    image: '/match-card/Law.png',
  },
  {
    id: 'word-8',
    prompt: 'Laporan',
    answer: 'Laporan',
    image: '/match-card/Laporan.png',
  },
  {
    id: 'word-9',
    prompt: 'Phishing',
    answer: 'Phishing',
    image: '/match-card/Phising.png',
  },
  {
    id: 'word-10',
    prompt: 'Password',
    answer: 'Password',
    image: '/match-card/Password.png',
  },
]

export const WORD_ASSEMBLY_CARDS_PER_QUESTION = 2
export const WORD_ASSEMBLY_CARD_COUNT =
  WORD_ASSEMBLY_QUESTIONS.length * WORD_ASSEMBLY_CARDS_PER_QUESTION
export const WORD_ASSEMBLY_MATCH_POINTS = 10
export const WORD_ASSEMBLY_CHALLENGE_ID = '7c4a2f96-08db-4e15-b3c7-1d9e5a80f463'
export const WORD_ASSEMBLY_MISMATCH_PENALTY = 5

export interface WordAssemblyCard {
  id: string
  questionId: string
  image: string
}

export interface WordAssemblyState {
  board: WordAssemblyCard[]
  revealed: string[]
  matchedCardIds: string[]
  matchedQuestionIds: string[]
  mismatches: number
}

export function createWordAssemblyDeck(random: RandomSource = Math.random): WordAssemblyCard[] {
  const deck = WORD_ASSEMBLY_QUESTIONS.flatMap((question) =>
    Array.from({ length: WORD_ASSEMBLY_CARDS_PER_QUESTION }, (_, copy) => ({
      id: `${question.id}-card-${copy + 1}`,
      questionId: question.id,
      image: question.image,
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
  return {
    board: createWordAssemblyDeck(random),
    revealed: [],
    matchedCardIds: [],
    matchedQuestionIds: [],
    mismatches: 0,
  }
}

export function revealWordAssemblyCard(state: WordAssemblyState, cardId: string): WordAssemblyState {
  const card = state.board.find((entry) => entry.id === cardId)
  if (
    !card ||
    state.revealed.length >= 2 ||
    state.revealed.includes(cardId) ||
    state.matchedCardIds.includes(cardId)
  ) {
    return state
  }

  const revealed = [...state.revealed, cardId]
  if (revealed.length < 2) return { ...state, revealed }

  const [first, second] = revealed.map((id) => state.board.find((entry) => entry.id === id)!)
  if (first.questionId !== second.questionId) {
    return { ...state, revealed, mismatches: state.mismatches + 1 }
  }

  return {
    ...state,
    revealed: [],
    matchedCardIds: [...state.matchedCardIds, first.id, second.id],
    matchedQuestionIds: [...state.matchedQuestionIds, first.questionId],
  }
}

export function closeUnmatchedWordAssemblyCards(state: WordAssemblyState): WordAssemblyState {
  return state.revealed.length === 0 ? state : { ...state, revealed: [] }
}

export interface WordAssemblyScore {
  matchedPairs: number
  mismatches: number
  questionsSolved: number
  score: number
  maximum: number
}

export function scoreWordAssembly(state: WordAssemblyState): WordAssemblyScore {
  const matchedPairs = state.matchedQuestionIds.length
  return {
    matchedPairs,
    mismatches: state.mismatches,
    questionsSolved: matchedPairs,
    score: matchedPairs * WORD_ASSEMBLY_MATCH_POINTS - state.mismatches * WORD_ASSEMBLY_MISMATCH_PENALTY,
    maximum: WORD_ASSEMBLY_QUESTIONS.length * WORD_ASSEMBLY_MATCH_POINTS,
  }
}
