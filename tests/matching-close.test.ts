import { afterEach, expect, it, vi } from 'vitest'
import { advanceMatchingTurn, enableRunMatching, flipRunCard, selectMatchingTeam, startChallengeRun } from '../src/services/games/teamRun'

afterEach(() => vi.useRealTimers())
function run() { return { ...enableRunMatching(startChallengeRun({ challenge:'test', teams:['a','b'], questionCount:10, pointsPerQuestion:0 })), matchingOnly:true, manualTeamSelection:true, turnDeadline:undefined } }
it('closes an unmatched pair immediately without changing the selected team or score', () => {
  const current = run()
  const first = current.matchingBoard!.board.find((card) => card.questionId === 'word-1')!
  const second = current.matchingBoard!.board.find((card) => card.questionId === 'word-2')!
  const opened = flipRunCard(current,first.id)
  expect(opened.matchingBoard!.revealed).toEqual([first.id])
  const closed = flipRunCard(opened,second.id)
  expect(closed.matchingBoard!.revealed).toEqual([])
  expect(closed.matchingBoard!.mismatches).toBe(1)
  expect(closed.matchingCloseDeadline).toBeUndefined()
  expect(closed.nextTeamIndex).toBe(current.nextTeamIndex)
  expect(closed.runs.map((team) => team.score)).toEqual([0,0])
  expect(flipRunCard(closed,first.id).matchingBoard!.revealed).toEqual([first.id])
})
it('closes a legacy unmatched pair immediately even if its old deadline is in the future', () => {
  const current = run()
  const cards = current.matchingBoard!.board
  const saved = { ...current, matchingCloseDeadline: Date.now()+5000,
    matchingBoard: { ...current.matchingBoard!, revealed: [cards[0].id,cards.find((card) => card.questionId !== cards[0].questionId)!.id] } }
  expect(advanceMatchingTurn(saved).matchingBoard!.revealed).toEqual([])
})
it('does not start a close countdown for one card or a matched pair', () => {
  const current = run()
  const pair = current.matchingBoard!.board.filter((card) => card.questionId === 'word-1')
  const first = flipRunCard(current,pair[0].id)
  expect(first.matchingCloseDeadline).toBeUndefined()
  const matched = flipRunCard(first,pair[1].id)
  expect(matched.matchingCloseDeadline).toBeUndefined()
  expect(matched.matchingBoard!.matchedCardIds).toHaveLength(2)
  const others = matched.matchingBoard!.board.filter((card) => card.questionId !== 'word-1')
  const second = others.find((card) => card.questionId !== others[0].questionId)!
  const afterMismatch = flipRunCard(flipRunCard(matched,others[0].id),second.id)
  expect(afterMismatch.matchingBoard!.matchedCardIds).toEqual(matched.matchingBoard!.matchedCardIds)
  expect(afterMismatch.matchingBoard!.revealed).toEqual([])
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
