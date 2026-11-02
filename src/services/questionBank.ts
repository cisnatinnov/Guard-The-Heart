import type { Transaction } from 'sequelize'
import { v4 as uuid } from 'uuid'
import { GameQuestion } from '../models'
import { flushDatabase, getSequelize, refreshDatabaseFromStorage, withDatabaseMutation, withDatabaseWriteLock } from '../db/sequelize-provider'
import { DB_EVENTS, dbEvents } from '../hooks/useDbEvents'
import { refreshGameQuestionCache } from './gameQuestionSeeds'
import { type QuestionBankKey } from './gameQuestionCache'

export interface QuestionInput {
  bank: QuestionBankKey
  prompt: string
  answer: string
  options: string[]
  hint: string
  explanation: string
}
export function validateQuestion(input: QuestionInput): QuestionInput {
  if (!['image-decode', 'match-card'].includes(input.bank)) throw new Error('Choose a valid question bank.')
  const value = { ...input, prompt: input.prompt.trim(), answer: input.answer.trim(), hint: input.hint.trim(), explanation: input.explanation.trim(), options: input.options.map(option => option.trim()) }
  if (!value.prompt || !value.answer) throw new Error('Question and answer are required.')
  if (value.bank === 'match-card') {
    if (value.options.length !== 4 || value.options.some(option => !option)) throw new Error('Enter four answer options.')
    if (new Set(value.options.map(option => option.toLocaleLowerCase())).size !== 4) throw new Error('Answer options must be distinct.')
    if (!value.options.includes(value.answer)) throw new Error('Choose one of the options as the correct answer.')
  } else value.options = []
  return value
}
async function mutate(operation: (transaction: Transaction) => Promise<void>) {
  await withDatabaseWriteLock(async () => {
    await refreshDatabaseFromStorage()
    await withDatabaseMutation(async () => {
      await getSequelize().transaction(operation)
      await flushDatabase()
      await refreshGameQuestionCache()
    })
  })
  dbEvents.emit(DB_EVENTS.QUESTIONS_CHANGED)
}
export async function saveQuestion(input: QuestionInput, id?: string) {
  const value = validateQuestion(input)
  await mutate(async transaction => {
    const existing = id ? await GameQuestion.findByPk(id, { transaction }) : null
    if (id && !existing) throw new Error('This question no longer exists. Refresh the bank.')
    if (existing && existing.game_key !== value.bank) throw new Error('A question cannot be moved between banks.')
    const values = { game_key: value.bank, prompt: value.prompt, answer: value.answer, options: JSON.stringify(value.options), kind: value.bank === 'image-decode' ? 'decode' : 'choice', hint: value.hint, explanation: value.explanation }
    if (existing) await existing.update(values, { transaction })
    else {
      const maximum = await GameQuestion.max('number', { where: { game_key: value.bank }, transaction }) as number | null
      await GameQuestion.create({ ...values, id: `question-${uuid()}`, number: (maximum ?? 0) + 1 }, { transaction })
    }
  })
}
export async function deleteQuestion(id: string) {
  await mutate(async transaction => {
    const row = await GameQuestion.findByPk(id, { transaction })
    if (!row) throw new Error('This question no longer exists. Refresh the bank.')
    if (await GameQuestion.count({ where: { game_key: row.game_key }, transaction }) <= 1) throw new Error('Keep at least one question in each bank.')
    // Sequelize's bulk-delete path notifies the sql.js persistence listener.
    await GameQuestion.destroy({ where: { id }, transaction })
  })
}
