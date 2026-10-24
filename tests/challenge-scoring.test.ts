import { beforeAll, describe, expect, it } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { ChallengeController } from '../src/controllers/ChallengeController'
import { ChallengePointController } from '../src/controllers/ChallengePointController'
import { ChallengeRunController } from '../src/controllers/ChallengeRunController'
import { ScoreboardController } from '../src/controllers/ScoreboardController'
import { TeamController } from '../src/controllers/TeamController'
import { checkEmojiAnswer, getEmojiDecodeQuestions, type ChallengeGameId } from '../src/services/games'
import { getGameQuestions } from '../src/services/gameQuestionCache'
import { advanceMatchingTransition, flipRunCard, type ChallengeRun } from '../src/services/games/teamRun'

beforeAll(async () => { await initializeAppDatabase() })

async function fixture(gameId: ChallengeGameId, suffix: string) {
  const challenge = await ChallengeController.create(`${gameId} scoring ${suffix}`)
  const alpha = await TeamController.create(`${gameId} ${suffix} Alpha`)
  const beta = await TeamController.create(`${gameId} ${suffix} Beta`)
  let run = ChallengeRunController.start({ gameId, challengeId: challenge.id, teamIds: [alpha.id, beta.id] })
  if (gameId === 'word-assembly') run = unlock(run)
  return { run, alpha, beta }
}

function unlock(run: ChallengeRun): ChallengeRun {
  const first = run.matchingBoard!.board[0]
  for (const card of run.matchingBoard!.board.filter((card) => card.questionId === first.questionId)) {
    run = flipRunCard(run, card.id)
  }
  return advanceMatchingTransition({ ...run, turnDeadline: 0 })
}

function correctAnswer(gameId: ChallengeGameId): string {
  if (gameId === 'emoji-decode') return getEmojiDecodeQuestions()[0].answer
  return getGameQuestions(gameId === 'word-assembly' ? 'match-card' : 'jaws-of-risk')[0].answer
}

async function assertSaved(run: ChallengeRun) {
  await ChallengeRunController.syncAll(run)
  const entries = await ChallengePointController.listByChallenge(run.challenge)
  for (const team of run.runs) {
    expect(entries.find((entry) => entry.team === team.team)?.score).toBe(team.score)
    expect((await ScoreboardController.getByTeam(team.team))?.total_cp).toBe(entries.find(entry=>entry.team===team.team)?.challenge_point)
  }
  const best = Math.max(...run.runs.map((team) => team.score))
  for (const entry of entries) expect(entry.rank).toBe(entry.score === best ? 1 : 2)
}

describe('challenge scoring persistence', () => {
  for (const gameId of ['emoji-decode', 'word-assembly', 'jaws-of-risk'] as const) {
    it(`${gameId}: self answers retain negative scores and save the next team's reward`, async () => {
      const { alpha, beta, run: initial } = await fixture(gameId, 'self')
      let run = gameId === 'word-assembly' ? ChallengeRunController.chooseAnswerTeam(initial, alpha.id) : initial
      let outcome = await ChallengeRunController.answer({ gameId, run, teamId: alpha.id, answer: 'wrong' })
      if (gameId === 'word-assembly') {
        expect(outcome.result.points).toBe(0)
        expect(outcome.run.runs[0].score).toBe(0)
        outcome = await ChallengeRunController.answer({ gameId, run: outcome.run, teamId: alpha.id, answer: 'wrong' })
      }
      expect(outcome.result.error).toBeNull()
      expect(outcome.result.points).toBe(-10)
      run = gameId === 'word-assembly' ? advanceMatchingTransition({ ...outcome.run, turnDeadline: 0 }) : outcome.run
      outcome = await ChallengeRunController.answer({ gameId, run, teamId: beta.id, answer: correctAnswer(gameId) })
      expect(outcome.result.error).toBeNull()
      expect(outcome.run.runs.map((entry) => entry.score)).toEqual([-10, 10])
      await assertSaved(outcome.run)
    })

    for (const correct of [true, false]) {
      it(`${gameId}: ${correct ? 'correct' : 'wrong'} passed answers update both teams and totals`, async () => {
        const { alpha, beta, run: initial } = await fixture(gameId, `pass-${correct}`)
        let run: ChallengeRun
        if (gameId === 'word-assembly') {
          run = ChallengeRunController.chooseAnswerTeam(initial, beta.id)
          if (!correct) {
            const first = await ChallengeRunController.answer({ gameId, run, teamId: beta.id, answer: 'wrong' })
            expect(first.result.points).toBe(0)
            run = first.run
          }
          run = (await ChallengeRunController.answer({ gameId, run, teamId: beta.id, answer: correct ? correctAnswer(gameId) : 'wrong' })).run
        } else {
          run = await ChallengeRunController.pass({ gameId, run: initial, fromTeamId: alpha.id, toTeamId: beta.id, answer: correct ? correctAnswer(gameId) : 'wrong' })
        }
        expect(run.runs.map((entry) => entry.score)).toEqual(correct ? [0, 10] : [0, -10])
        await assertSaved(run)
      })
    }

    it(`${gameId}: timeout cannot score a supplied correct answer`, async () => {
      const { alpha, run: initial } = await fixture(gameId, 'timeout')
      const run = gameId === 'word-assembly' ? ChallengeRunController.chooseAnswerTeam(initial, alpha.id) : initial
      const outcome = await ChallengeRunController.answer({ gameId, run, teamId: alpha.id, answer: correctAnswer(gameId), timedOut: true })
      expect(outcome.result.correct).toBe(false)
      expect(outcome.result.points).toBe(-10)
      await assertSaved(outcome.run)
    })
  }
})

it('Image Decode scorer distinguishes an empty history from a wrong answer', async () => {
  const { scoreEmojiDecode } = await import('../src/services/games')
  expect(scoreEmojiDecode([]).score).toBe(0)
  const question = getEmojiDecodeQuestions()[0]
  expect(scoreEmojiDecode([{ questionId: question.id, guess: '', correct: checkEmojiAnswer(question, '') }]).score).toBe(-10)
})
