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
    tagline: 'Match five word cards out of twenty playable tiles.',
    rules: [
      'Five questions, four letter tiles each, twenty tiles in total.',
      'Reveal a tile, then drop it on the question and slot it belongs to.',
      'Fifteen seconds per question in a team run.',
'Ten points per match, minus five for every wrong slot.',
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
    tagline: 'The crocodile dentist toy: label the loose teeth, then press.',
    rules: [
      'Twenty four teeth in two jaws, six of them loose.',
      'Select a tooth and label it before the press.',
'Ten points per loose tooth found, minus five per false alarm.',
    ],
    challengeId: JAWS_CHALLENGE_ID,
  },
  {
    id: 'save-the-core',
    title: 'Save the Core',
    tagline: 'Ludo paths crossed with minesweeper: bombs send you back to the start.',
    rules: [
      'Four guardians race along one track toward the Core.',
      'A safe tile reveals a randomised score the first time it is landed on.',
'A bomb sends the piece straight back to the starting position.',
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