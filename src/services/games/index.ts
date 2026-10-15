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
    title: 'Challenge 2 - Flipping Card',
    tagline: 'Flip cards and match identical picture pairs.',
    rules: [
      'Flip two cards at a time and match identical pictures. There are no questions.',
      'Choose the active team by clicking its name. Urutan Main does not set the Flipping Card turn, and there is no turn timer.',
      'A matched pair moves the turn to the next team. This matching activity does not award or deduct points.',
      'Match all ten pairs to complete the challenge.',
    ],
    challengeId: WORD_ASSEMBLY_CHALLENGE_ID,
  },
  {
    id: 'jaws-of-risk',
    title: 'Challenge 3 - Jaw of Risk',
    tagline: 'Press a tooth, take a chance. Will the crocodile bite?',
    rules: [
      'Take turns pressing one of the crocodile’s teeth. One hidden tooth triggers a bite.',
      'Safe teeth stay pressed until the crocodile bites.',
      'After a bite, the mouth opens automatically and a different biting tooth is randomly chosen for the next round.',
    ],
    challengeId: JAWS_CHALLENGE_ID,
  },
]

/** Former built-in challenge names, mapped to their current title. */
export const RENAMED_CHALLENGE_TITLES: Readonly<Record<string, string>> = {
  'Emoji Decode': 'Challenge 1 - Image Decode',
  'Image Decode': 'Challenge 1 - Image Decode',
  'Word Assembly': 'Challenge 2 - Flipping Card',
  'Match Card': 'Challenge 2 - Flipping Card',
  'Flipping Connect': 'Challenge 2 - Flipping Card',
  'Flipping Card': 'Challenge 2 - Flipping Card',
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
