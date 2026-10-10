import source from '../data/reference-question-bank.json'
import { GameQuestion } from '../models'
import { replaceGameQuestionCache, type GameQuestionRecord } from './gameQuestionCache'

type QuestionSeed = Omit<GameQuestionRecord, 'id' | 'game_key'>
const questionSource = source as unknown as {
  imageDecode: QuestionSeed[]
  matchCard: QuestionSeed[]
  jawsOfRisk: QuestionSeed[]
}

const sources: Record<string, QuestionSeed[]> = {
  'image-decode': questionSource.imageDecode,
  'match-card': questionSource.matchCard,
  'jaws-of-risk': questionSource.jawsOfRisk,
}

/** Upserts the bundled PPTX question bank into SQLite and primes its read cache. */
export async function seedGameQuestions(): Promise<void> {
  for (const [gameKey, questions] of Object.entries(sources)) {
    for (const question of questions) {
      const id = `${gameKey}-${String(question.number).padStart(3, '0')}`
      const values = {
        id,
        game_key: gameKey,
        number: question.number,
        prompt: question.prompt,
        answer: question.answer,
        options: JSON.stringify(question.options),
        kind: question.kind,
        hint: question.hint,
      }
      const existing = await GameQuestion.findByPk(id)
      if (existing) {
        const changed =
          existing.game_key !== values.game_key ||
          existing.number !== values.number ||
          existing.prompt !== values.prompt ||
          existing.answer !== values.answer ||
          existing.options !== values.options ||
          existing.kind !== values.kind ||
          existing.hint !== values.hint
        if (changed) await existing.update(values)
      }
      else await GameQuestion.create(values)
    }
  }

  const rows = await GameQuestion.findAll({ order: [['game_key', 'ASC'], ['number', 'ASC']] })
  replaceGameQuestionCache(rows.map((row) => ({
    id: row.id,
    game_key: row.game_key,
    number: row.number,
    prompt: row.prompt,
    answer: row.answer,
    options: parseOptions(row.options),
    kind: row.kind,
    hint: row.hint,
  })))
}

function parseOptions(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every((option) => typeof option === 'string') ? parsed : []
  } catch {
    return []
  }
}
