import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ChallengeRunController, type TeamAnswerResult } from '../../controllers/ChallengeRunController'
import { useTeams } from '../../hooks/useTeams'
import type { ChallengeGameId } from '../../services/games'
import { challengeQuestionsFor } from '../../services/games/challengeQuestions'
import {
  activeTeams,
  eliminatedTeams,
  isRunComplete,
  type ChallengeRun,
} from '../../services/games/teamRun'
import { MAX_ENTRIES_PER_CHALLENGE } from '../../services/rankRules'

export interface TeamRunPanelProps {
  gameId: ChallengeGameId
  challengeId: string
  /** True while a team run is under way, which hides the solo screen. */
  running: boolean
  onStartRun: (run: ChallengeRun) => void
  onUpdateRun: (run: ChallengeRun) => void
  onEndRun: () => void
}

/**
 * Hosts the challenge either solo or as a team run. In a team run every team
 * that is following answers the current question independently, a wrong answer
 * takes that team out until the next question, and each team's running total is
 * written to the challenge scoreboard as it is earned.
 */
export function TeamRunPanel({
  gameId,
  challengeId,
  running,
  onStartRun,
  onUpdateRun,
  onEndRun,
}: TeamRunPanelProps) {
  const { teams } = useTeams()
  const [run, setRun] = useState<ChallengeRun | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<TeamAnswerResult[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gradedQuestionIndex, setGradedQuestionIndex] = useState<number | null>(null)
  const [timer, setTimer] = useState<{
    questionIndex: number | null
    remaining: number
  }>({ questionIndex: null, remaining: 0 })
  const answersFormRef = useRef<HTMLFormElement | null>(null)
  const timeoutQuestionIndex = useRef<number | null>(null)

  const questionSet = challengeQuestionsFor(gameId)
  const questions = questionSet.questions
  const question = run ? ChallengeRunController.currentQuestion(gameId, run) : null
  const following = run ? activeTeams(run) : []
  const outCount = run ? eliminatedTeams(run).length : 0
  const complete = run ? isRunComplete(run) : false
  const questionIndex = run?.questionIndex ?? null
  const graded = questionIndex !== null && gradedQuestionIndex === questionIndex
  const timerDuration = questionSet.secondsPerQuestion
  const hasTimer = timerDuration !== undefined
  const remaining = questionIndex !== null && timer.questionIndex === questionIndex
    ? timer.remaining
    : timerDuration ?? 0

  useEffect(() => {
    if (!running || questionIndex === null || timerDuration === undefined || graded) return

    setTimer({ questionIndex, remaining: timerDuration })
    timeoutQuestionIndex.current = null
    const interval = window.setInterval(() => {
      setTimer((current) => {
        if (current.questionIndex !== questionIndex || current.remaining === 0) return current
        return { ...current, remaining: Math.max(0, current.remaining - 1) }
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [running, questionIndex, timerDuration, graded])

  useEffect(() => {
    if (
      !running ||
      questionIndex === null ||
      !hasTimer ||
      remaining !== 0 ||
      graded ||
      busy ||
      timer.questionIndex !== questionIndex ||
      timeoutQuestionIndex.current === questionIndex
    ) {
      return
    }

    timeoutQuestionIndex.current = questionIndex
    answersFormRef.current?.requestSubmit()
  }, [running, questionIndex, hasTimer, remaining, graded, busy, timer.questionIndex])

  if (questions.length === 0) {
    // Save the Core has no question set, so only the solo screen applies.
    return null
  }

  function chooseTeam(teamId: string) {
    setChosen((current) => {
      if (current.includes(teamId)) return current.filter((id) => id !== teamId)
      if (current.length >= MAX_ENTRIES_PER_CHALLENGE) return current
      return [...current, teamId]
    })
  }

  function begin() {
    try {
      const started = ChallengeRunController.start({ gameId, challengeId, teamIds: chosen })
      setRun(started)
      onStartRun(started)
      setAnswers({})
      setResults([])
      setGradedQuestionIndex(null)
      setTimer({ questionIndex: null, remaining: timerDuration ?? 0 })
      timeoutQuestionIndex.current = null
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  function end() {
    setRun(null)
    onEndRun()
    setAnswers({})
    setResults([])
    setGradedQuestionIndex(null)
    setTimer({ questionIndex: null, remaining: timerDuration ?? 0 })
    timeoutQuestionIndex.current = null
    setError(null)
  }

  async function submitAnswers(event: FormEvent) {
    event.preventDefault()
    if (!run || graded || busy) return
    setBusy(true)
    setError(null)
    try {
      const timedOut = hasTimer && remaining === 0
      const outcome = await ChallengeRunController.answerAll({
        gameId,
        run,
        answers: following
          .filter((entry) => timedOut || (answers[entry.team] ?? '').trim().length > 0)
          .map((entry) => ({ teamId: entry.team, answer: answers[entry.team] ?? '' })),
      })
      setRun(outcome.run)
      onUpdateRun(outcome.run)
      setResults(outcome.results)
      setGradedQuestionIndex(run.questionIndex)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  function nextQuestion() {
    if (!run) return
    const advanced = ChallengeRunController.nextQuestion(run)
    setRun(advanced)
    onUpdateRun(advanced)
    setAnswers({})
    setResults([])
    setGradedQuestionIndex(null)
    setError(null)
  }

  const teamName = (id: string) => teams.find((team) => team.id === id)?.name ?? 'Team'

  if (running && run && question) {
    return (
      <section className="run-panel">
        <header className="run-panel__header">
          <div>
            <h3 className="run-panel__title">
              Team run · question {question.number} of {run.questionCount}
            </h3>
            <p className="run-panel__prompt">{question.prompt}</p>
            <p className="muted">{question.hint}</p>
          </div>
          <div className="run-panel__actions">
            <button type="button" className="ghost" onClick={end}>
              End run
            </button>
          </div>
        </header>

        {error && <p className="alert alert--error">{error}</p>}

        <form ref={answersFormRef} className="run-panel__answers" onSubmit={submitAnswers}>
          {hasTimer && (
            <div className="emoji-timer" role="timer" aria-label={`Time left for question ${question.number}`}>
              <span className="emoji-timer__track">
                <span
                  className={`emoji-timer__fill${
                    remaining <= 5 ? ' emoji-timer__fill--urgent' : ''
                  }`}
                  style={{ width: `${timerDuration ? (remaining / timerDuration) * 100 : 0}%` }}
                />
              </span>
              <span className="emoji-timer__value">
                  {remaining === 0
                    ? 'Time up'
                    : remaining >= 60
                      ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
                      : `${remaining}s`}
              </span>
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>State</th>
                  <th>Answer</th>
                  <th>Run score</th>
                </tr>
              </thead>
              <tbody>
                {run.runs.map((entry) => {
                  const out = entry.state === 'eliminated'
                  const result = results.find((row) => row.teamId === entry.team)
                  return (
                    <tr key={entry.team} className={out ? 'run-panel__row--out' : undefined}>
                      <td>{teamName(entry.team)}</td>
                      <td>
                        {out ? (
                          <span className="badge badge--muted">Out this question</span>
                        ) : (
                          <span className="badge">Following</span>
                        )}
                        {result && !result.skipped && (
                          <span
                            className={
                              result.correct
                                ? 'run-panel__verdict'
                                : 'run-panel__verdict run-panel__verdict--wrong'
                            }
                          >
                            {result.bitten
                              ? ' bitten'
                              : result.correct
                                ? ` +${result.points}`
                                : ' wrong answer'}
                          </span>
                        )}
                        {result?.skipped && <span className="run-panel__verdict"> skipped</span>}
                      </td>
                      <td>
                        <input
                          type="text"
                          value={answers[entry.team] ?? ''}
                          maxLength={80}
                          aria-label={`${teamName(entry.team)} answer`}
                          placeholder={out ? 'Out this question' : 'Type the answer'}
                          disabled={out || graded || busy || (hasTimer && remaining === 0)}
                          onChange={(event) =>
                            setAnswers((current) => ({ ...current, [entry.team]: event.target.value }))
                          }
                        />
                      </td>
                      <td>{entry.score}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="run-panel__actions">
            {!graded ? (
              <button type="submit" disabled={busy || following.length === 0}>
                Grade this question
              </button>
            ) : complete ? (
              <p className="alert alert--ok">
                Every team has answered every question. End the run to return to the challenge.
              </p>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  nextQuestion()
                }}
              >
                Next question →
              </button>
            )}
          </div>
        </form>

        <p className="muted">
          {following.length} team{following.length === 1 ? '' : 's'} following · {outCount} out this question · each score is saved to the challenge scoreboard as it is earned.
        </p>
      </section>
    )
  }

  return (
    <div className="run-panel">
      <h3 className="run-panel__title">Play this challenge with teams</h3>
      <p className="muted">
        Choose the teams that will follow it. Each team answers every one of the{' '}
        {questions.length} questions on its own. A wrong answer takes that team out until the next
        question, so it can rejoin, and each correct answer adds score straight to the challenge
        scoreboard.
      </p>

      <fieldset className="run-panel__teams">
        <legend>Teams following this challenge</legend>
        {teams.length === 0 && <p className="muted">Create a team first.</p>}
        {teams.map((team) => (
          <label key={team.id} className="checkbox">
            <input
              type="checkbox"
              checked={chosen.includes(team.id)}
              disabled={!chosen.includes(team.id) && chosen.length >= MAX_ENTRIES_PER_CHALLENGE}
              onChange={() => chooseTeam(team.id)}
            />
            <span>{team.name}</span>
          </label>
        ))}
        <p className="muted">
          Up to {MAX_ENTRIES_PER_CHALLENGE} teams can be scored in one challenge.
        </p>
      </fieldset>

      {error && <p className="alert alert--error">{error}</p>}

      <div className="run-panel__actions">
        <button type="button" disabled={chosen.length === 0} onClick={begin}>
          Start team run{chosen.length > 0 ? ` (${chosen.length})` : ''}
        </button>
      </div>
      <p className="muted">Or play solo below and record the score afterwards.</p>
    </div>
  )
}