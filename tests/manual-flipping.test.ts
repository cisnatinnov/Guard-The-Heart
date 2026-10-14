import { expect, it } from 'vitest'
import { startChallengeRun, enableRunMatching, selectMatchingTeam, flipRunCard } from '../src/services/games/teamRun'
function run() { return {...enableRunMatching(startChallengeRun({challenge:'c',teams:['a','b'],questionCount:10,pointsPerQuestion:0})),matchingOnly:true,manualTeamSelection:true} }
it('chooses the clicked team and clears partial flips while preserving matched cards', () => {
  const current=run();const flipped=flipRunCard(current,current.matchingBoard!.board[0].id)
  const next=selectMatchingTeam(flipped,'b')
  expect(next.nextTeamIndex).toBe(1)
  expect(next.matchingBoard?.revealed).toEqual([])
  expect(next.runs.map((team)=>team.team)).toEqual(['a','b'])
  expect(next.turnDeadline).toBeUndefined()
  expect(() => selectMatchingTeam(next,'unknown')).toThrow('participating')
})
it('keeps the manually selected team after a matched pair', () => {
  let current=selectMatchingTeam(run(),'b');const first=current.matchingBoard!.board[0];const pair=current.matchingBoard!.board.filter(card=>card.questionId===first.questionId)
  for(const card of pair) current=flipRunCard(current,card.id)
  expect(current.nextTeamIndex).toBe(1)
  expect(current.questionIndex).toBe(1)
  expect(current.runs[1].correct).toBe(1)
})
it('keeps matching available without a turn timer, including a saved expired deadline', () => {
  const current={...selectMatchingTeam(run(),'b'),turnDeadline:Date.now()-1}
  const next=flipRunCard(current,current.matchingBoard!.board[0].id)
  expect(next.nextTeamIndex).toBe(1)
  expect(next.turnDeadline).toBeUndefined()
  expect(next.matchingBoard?.revealed).toHaveLength(1)
})
