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
      'Every question has a 15-second timer.',
      'Self answers score +10 correct or −10 wrong or timed out, with a maximum of 110 points.',
    ],
    deckPath: '/ui/Image_Decode.pptx',
    deckLabel: 'Image Decode deck (PPTX)',
    challengeId: EMOJI_DECODE_CHALLENGE_ID,
  },
  {
    id: 'word-assembly',
    title: 'Flipping Card',
    tagline: 'Flip cards and match identical picture pairs.',
    rules: [
      'Flip two cards at a time and match identical pictures. There are no questions.',
      'Roulette draws the team order before matching. Each matching turn lasts twenty seconds; a mismatch or timeout passes the turn.',
      'A matched pair moves the turn to the next team. This matching activity does not award or deduct points.',
      'Match all ten pairs to complete the challenge.',
    ],
    challengeId: WORD_ASSEMBLY_CHALLENGE_ID,
  },
  {
    id: 'jaws-of-risk',
    title: 'Jaw of Risk',
    tagline: 'Answer each question to protect the jaw.',
    rules: [
      'Answer questions in sequence; there is no tooth selection or tooth board.',
      'Twenty questions use slides 3–42 of the supplied Jaw of Risk deck.',
      'Every question has a 15-second timer. A timeout counts as a wrong answer.',
      'Self answers score +10 correct or −10 wrong. Passed answers score +5 or −5 for the recipient, and −10 or −5 for the giver.',
    ],
    deckPath: '/ui/Jaw-of-risk.pptx',
    deckLabel: 'Jaws question reference (PPTX)',
    challengeId: JAWS_CHALLENGE_ID,
  },
]

/** Former built-in challenge names, mapped to their current title. */
export const RENAMED_CHALLENGE_TITLES: Readonly<Record<string, string>> = {
  'Emoji Decode': 'Image Decode',
  'Word Assembly': 'Flipping Card',
  'Match Card': 'Flipping Card',
  'Flipping Connect': 'Flipping Card',
  'Jaws of Risk': 'Jaw of Risk',
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
