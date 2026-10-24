import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { ChallengeController } from '../src/controllers/ChallengeController'
import { TeamController } from '../src/controllers/TeamController'
import { ChallengePointController } from '../src/controllers/ChallengePointController'
import { recordMatchingPair, finalizeChallengeScores, pendingChallengeTooth, recordChallengeAnswer, settleChallengeTooth } from '../src/services/challengeAnswers'
import { rerankChallenge, recalculateTotalScoreboard } from '../src/services/scoreboardAggregator'

beforeAll(async () => { await initializeAppDatabase() })
afterEach(() => vi.useRealTimers())
describe('host challenge verdicts', () => {
  it('recalculates every team reward when a raw score changes the rank order', async () => {
    const challenge = await ChallengeController.create('Frozen rank rewards')
    const alpha = await TeamController.create('Frozen Alpha')
    const beta = await TeamController.create('Frozen Beta')
    await ChallengePointController.create({ challenge: challenge.id, team: alpha.id, score: 25 })
    await ChallengePointController.create({ challenge: challenge.id, team: beta.id, score: 30 })
    const before = await ChallengePointController.listByChallenge(challenge.id)
    const gp = Object.fromEntries((await TeamController.list()).map((team) => [team.id, team.total_gp]))
    await recordChallengeAnswer({ id: crypto.randomUUID(), challenge: challenge.id, team: alpha.id, correct: true })
    await rerankChallenge(challenge.id)
    await recalculateTotalScoreboard()
    const after = await ChallengePointController.listByChallenge(challenge.id)
    expect(after.find((point) => point.team === alpha.id)?.rank).toBe(1)
    for (const point of before) {
      const saved = after.find((entry) => entry.team === point.team)!
      expect([saved.challenge_point, saved.guard_power]).toEqual(saved.rank === 1 ? [3, 3] : [2, 2])
      expect((await TeamController.list()).find((team) => team.id === point.team)?.total_gp).toBe(gp[point.team] + (saved.rank === 1 ? 1 : -1))
    }
  })
  it('awards rank CP and GP immediately without duplicating them on finalization', async () => {
    const challenge = await ChallengeController.create('Raw-only scoring')
    const team = await TeamController.create('Raw-only team')
    await recordChallengeAnswer({ id: crypto.randomUUID(), challenge: challenge.id, team: team.id, correct: true })
    await rerankChallenge(challenge.id)
    await recalculateTotalScoreboard()
    let point = (await ChallengePointController.listByChallenge(challenge.id))[0]
    expect([point.score, point.challenge_point, point.guard_power]).toEqual([10, 3, 3])
    expect((await TeamController.list()).find((entry) => entry.id === team.id)?.total_gp).toBe(8)
    await finalizeChallengeScores(challenge.id)
    point = (await ChallengePointController.listByChallenge(challenge.id))[0]
    expect([point.score, point.challenge_point, point.guard_power]).toEqual([10, 3, 3])
  })
  it('adds and deducts raw score without replacing an existing score, and deduplicates retries', async () => {
    const challenge = await ChallengeController.create('Manual scoring')
    const team = await TeamController.create('Manual score team')
    await ChallengePointController.create({ challenge: challenge.id, team: team.id, score: 25 })
    const input = { id: crypto.randomUUID(), challenge: challenge.id, team: team.id, correct: true }
    await recordChallengeAnswer(input)
    await recordChallengeAnswer(input)
    expect((await ChallengePointController.listByChallenge(challenge.id))[0].score).toBe(35)
    await recordChallengeAnswer({ ...input, id: crypto.randomUUID(), correct: false })
    expect((await ChallengePointController.listByChallenge(challenge.id))[0].score).toBe(25)
  })
  it('requires an opponent for a right answer and penalizes only that opponent once if bitten', async () => {
    const challenge = await ChallengeController.create('Jaw right verdict')
    const team = await TeamController.create('Jaw right team')
    const opponent = await TeamController.create('Jaw opponent')
    const input = { id: crypto.randomUUID(), challenge: challenge.id, team: team.id, correct: true, jaw: true }
    await expect(recordChallengeAnswer(input)).rejects.toThrow('opponent')
    await expect(recordChallengeAnswer({ ...input, opponent: team.id })).rejects.toThrow('opponent')
    const answer = await recordChallengeAnswer({ ...input, opponent: opponent.id })
    expect((await pendingChallengeTooth(challenge.id))?.pressing_team).toBe(opponent.id)
    await expect(recordChallengeAnswer({ ...input, id: crypto.randomUUID(), opponent: opponent.id })).rejects.toThrow('pending')
    expect((await settleChallengeTooth(answer.id, true)).applied).toBe(true)
    expect((await settleChallengeTooth(answer.id, true)).applied).toBe(false)
    const scores = await ChallengePointController.listByChallenge(challenge.id)
    expect(scores.find((entry) => entry.team === team.id)?.score).toBe(10)
    expect(scores.find((entry) => entry.team === opponent.id)?.score).toBe(-5)
    expect((await pendingChallengeTooth(challenge.id))?.press_count).toBe(1)
    await settleChallengeTooth(answer.id, false, 1)
    expect(await pendingChallengeTooth(challenge.id)).toBeNull()
  })
  it('makes a wrong-answer team press and leaves its score at -10 when safe or -15 when bitten', async () => {
    const challenge = await ChallengeController.create('Jaw wrong verdict')
    const team = await TeamController.create('Jaw wrong team')
    let answer = await recordChallengeAnswer({ id: crypto.randomUUID(), challenge: challenge.id, team: team.id, correct: false, jaw: true })
    expect(answer.pressing_team).toBe(team.id)
    await settleChallengeTooth(answer.id, false)
    await settleChallengeTooth(answer.id, false, 1)
    expect((await ChallengePointController.listByChallenge(challenge.id))[0].score).toBe(-10)
    answer = await recordChallengeAnswer({ id: crypto.randomUUID(), challenge: challenge.id, team: team.id, correct: false, jaw: true })
    await settleChallengeTooth(answer.id, true)
    await settleChallengeTooth(answer.id, false, 1)
    expect((await ChallengePointController.listByChallenge(challenge.id))[0].score).toBe(-25)
  })
})

it('awards +5 for each unique pair only during the 20-second right-answer bonus', async () => {
  const challenge = await ChallengeController.create('Matching bonus')
  const team = await TeamController.create('Matching bonus team')
  vi.useFakeTimers({ toFake: ['Date'] })
  const answer = await recordChallengeAnswer({ id: crypto.randomUUID(), challenge: challenge.id, team: team.id, correct: true, matching: true })
  await expect(recordMatchingPair(answer.id, 1)).rejects.toThrow('not active')
  vi.advanceTimersByTime(5000)
  await recordMatchingPair(answer.id, 1)
  await recordMatchingPair(answer.id, 1)
  await recordMatchingPair(answer.id, 2)
  expect((await ChallengePointController.listByChallenge(challenge.id))[0].score).toBe(20)
  vi.advanceTimersByTime(20000)
  await expect(recordMatchingPair(answer.id, 3)).rejects.toThrow('not active')
  expect((await ChallengePointController.listByChallenge(challenge.id))[0].score).toBe(20)
  const wrong = await recordChallengeAnswer({ id: crypto.randomUUID(), challenge: challenge.id, team: team.id, correct: false, matching: true })
  await expect(recordMatchingPair(wrong.id, 1)).rejects.toThrow('right answer')
})
