import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ChallengeRunController, type TeamAnswerResult } from '../../controllers/ChallengeRunController'
import { useTeams } from '../../hooks/useTeams'
import type { ChallengeGameId } from '../../services/games'
import { challengeQuestionsFor } from '../../services/games/challengeQuestions'
import {
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
 * Hosts the challenge either solo or as a team run. In a team run, selected
 * teams take turns answering one question at a time and each score is saved as
 * it is earned.
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
  const [timer, setTimer] = useState<{
    attemptKey: string | null
    remaining: number
  }>({ attemptKey: null, remaining: 0 })
  const answersFormRef = useRef<HTMLFormElement | null>(null)
  const timeoutAttemptKey = useRef<string | null>(null)

  const questionSet = challengeQuestionsFor(gameId)
  const questions = questionSet.questions
  const question = run ? ChallengeRunController.currentQuestion(gameId, run) : null
  const currentTurnTeam = run ? ChallengeRunController.teamForQuestion(run) : undefined
  const outCount = run ? eliminatedTeams(run).length : 0
  const complete = run ? isRunComplete(run) : false
  const questionIndex = run?.questionIndex ?? null
  const graded = run?.questionResolved ?? false
  const timerDuration = questionSet.secondsPerQuestion
  const hasTimer = timerDuration !== undefined
  const attemptKey = questionIndex !== null && currentTurnTeam
    ? `${questionIndex}:${currentTurnTeam.team}`
    : null
  const remaining =
    graded && hasTimer
      ? timer.remaining
      : attemptKey !== null && timer.attemptKey === attemptKey
        ? timer.remaining
        : timerDuration ?? 0

  useEffect(() => {
    if (!running || attemptKey === null || timerDuration === undefined || graded) return

    setTimer({ attemptKey, remaining: timerDuration })
    timeoutAttemptKey.current = null
    const interval = window.setInterval(() => {
      setTimer((current) => {
        if (current.attemptKey !== attemptKey || current.remaining === 0) return current
        return { ...current, remaining: Math.max(0, current.remaining - 1) }
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [running, attemptKey, timerDuration, graded])

  useEffect(() => {
    if (
      !running ||
      attemptKey === null ||
      !hasTimer ||
      remaining !== 0 ||
      graded ||
      busy ||
      timer.attemptKey !== attemptKey ||
      timeoutAttemptKey.current === attemptKey
    ) {
      return
    }

    timeoutAttemptKey.current = attemptKey
    answersFormRef.current?.requestSubmit()
  }, [running, attemptKey, hasTimer, remaining, graded, busy, timer.attemptKey])

  if (questions.length === 0) {
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
      setTimer({ attemptKey: null, remaining: timerDuration ?? 0 })
      timeoutAttemptKey.current = null
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
    setTimer({ attemptKey: null, remaining: timerDuration ?? 0 })
    timeoutAttemptKey.current = null
    setError(null)
  }

  async function submitAnswers(event: FormEvent) {
    event.preventDefault()
    if (!run || graded || busy) return
    setBusy(true)
    setError(null)
    try {
      const timedOut = hasTimer && remaining === 0
      if (!currentTurnTeam) return
      const outcome = await ChallengeRunController.answer({
        gameId,
        run,
        teamId: currentTurnTeam.team,
        answer: timedOut ? '' : answers[currentTurnTeam.team] ?? '',
        timedOut,
      })
      setRun(outcome.run)
      onUpdateRun(outcome.run)
      setResults([outcome.result])
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
            <p className="muted">
              {currentTurnTeam
                ? `${teamName(currentTurnTeam.team)} answers this question. If incorrect, the next team gets a chance.`
                : 'This question is resolved; move to the next question.'}
            </p>
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
                  const isCurrentTurn = currentTurnTeam?.team === entry.team
                  return (
                    <tr key={entry.team} className={out ? 'run-panel__row--out' : undefined}>
                      <td>{teamName(entry.team)}</td>
                      <td>
                        {result && !result.skipped ? (
                          <span className={`badge${result.eliminated ? ' badge--muted' : ''}`}>
                            {result.eliminated ? 'Out this question' : 'Answered'}
                          </span>
                        ) : isCurrentTurn ? (
                          <span className="badge">Answering</span>
                        ) : (
                          <span className="badge badge--muted">Waiting</span>
                        )}
                        {result && !result.skipped && (
                          <span
                            className={
                              result.correct
                                ? 'run-panel__verdict'
                                : 'run-panel__verdict run-panel__verdict--wrong'
                            }
                          >
                            {result.timedOut
                              ? ' time up'
                              : result.bitten
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
                          placeholder={
                            isCurrentTurn
                              ? 'Type the answer'
                              : result
                                ? 'Answered this question'
                                : "Waiting for this team's turn"
                          }
                          disabled={!isCurrentTurn || out || graded || busy || (hasTimer && remaining === 0)}
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
              <button type="submit" disabled={busy || !currentTurnTeam}>
                {run.attemptedTeams.length === 0 ? 'Grade this question' : 'Next team answer'}
              </button>
            ) : complete ? (
              <p className="alert alert--ok">
                All questions have been answered. End the run to return to the challenge.
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
          One team answers at a time · a wrong answer passes this question to the next team ·{' '}
          {outCount} team{outCount === 1 ? '' : 's'} already tried this question.
        </p>
      </section>
    )
  }

  return (
    <div className="run-panel">
      <h3 className="run-panel__title">Play this challenge with teams</h3>
      <p className="muted">
        Choose the participating teams. One team answers at a time. If its answer is wrong, the next
        team in selection order can try that same question. A correct answer or time-up moves the run
        to the next question. Each team's score is saved straight to the challenge scoreboard.
      </p>

      <fieldset className="run-panel__teams">
        <legend>Teams taking turns in this challenge</legend>
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