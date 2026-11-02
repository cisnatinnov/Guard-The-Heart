import reference from '../data/reference-question-bank.json'

export interface GameQuestionRecord {
  id: string
  game_key: string
  number: number
  prompt: string
  answer: string
  options: string[]
  kind: 'decode' | 'choice'
  hint: string
  explanation?: string
  sourceWorkbook?: string
  sourceDeck?: string
  sourceSlide?: number
  answerSlide?: number
  answerLetter?: string
}
export type QuestionBankKey = 'image-decode' | 'match-card'
export function questionBankKey(key: string): string { return key === 'jaws-of-risk' ? 'match-card' : key }

export const bundledQuestions: GameQuestionRecord[] = [
  ...reference.imageDecode.map(q => ({ ...q, id: `image-decode-${String(q.number).padStart(3, '0')}`, game_key: 'image-decode', kind: 'decode' as const })),
  ...reference.matchCard.map(q => ({ ...q, id: `match-card-${String(q.number).padStart(3, '0')}`, game_key: 'match-card', kind: 'choice' as const })),
  ...reference.jawsOfRisk.map(q => ({ ...q, id: `jaws-of-risk-${String(q.number).padStart(3, '0')}`, number: reference.matchCard.length + q.number, game_key: 'match-card', kind: 'choice' as const })),
]
let rows: GameQuestionRecord[] | undefined
let revision = 0
const listeners = new Set<() => void>()
export const subscribeQuestions = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const questionRevision = () => revision
export function replaceGameQuestionCache(next: GameQuestionRecord[]): void {
  rows = [...next].sort((a, b) => a.number - b.number)
  revision++
  listeners.forEach(listener => listener())
}
export function getGameQuestions(gameKey: string): GameQuestionRecord[] {
  return (rows ?? bundledQuestions).filter(row => row.game_key === questionBankKey(gameKey))
}
