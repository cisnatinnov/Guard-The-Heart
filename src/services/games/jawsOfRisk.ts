import type { RandomSource } from './random'

export type JawLabel = 'Unmarked' | 'Suspect' | 'Firm'

export const JAWS_LABELS: JawLabel[] = ['Unmarked', 'Suspect', 'Firm']
export const JAWS_ROWS = 2
export const JAWS_COLUMNS = 12
export const JAWS_TOOTH_COUNT = JAWS_ROWS * JAWS_COLUMNS
export const JAWS_SOLO_TOOTH_COUNT = 8
export const JAWS_LOOSE_COUNT = 6
export const JAWS_HIT_POINTS = 10
export const JAWS_CHALLENGE_ID = 'd5e8b317-4c62-49af-8b03-2f7c19a6d5e8'
export const JAWS_FALSE_FLAG_PENALTY = 5
export const JAWS_PRESS_DURATION_MS = 1400

export interface JawTooth {
  id: string
  number: number
  row: number
  column: number
  label: JawLabel
}

export interface JawsBoard {
  teeth: JawTooth[]
  looseIds: string[]
}

function createTeeth(toothCount = JAWS_TOOTH_COUNT): JawTooth[] {
  const columns = Math.ceil(toothCount / JAWS_ROWS)
  const teeth: JawTooth[] = []
  for (let index = 0; index < toothCount; index += 1) {
    const number = index + 1
    teeth.push({
      id: `tooth-${number}`,
      number,
      row: Math.floor(index / columns),
      column: index % columns,
      label: 'Unmarked',
    })
  }
  return teeth
}

/** The crocodile toy hides a handful of loose teeth among the firm ones. */
export function createJawsBoard(
  random: RandomSource = Math.random,
  looseCount = JAWS_LOOSE_COUNT,
  toothCount = JAWS_TOOTH_COUNT
): JawsBoard {
  const teeth = createTeeth(toothCount)
  const indices = new Set<number>()
  while (indices.size < Math.min(looseCount, teeth.length)) {
    indices.add(Math.floor(random() * teeth.length))
  }
  return { teeth, looseIds: [...indices].map((index) => teeth[index].id).sort() }
}

export function toothIdForNumber(number: number): string {
  return `tooth-${number}`
}

/**
 * Selecting and labelling happens before the press. A tooth only becomes
 * `Suspect` when it is selected, so pressing never changes the player's labels.
 */
export function setJawLabel(board: JawsBoard, toothId: string, label: JawLabel): JawsBoard {
  return {
    ...board,
    teeth: board.teeth.map((tooth) => (tooth.id === toothId ? { ...tooth, label } : tooth)),
  }
}

export function toggleJawSelection(board: JawsBoard, toothId: string): JawsBoard {
  return setJawLabel(board, toothId, currentJawLabel(board, toothId) === 'Suspect' ? 'Firm' : 'Suspect')
}

export function currentJawLabel(board: JawsBoard, toothId: string): JawLabel {
  return board.teeth.find((tooth) => tooth.id === toothId)?.label ?? 'Unmarked'
}

export interface JawsOutcome {
  hits: string[]
  misses: string[]
  falseFlags: string[]
  correct: string[]
  score: number
  maximum: number
  accuracy: number
}

/** Grades the labels the player set before pressing the tooth. */
export function evaluateJawsBoard(board: JawsBoard): JawsOutcome {
  const hits = board.looseIds.filter((id) => jawLabelOf(board, id) === 'Suspect')
  const falseFlags = board.teeth
    .filter((tooth) => tooth.label === 'Suspect' && !board.looseIds.includes(tooth.id))
    .map((tooth) => tooth.id)
  const misses = board.looseIds.filter((id) => jawLabelOf(board, id) !== 'Suspect')
  const correct = board.looseIds.filter((id) => jawLabelOf(board, id) === 'Firm')
  const score = hits.length * JAWS_HIT_POINTS - falseFlags.length * JAWS_FALSE_FLAG_PENALTY

  return {
    hits,
    misses,
    falseFlags,
    correct,
    score: Math.max(0, score),
    maximum: board.looseIds.length * JAWS_HIT_POINTS,
    accuracy:
      hits.length + falseFlags.length === 0
        ? 0
        : Math.round((hits.length / (hits.length + falseFlags.length)) * 100),
  }
}

function jawLabelOf(board: JawsBoard, toothId: string): JawLabel {
  return board.teeth.find((tooth) => tooth.id === toothId)?.label ?? 'Unmarked'
}

export function jawsFlagCount(board: JawsBoard): number {
  return board.teeth.filter((tooth) => tooth.label !== 'Unmarked').length
}