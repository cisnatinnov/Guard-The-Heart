import { beforeAll, describe, expect, it } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { getGameQuestions } from '../src/services/gameQuestionCache'
import { seedGameQuestions } from '../src/services/gameQuestionSeeds'
import { deleteQuestion, saveQuestion, validateQuestion } from '../src/services/questionBank'
import { GameQuestion } from '../src/models'
import { challengeQuestionsFor } from '../src/services/games/challengeQuestions'

beforeAll(initializeAppDatabase)
const input = { bank: 'match-card' as const, prompt: 'Shared CRUD test', answer: 'First', options: ['First', 'Second', 'Third', 'Fourth'], hint: 'Test', explanation: 'Explanation saved with the question.' }

describe('editable question banks', () => {
  it('preserves all existing questions and exposes one bank to Challenges 2 and 3', () => {
    const shared = getGameQuestions('match-card')
    expect(shared).toHaveLength(140)
    expect(getGameQuestions('jaws-of-risk')).toEqual(shared)
    expect(shared.some(q => q.id === 'jaws-of-risk-001')).toBe(true)
    expect(shared.every(q => q.kind === 'choice')).toBe(true)
    expect(getGameQuestions('image-decode')).toHaveLength(69)
    expect(getGameQuestions('image-decode').every(q => q.kind === 'decode')).toBe(true)
  })
  it('creates, edits and deletes shared questions without restoring them on startup', async () => {
    await saveQuestion(input)
    const created = getGameQuestions('match-card').find(q => q.prompt === input.prompt)!
    expect(created.explanation).toBe(input.explanation)
    expect(getGameQuestions('jaws-of-risk').some(q => q.id === created.id)).toBe(true)
    await saveQuestion({ ...input, prompt: 'Updated shared question', answer: 'Second' }, created.id)
    await seedGameQuestions()
    expect(getGameQuestions('match-card').find(q => q.id === created.id)?.answer).toBe('Second')
    for (const game of ['word-assembly', 'jaws-of-risk'] as const) {
      const question = challengeQuestionsFor(game).questions.find(q => q.id === created.id)!
      expect(question.grade('Second')).toBe(10)
      expect(question.grade('First')).toBe(0)
    }
    await deleteQuestion(created.id)
    await seedGameQuestions()
    expect(getGameQuestions('jaws-of-risk').some(q => q.id === created.id)).toBe(false)
  })
  it('preserves edits and deletions of bundled questions and isolates Challenge 1', async () => {
    const original = (await GameQuestion.findByPk('image-decode-001'))!.get({ plain: true })
    await saveQuestion({ bank: 'image-decode', prompt: 'Custom clue', answer: 'Custom answer', options: [], hint: 'Custom hint', explanation: 'Custom explanation' }, original.id)
    await seedGameQuestions()
    expect(getGameQuestions('image-decode')[0].prompt).toBe('Custom clue')
    expect(getGameQuestions('match-card').some(q => q.prompt === 'Custom clue')).toBe(false)
    await deleteQuestion(original.id)
    await seedGameQuestions()
    expect(getGameQuestions('image-decode').some(q => q.id === original.id)).toBe(false)
    await GameQuestion.create(original)
    await seedGameQuestions()
  })
  it('rejects blank questions, duplicate choices and answers outside the options', () => {
    expect(() => validateQuestion({ ...input, prompt: ' ' })).toThrow('required')
    expect(() => validateQuestion({ ...input, options: ['A', 'a', 'B', 'C'] })).toThrow('distinct')
    expect(() => validateQuestion({ ...input, answer: 'Missing' })).toThrow('correct answer')
  })
})
