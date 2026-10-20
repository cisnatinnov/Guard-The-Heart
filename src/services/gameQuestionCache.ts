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
  sourceDeck?: string
  sourceSlide?: number
  answerSlide?: number
  answerLetter?: string
}

const bank = new Map<string, GameQuestionRecord[]>()

export function replaceGameQuestionCache(rows: GameQuestionRecord[]): void {
  bank.clear()
  for (const row of rows) {
    const current = bank.get(row.game_key) ?? []
    current.push(row)
    bank.set(row.game_key, current)
  }
  for (const items of bank.values()) items.sort((a, b) => a.number - b.number)
}

export function getGameQuestions(gameKey: string): GameQuestionRecord[] {
  const referenceRows = gameKey === 'match-card' ? reference.matchCard
    : gameKey === 'jaws-of-risk' ? reference.jawsOfRisk
    : gameKey === 'image-decode' ? reference.imageDecode : undefined
  if (!referenceRows) return bank.get(gameKey) ?? []
  // The specified slide ranges also serve callers before database startup.
  return referenceRows.map((source) => ({
    ...source,
    ...bank.get(gameKey)?.find((row) => row.number === source.number),
    id: `${gameKey}-${String(source.number).padStart(3, '0')}`,
    game_key: gameKey,
    kind: gameKey === 'image-decode' ? 'decode' : 'choice',
  }))
}
