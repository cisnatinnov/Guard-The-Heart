import { useEffect, useState } from 'react'
import { type ChallengeGameId } from '../../services/games'
import { challengeQuestionsFor } from '../../services/games/challengeQuestions'
import { isMatchingQuestionUnlocked, isRunComplete, teamForQuestion, type ChallengeRun } from '../../services/games/teamRun'
import { useTeams } from '../../hooks/useTeams'
import { MatchingCards } from './MatchingCards'
import { QuestionPresentation } from './QuestionPresentation'
import { RouletteOrder } from './RouletteOrder'
import { useRunCountdown } from './useRunCountdown'

export function PublicQuestionView({ gameId, run }: { gameId: ChallengeGameId; run: ChallengeRun | null }) {
  const { teams } = useTeams()
  const set = challengeQuestionsFor(gameId)
  const complete = run ? isRunComplete(run) : false
  const matching = gameId === 'word-assembly'
  const unlocked = !matching || !!run && isMatchingQuestionUnlocked(run)
  const question = run && !complete && unlocked ? set.questions[run.questionIndex] : undefined
  const team = run ? teamForQuestion(run) : undefined
  const teamName = (id: string) => teams.find((entry) => entry.id === id)?.name ?? 'Team'
  const duration = set.secondsPerQuestion
  const attempt = question && team ? `${question.id}:${team.team}` : null
  const [timer, setTimer] = useState({ attempt: null as string | null, remaining: duration ?? 0 })
  const sharedRemaining = useRunCountdown(run?.turnDeadline)

  useEffect(() => {
    if (run?.turnDeadline !== undefined || matching || !attempt || duration === undefined) return
    const deadline = Date.now() + duration * 1000
    const tick = () => setTimer({ attempt, remaining: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) })
    tick()
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [matching, attempt, duration, run?.turnDeadline])

  const remaining = matching || run?.turnDeadline !== undefined ? sharedRemaining : question && duration !== undefined
    ? timer.attempt === attempt ? timer.remaining : duration : undefined
  const counter = run && !complete ? `Question ${run.questionIndex + 1} / ${run.questionCount}${team ? ` · ${teamName(team.team)}` : ''}${matching ? unlocked ? run.matchingPhase === 'choice' ? ' · Choose who answers' : ` · Answer attempts: ${run.answerAttempts ?? 0}/2` : ' · Match a pair' : ''}` : undefined
  return <QuestionPresentation gameId={gameId} question={question} counter={counter} seconds={remaining}
    status={complete ? 'All questions are complete!' : question && team ? `Waiting for an answer from ${teamName(team.team)}…` : undefined}>
    {run && !complete && !unlocked && run.matchingBoard ? <>
      <p className="matching-instruction">{team ? teamName(team.team) : 'Team'} matches a pair before answering · 20 seconds</p>
      <MatchingCards board={run.matchingBoard} />
      <RouletteOrder run={run} teamName={teamName} />
    </> : undefined}
  </QuestionPresentation>
}
