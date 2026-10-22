import { afterEach, expect, it, vi } from 'vitest'
import { advanceMatchingTurn, enableRunMatching, flipRunCard, selectMatchingTeam, startChallengeRun } from '../src/services/games/teamRun'

afterEach(() => vi.useRealTimers())
function run() { return { ...enableRunMatching(startChallengeRun({ challenge:'test', teams:['a','b'], questionCount:10, pointsPerQuestion:0 })), matchingOnly:true, manualTeamSelection:true, turnDeadline:undefined } }
it('keeps unmatched cards open for exactly five seconds without changing team or score', () => {
  vi.useFakeTimers()
  let current = run()
  const first = current.matchingBoard!.board.find((card) => card.questionId === 'word-1')!
  const second = current.matchingBoard!.board.find((card) => card.questionId === 'word-2')!
  current = flipRunCard(flipRunCard(current,first.id),second.id) as typeof current
  expect(current.matchingCloseDeadline).toBe(Date.now()+5000)
  const saved = JSON.parse(JSON.stringify(current)) as typeof current
  vi.advanceTimersByTime(4999)
  expect(advanceMatchingTurn(saved)).toBe(saved)
  expect(selectMatchingTeam(saved,'b')).toBe(saved)
  vi.advanceTimersByTime(1)
  const closed = advanceMatchingTurn(saved)
  expect(closed.matchingBoard!.revealed).toEqual([])
  expect(closed.matchingCloseDeadline).toBeUndefined()
  expect(closed.nextTeamIndex).toBe(saved.nextTeamIndex)
  expect(closed.runs.map((team) => team.score)).toEqual([0,0])
})
it('does not start a close countdown for one card or a matched pair', () => {
  const current = run()
  const pair = current.matchingBoard!.board.filter((card) => card.questionId === 'word-1')
  const first = flipRunCard(current,pair[0].id)
  expect(first.matchingCloseDeadline).toBeUndefined()
  const matched = flipRunCard(first,pair[1].id)
  expect(matched.matchingCloseDeadline).toBeUndefined()
  expect(matched.matchingBoard!.matchedCardIds).toHaveLength(2)
})

it('blocks card flips and team changes during the initial preview and unlocks at its saved deadline', () => {
  vi.useFakeTimers()
  const current = { ...run(), matchingPreviewDeadline: Date.now() + 5000 }
  const saved = JSON.parse(JSON.stringify(current)) as typeof current
  const cardId = saved.matchingBoard!.board[0].id
  expect(flipRunCard(saved,cardId)).toBe(saved)
  expect(selectMatchingTeam(saved,'b')).toBe(saved)
  vi.advanceTimersByTime(4999)
  expect(flipRunCard(saved,cardId)).toBe(saved)
  expect(saved.matchingBoard!.revealed).toEqual([])
  expect(saved.matchingBoard!.matchedCardIds).toEqual([])
  expect(saved.runs.map((team) => team.score)).toEqual([0,0])
  vi.advanceTimersByTime(1)
  expect(flipRunCard(saved,cardId).matchingBoard!.revealed).toEqual([cardId])
  expect(selectMatchingTeam(saved,'b').nextTeamIndex).toBe(1)
})
