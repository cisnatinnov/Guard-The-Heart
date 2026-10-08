import { EMOJI_DECODE_CHALLENGE_ID, EMOJI_DECODE_DECK_PATH } from './emojiDecode'
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
    tagline: 'Combine four images into one word, against the clock.',
    rules: [
      'Fifteen questions, each combining four images into a single answer.',
      'Every slide carries a built-in 30 second timer.',
      'Ten points per decoded answer, 150 points in total.',
    ],
    deckPath: EMOJI_DECODE_DECK_PATH,
    deckLabel: 'Image Decode deck (PPTX)',
    challengeId: EMOJI_DECODE_CHALLENGE_ID,
  },
  {
    id: 'word-assembly',
    title: 'Match Card',
    tagline: 'Find ten pairs of matching picture cards.',
    rules: [
      'Match the two identical picture cards for each of ten questions.',
      'If the two opened cards do not match, all open cards turn back over.',
      'Fifteen seconds per question in a team run.',
      'Ten points per matched pair, minus five for each mismatch.',
    ],
    challengeId: WORD_ASSEMBLY_CHALLENGE_ID,
  },
  {
    id: 'jaws-of-risk',
    title: 'Jaws of Risk',
    tagline: 'Spot the loose teeth in the solo mouth.',
    rules: [],
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
