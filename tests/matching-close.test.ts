import { afterEach, expect, it, vi } from 'vitest'
import { advanceMatchingTurn, enableRunMatching, flipRunCard, selectMatchingTeam, startChallengeRun } from '../src/services/games/teamRun'

afterEach(() => vi.useRealTimers())
function run() { return { ...enableRunMatching(startChallengeRun({ challenge:'test', teams:['a','b'], questionCount:10, pointsPerQuestion:0 })), matchingOnly:true, manualTeamSelection:true, turnDeadline:undefined } }
it('shows both unmatched cards for 600ms then closes without changing team or score', () => {
  vi.useFakeTimers()
  const current = run()
  const first = current.matchingBoard!.board.find((card) => card.questionId === 'word-1')!
  const second = current.matchingBoard!.board.find((card) => card.questionId === 'word-2')!
  const opened = flipRunCard(current,first.id)
  const mismatch = flipRunCard(opened,second.id)
  expect(mismatch.matchingBoard!.revealed).toEqual([first.id,second.id])
  expect(mismatch.matchingCloseDeadline).toBe(Date.now()+600)
  const saved = JSON.parse(JSON.stringify(mismatch)) as typeof mismatch
  vi.advanceTimersByTime(599)
  expect(advanceMatchingTurn(saved)).toBe(saved)
  expect(selectMatchingTeam(saved,'b')).toBe(saved)
  vi.advanceTimersByTime(1)
  const closed = advanceMatchingTurn(saved)
  expect(closed.matchingBoard!.revealed).toEqual([])
  expect(closed.matchingBoard!.mismatches).toBe(1)
  expect(closed.nextTeamIndex).toBe(current.nextTeamIndex)
  expect(closed.runs.map((team) => team.score)).toEqual([0,0])
  expect(flipRunCard(closed,first.id).matchingBoard!.revealed).toEqual([first.id])
})
it('closes a legacy unmatched pair without a deadline', () => {
  const current = run()
  const cards = current.matchingBoard!.board
  const saved = { ...current, matchingBoard: { ...current.matchingBoard!, revealed: [cards[0].id,cards.find((card) => card.questionId !== cards[0].questionId)!.id] } }
  expect(advanceMatchingTurn(saved).matchingBoard!.revealed).toEqual([])
})
it('does not start a close countdown for one card or a matched pair', () => {
  vi.useFakeTimers()
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
  vi.advanceTimersByTime(600)
  expect(advanceMatchingTurn(afterMismatch).matchingBoard!.revealed).toEqual([])
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

it('replays the five-second preview only when changing team and preserves matched pairs', () => {
  vi.useFakeTimers()
  const current = run()
  const pair = current.matchingBoard!.board.filter((card) => card.questionId === 'word-1')
  const matched = flipRunCard(flipRunCard(current,pair[0].id),pair[1].id)
  expect(selectMatchingTeam(matched,'a')).toBe(matched)
  const changed = selectMatchingTeam(matched,'b')
  expect(changed.matchingPreviewDeadline).toBe(Date.now()+5000)
  expect(changed.matchingBoard!.matchedCardIds).toEqual(matched.matchingBoard!.matchedCardIds)
  expect(changed.questionIndex).toBe(1)
  const card = changed.matchingBoard!.board.find((card) => card.questionId !== 'word-1')!
  const saved = JSON.parse(JSON.stringify(changed)) as typeof changed
  vi.advanceTimersByTime(4999)
  expect(flipRunCard(saved,card.id)).toBe(saved)
  vi.advanceTimersByTime(1)
  expect(flipRunCard(saved,card.id).matchingBoard!.revealed).toEqual([card.id])
  expect(selectMatchingTeam(saved,'b')).toBe(saved)
})
