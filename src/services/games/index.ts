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
    title: 'Challenge 1 - Image Decode',
    tagline: 'Decode the workbook clues. The timer is a reminder.',
    rules: [
      'Choose up to 10 questions from 69 emoji clues.',
      'A 15-second reminder never closes answers or changes scores.',
      'Answers score +10 correct or -10 wrong. Turn Order controls the active team.',
    ],
    challengeId: EMOJI_DECODE_CHALLENGE_ID,
  },
  {
    id: 'word-assembly',
    title: 'Challenge 2 - Matching Cards',
    tagline: 'Flip cards and match identical picture pairs.',
    rules: [
      'Flip two cards at a time and match identical pictures. Answer the workbook quiz to unlock matching.',
      'A right answer unlocks a fresh board: memorize cards for 5 seconds, then match pairs at your own pace. Each pair earns +5 raw score; There is no response timer.',
      'The selected team keeps its turn until the admin chooses another team. Submitted answers automatically add 10 for a right answer or deduct 10 for a wrong answer from the raw challenge score.',
      'Match all ten pairs to complete the challenge.',
    ],
    challengeId: WORD_ASSEMBLY_CHALLENGE_ID,
  },
  {
    id: 'jaws-of-risk',
    title: 'Challenge 3 - Jaw of Risk',
    tagline: 'Press a tooth, take a chance. Will Gilgamesh bite?',
    rules: [
      'Right Answer adds 10 and assigns an opponent to press at least two teeth. Wrong Answer deducts 10 and assigns the answering team. Each bite deducts 5 more raw score.',
      'A bite deducts 5 from the pressing team. Each answer allows exactly one press; scores persist across reloads.',
      'Take turns pressing one of the crocodile’s teeth. The admin can choose one or more hidden biting teeth.',
      'Safe teeth stay pressed until the crocodile bites.',
      'After a bite, the mouth opens automatically. Admin-selected biting teeth stay configured; random mode chooses a different tooth.',
    ],
    challengeId: JAWS_CHALLENGE_ID,
  },
]

/** Former built-in challenge names, mapped to their current title. */
export const RENAMED_CHALLENGE_TITLES: Readonly<Record<string, string>> = {
  'Emoji Decode': 'Challenge 1 - Image Decode',
  'Image Decode': 'Challenge 1 - Image Decode',
  'Word Assembly': 'Challenge 2 - Matching Cards',
  'Match Card': 'Challenge 2 - Matching Cards',
  'Matching Cards': 'Challenge 2 - Matching Cards',
  'Flipping Connect': 'Challenge 2 - Matching Cards',
  'Challenge 2 - Flipping Connect': 'Challenge 2 - Matching Cards',
  'Flipping Card': 'Challenge 2 - Matching Cards',
  'Challenge 2 - Flipping Card': 'Challenge 2 - Matching Cards',
  'Jaws of Risk': 'Challenge 3 - Jaw of Risk',
  'Jaw of Risk': 'Challenge 3 - Jaw of Risk',
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
