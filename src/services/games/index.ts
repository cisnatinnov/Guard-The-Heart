import { EMOJI_DECODE_CHALLENGE_ID, EMOJI_DECODE_DECK_PATH } from './emojiDecode'
import { GARDIMON_CHALLENGE_ID } from './gardimonProtocol'
import { WORD_ASSEMBLY_CHALLENGE_ID } from './wordAssembly'
import { INCIDENT_TRAIL_CHALLENGE_ID, INCIDENT_TRAIL_DECK_PATH } from './incidentTrail'
import { JAWS_CHALLENGE_ID } from './jawsOfRisk'
import { CORE_CHALLENGE_ID } from './saveTheCore'

export type ChallengeGameId =
  | 'emoji-decode'
  | 'gardimon-protocol'
  | 'word-assembly'
  | 'incident-trail'
  | 'jaws-of-risk'
  | 'save-the-core'

export const WORK_IN_PROGRESS_CHALLENGES: readonly ChallengeGameId[] = [
  'gardimon-protocol',
  'incident-trail',
]

export function isChallengeWorkInProgress(id: ChallengeGameId): boolean {
  return WORK_IN_PROGRESS_CHALLENGES.includes(id)
}

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
    title: 'Emoji Decode',
tagline: 'Combine four emoji into one word, against the clock.',
    rules: [
      'Fifteen questions, each combining four emoji into a single answer.',
      'Every slide carries a built-in 30 second timer.',
      'Ten points per decoded answer, 150 points in total.',
    ],
    deckPath: EMOJI_DECODE_DECK_PATH,
    deckLabel: 'Emoji Decode deck (PPTX)',
    challengeId: EMOJI_DECODE_CHALLENGE_ID,
  },
  {
    id: 'gardimon-protocol',
    title: 'Gardimon Protocol',
    tagline: 'Five protocol cards split into Crime Scene, Evidence and Protocol phases.',
    rules: [
      'Five unique cards, each drawn from the pool rarity set.',
      'Three phases per card: Crime Scene, Evidence, then Protocol.',
      'Eight minutes per question in a team run.',
'Ten points per correct phase, plus 15 for a perfect card.',
    ],
    challengeId: GARDIMON_CHALLENGE_ID,
  },
  {
    id: 'word-assembly',
    title: 'Word Assembly',
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
    id: 'incident-trail',
    title: 'Incident Trail',
    tagline: 'Five crime scenes, five clues, twenty five information pieces and answer sheets.',
    rules: [
      'Twenty five information pieces, each with its own answer sheet.',
      'Five of those pieces are the clues that close the five scenes.',
      'Twenty seconds per question in a team run.',
      'Twenty points per scene closed with the right clue.',
    ],
    deckPath: INCIDENT_TRAIL_DECK_PATH,
    deckLabel: 'Incident Trail deck (PPTX)',
    challengeId: INCIDENT_TRAIL_CHALLENGE_ID,
  },
  {
    id: 'jaws-of-risk',
    title: 'Jaws of Risk',
    tagline: 'Spot the loose teeth in the solo mouth.',
    rules: [],
    challengeId: JAWS_CHALLENGE_ID,
  },
  {
    id: 'save-the-core',
    title: 'Save the Core',
    tagline: 'Race randomly placed players or teams to the Core before five minutes run out.',
    rules: [
'Choose the four built-in Guardians or select active teams; starting squares are randomized.',
'Reach the Core within five minutes to finish the game and earn the 50-point bonus.',
'If time expires first, the current scores are final; safe tiles score once and bombs return a pawn to its start.',
    ],
    challengeId: CORE_CHALLENGE_ID,
  },
]

export function challengeGameInfo(id: ChallengeGameId): ChallengeGameInfo {
  const game = CHALLENGE_GAMES.find((entry) => entry.id === id)
  if (!game) throw new Error(`Unknown challenge game: ${id}`)
  return game
}

export * from './emojiDecode'
export * from './gardimonProtocol'
export * from './wordAssembly'
export * from './incidentTrail'
export * from './jawsOfRisk'
export * from './saveTheCore'
export type { RandomSource } from './random'