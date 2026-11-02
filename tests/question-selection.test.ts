import { describe, expect, it } from 'vitest'
import { ChallengeRunController } from '../src/controllers/ChallengeRunController'
import { challengeQuestionsFor } from '../src/services/games/challengeQuestions'

describe('challenge question selection', () => {
  const input = { gameId: 'emoji-decode' as const, challengeId: 'selection-test', teamIds: ['team-one'] }
  const bank = challengeQuestionsFor(input.gameId).questions
  it('defaults to ten questions and resolves selected questions in the chosen order', () => {
    expect(ChallengeRunController.start(input).questionCount).toBe(10)
    const run = ChallengeRunController.start({ ...input, questionIds: [bank[10].id, bank[2].id] })
    expect(run.questionCount).toBe(2)
    expect(ChallengeRunController.currentQuestion(input.gameId, run).id).toBe(bank[10].id)
    expect(ChallengeRunController.currentQuestion(input.gameId, { ...run, questionIndex: 1 }).id).toBe(bank[2].id)
  })
  it('starts Image Decode with the timer paused', () => {
    const run = ChallengeRunController.start(input)
    expect(run.timerManual).toBe(true)
    expect(run.turnDeadline).toBeUndefined()
    expect(run.secondsPerTurn).toBeUndefined()
  })
  it('rejects empty, duplicate, unknown, and over-limit selections', () => {
    for (const questionIds of [[], [bank[0].id, bank[0].id], ['unknown'], bank.slice(0, 11).map((q) => q.id)]) {
      expect(() => ChallengeRunController.start({ ...input, questionIds })).toThrow('Choose between 1 and 10 valid questions')
    }
  })
})
