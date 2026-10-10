import { EMOJI_DECODE_CHALLENGE_ID } from './emojiDecode'
import { WORD_ASSEMBLY_CHALLENGE_ID } from './wordAssembly'
import { JAWS_CHALLENGE_ID } from './jawsOfRisk'

export type ChallengeGameId = 'emoji-decode' | 'word-assembly' | 'jaws-of-risk'

export interface ChallengeGameInfo {
  id: ChallengeGameId
  title: string
  tagline: string
  rules: string[]
  deckPath?: string
  deckLabel?: string
  /** Fixed id of the challenge row this game is locked to. */
  challengeId: string
}

export const CHALLENGE_GAMES: ChallengeGameInfo[] = [
  {
    id: 'emoji-decode',
    title: 'Image Decode',
    tagline: 'Decode the banking terms revealed by the picture clues, against the clock.',
    rules: [
      'Eleven banking-term questions based on slides 3–24 of the Image Decode reference deck.',
      'Every slide carries a built-in 30 second timer.',
      'Ten points per decoded answer, 110 points in total.',
    ],
    deckPath: '/ui/Image_Decode.pptx',
    deckLabel: 'Image Decode deck (PPTX)',
    challengeId: EMOJI_DECODE_CHALLENGE_ID,
  },
  {
    id: 'word-assembly',
    title: 'Match Card',
    tagline: 'Match a picture pair, then answer a question from the reference deck.',
    rules: [
      'Flip two cards at a time and match identical pictures before answering the associated question.',
      'A matched pair unlocks a reference question; the answering team gets two attempts before the turn passes.',
      'Fifteen seconds per question in a team run.',
      'Ten points per matched pair, minus five for each mismatch.',
    ],
    deckPath: '/ui/Match-Card.pptx',
    deckLabel: 'Match Card question deck (PPTX)',
    challengeId: WORD_ASSEMBLY_CHALLENGE_ID,
  },
  {
    id: 'jaws-of-risk',
    title: 'Jaws of Risk',
    tagline: 'Answer each question to protect the jaw.',
    rules: [
      'Answer questions in sequence; there is no tooth selection or tooth board.',
      'Questions use slides 3–42 of the supplied Match Card deck.',
    ],
    deckPath: '/ui/Match-Card.pptx',
    deckLabel: 'Jaws question reference (PPTX)',
    challengeId: JAWS_CHALLENGE_ID,
  },
]

/** Former built-in challenge names, mapped to their current title. */
export const RENAMED_CHALLENGE_TITLES: Readonly<Record<string, string>> = {
  'Emoji Decode': 'Image Decode',
  'Word Assembly': 'Match Card',
}

/** Built-in challenges that were retired and are removed from older databases. */
export const REMOVED_CHALLENGE_TITLES: readonly string[] = [
  'Gardimon Protocol',
  'Incident Trail',
  'Save the Core',
]

export function challengeGameInfo(id: ChallengeGameId): ChallengeGameInfo {
  const game = CHALLENGE_GAMES.find((entry) => entry.id === id)
  if (!game) throw new Error(`Unknown challenge game: ${id}`)
  return game
}

export * from './emojiDecode'
export * from './wordAssembly'
export * from './jawsOfRisk'
export type { RandomSource } from './random'
