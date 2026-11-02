import { GameQuestion } from '../models'
import { getSequelize } from '../db/sequelize-provider'
import { bundledQuestions, replaceGameQuestionCache } from './gameQuestionCache'

export async function refreshGameQuestionCache(): Promise<void> {
  const rows = await GameQuestion.findAll({ order: [['number', 'ASC']] })
  replaceGameQuestionCache(rows.map(row => ({
    id: row.id, game_key: row.game_key, number: row.number, prompt: row.prompt,
    answer: row.answer, options: JSON.parse(row.options) as string[],
    kind: row.kind, hint: row.hint, explanation: row.explanation,
  })))
}

/** Import existing questions once. Subsequent startups preserve host edits and deletions. */
export async function seedGameQuestions(): Promise<void> {
  const db = getSequelize()
  await db.query('CREATE TABLE IF NOT EXISTS app_migration (id TEXT PRIMARY KEY)')
  const [applied] = await db.query("SELECT id FROM app_migration WHERE id = 'editable-question-banks-v1'")
  if (!applied.length) await db.transaction(async transaction => {
    // Retain old IDs so saved question selections continue to resolve.
    const legacy = await GameQuestion.findAll({ where: { game_key: 'jaws-of-risk' }, transaction })
    const existingShared = await GameQuestion.findAll({ where: { game_key: 'match-card' }, transaction })
    const offset = Math.max(71, ...existingShared.map(q => q.number))
    for (const row of legacy) await row.update({ game_key: 'match-card', number: offset + row.number }, { transaction })
    const current = await GameQuestion.findAll({ transaction })
    const byId = new Map(current.map(row => [row.id, row]))
    const occupied = new Set(current.map(row => `${row.game_key}:${row.number}`))
    const nextNumber = (key: string) => Math.max(0, ...current.filter(row => row.game_key === key).map(row => row.number), ...missing.filter(row => row.game_key === key).map(row => row.number)) + 1
    const missing: { id: string; game_key: string; number: number; prompt: string; answer: string; options: string; kind: string; hint: string; explanation: string }[] = []
    for (const question of bundledQuestions) {
      const existing = byId.get(question.id)
      if (!existing) {
        const number = occupied.has(`${question.game_key}:${question.number}`) ? nextNumber(question.game_key) : question.number
        missing.push({ ...question, number, explanation: question.explanation ?? '', options: JSON.stringify(question.options) })
        occupied.add(`${question.game_key}:${number}`)
      } else if (!existing.explanation) await existing.update({ explanation: question.explanation ?? '' }, { transaction })
    }
    if (missing.length) await GameQuestion.bulkCreate(missing, { transaction })
    await db.query("INSERT INTO app_migration (id) VALUES ('editable-question-banks-v1')", { transaction })
  })
  await refreshGameQuestionCache()
}
