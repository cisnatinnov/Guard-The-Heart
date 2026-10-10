export interface GameQuestionRecord {
  id: string
  game_key: string
  number: number
  prompt: string
  answer: string
  options: string[]
  kind: 'decode' | 'choice'
  hint: string
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
  return bank.get(gameKey) ?? []
}
