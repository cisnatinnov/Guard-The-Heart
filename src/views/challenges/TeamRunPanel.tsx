import { QuestionPicker } from './QuestionPicker'
import { ChallengeTurnOrder } from './ChallengeTurnOrder'
import { englishText } from '../../services/english'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ChallengeRunController, type TeamAnswerResult } from '../../controllers/ChallengeRunController'
import { useTeams } from '../../hooks/useTeams'
import { WORD_ASSEMBLY_SECONDS_PER_MATCH, type ChallengeGameId } from '../../services/games'
import { challengeQuestionsFor } from '../../services/games/challengeQuestions'
import {
  flipRunCard,
  eliminatedTeams,
  isRunComplete,
  isMatchingQuestionUnlocked,
  type ChallengeRun,
} from '../../services/games/teamRun'
import { MAX_ENTRIES_PER_CHALLENGE } from '../../services/rankRules'
import { MatchingCards } from './MatchingCards'
import { QuestionPresentation } from './QuestionPresentation'
import { RouletteOrder } from './RouletteOrder'
import { useRunCountdown } from './useRunCountdown'
import { useTurnOrder } from '../../hooks/useTurnOrder'
import { useActiveTeam } from '../../hooks/useActiveTeam'
import { orderTeams } from '../../services/turnOrder'
import { readEventTimer, publishEventTimer } from '../../services/eventTimer'

export interface TeamRunPanelProps {
  gameId: ChallengeGameId
  challengeId: string
  sharedRun: ChallengeRun | null
  canControl: boolean
  /** True while a team run is under way, which hides the solo screen. */
  running: boolean
  onStartRun: (run: ChallengeRun) => void
  onUpdateRun: (run: ChallengeRun) => void | Promise<void>
  onEndRun: () => void
}

/**
 * Hosts the challenge as a team run. In a team run, selected
 * teams take turns answering one question at a time and each score is saved as
 * it is earned.
 */
export function TeamRunPanel({
  gameId,
  challengeId,
  sharedRun,
  canControl,
  running,
  onStartRun,
  onUpdateRun,
  onEndRun,
}: TeamRunPanelProps) {
  const { teams } = useTeams()
  const turnOrder = useTurnOrder()
  const activeTeamId = useActiveTeam()
  const [run, setRun] = useState<ChallengeRun | null>(null)
  const [questionIds, setQuestionIds] = useState(() => challengeQuestionsFor(gameId).questions.slice(0, 10).map((question) => question.id))
  const [chosen, setChosen] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<TeamAnswerResult[]>([])
  const [answerMode, setAnswerMode] = useState<'self' | 'pass'>('self')
  const [opponentId, setOpponentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timer, setTimer] = useState<{
    attemptKey: string | null
    remaining: number
  }>({ attemptKey: null, remaining: 0 })
  const answersFormRef = useRef<HTMLFormElement | null>(null)
  const timeoutAttemptKey = useRef<string | null>(null)

  useEffect(() => {
    setRun(sharedRun)
  }, [sharedRun])

  const questionSet = challengeQuestionsFor(gameId)
  const questions = questionSet.questions
  const question = run ? ChallengeRunController.currentQuestion(gameId, run) : null
  const currentTurnTeam = run ? ChallengeRunController.teamForQuestion(run) : undefined
  const outCount = run ? eliminatedTeams(run).length : 0
  const complete = run ? isRunComplete(run) : false
  const questionIndex = run?.questionIndex ?? null
  const graded = run?.questionResolved ?? false
  const matching = gameId === 'word-assembly'
  const unlocked = !matching || !!run && isMatchingQuestionUnlocked(run)
  const choosingAnswerTeam = matching && run?.matchingPhase === 'choice'
  const matchedDelay = matching && run?.matchingPhase === 'matched-delay'
  const handoffDelay = matching && run?.matchingPhase === 'handoff-delay'
  const timerDuration = matching && !unlocked ? WORD_ASSEMBLY_SECONDS_PER_MATCH : questionSet.secondsPerQuestion
  const sharedRemaining = useRunCountdown(run?.turnDeadline)
  const hasTimer = timerDuration !== undefined && !choosingAnswerTeam
  const attemptKey = questionIndex !== null && currentTurnTeam
    ? `${questionIndex}:${currentTurnTeam.team}${matching ? `:${run?.matchingPhase}:${run?.matchingTurn}:${run?.turnDeadline}` : ''}`
    : null
  const remaining =
    matching || run?.turnDeadline !== undefined ? sharedRemaining ?? timerDuration ?? 0 : graded && hasTimer
      ? timer.remaining
      : attemptKey !== null && timer.attemptKey === attemptKey
        ? timer.remaining
        : timerDuration ?? 0
  const answerOwnerId = !matching && answerMode === 'pass' && opponentId ? opponentId : currentTurnTeam?.team
  const answerOwnerAnswer = answerOwnerId ? answers[answerOwnerId] ?? '' : ''
  const timerExpired = gameId !== 'emoji-decode' && hasTimer && remaining === 0

  useEffect(() => {
    if (!canControl || busy || !run || (!matchedDelay && !handoffDelay) || remaining !== 0) return
    const updated = ChallengeRunController.finishMatchingTransition(run)
    if (updated === run) return
    setBusy(true)
    setRun(updated)
    void Promise.resolve(onUpdateRun(updated)).catch((cause: unknown) => {
      setError(englishText(cause instanceof Error ? cause.message : String(cause)))
    }).finally(() => setBusy(false))
  }, [canControl, busy, run, matchedDelay, handoffDelay, remaining, onUpdateRun])

  useEffect(() => {
    if (run?.turnDeadline !== undefined || matching || !running || !unlocked || attemptKey === null || timerDuration === undefined || graded) return

    setTimer({ attemptKey, remaining: timerDuration })
    timeoutAttemptKey.current = null
    const interval = window.setInterval(() => {
      setTimer((current) => {
        if (current.attemptKey !== attemptKey || current.remaining === 0) return current
        return { ...current, remaining: Math.max(0, current.remaining - 1) }
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [matching, running, unlocked, attemptKey, timerDuration, graded, run?.turnDeadline])

  // Each new team turn starts with its own answer, never a pass selection left
  // over from the preceding turn.
  useEffect(() => {
    if (!running || attemptKey === null) return
    setAnswerMode('self')
    setOpponentId('')
  }, [running, attemptKey])

  useEffect(() => {
    if (
      gameId === 'emoji-decode' ||
      !running ||
      !canControl ||
      matchedDelay ||
      handoffDelay ||
      attemptKey === null ||
      !hasTimer ||
      remaining !== 0 ||
      graded ||
      busy ||
      (!matching && run?.turnDeadline === undefined && timer.attemptKey !== attemptKey) ||
      timeoutAttemptKey.current === attemptKey
    ) {
      return
    }

    timeoutAttemptKey.current = attemptKey
    if (matching && !unlocked && run) {
      setBusy(true)
      void ChallengeRunController.finishMatchingTurn(run, true).then(async (updated) => {
        setRun(updated)
        await onUpdateRun(updated)
      }).catch((cause: unknown) => setError(englishText(cause instanceof Error ? cause.message : String(cause))))
        .finally(() => setBusy(false))
      return
    }
    answersFormRef.current?.requestSubmit()
  }, [gameId, running, canControl, matching, unlocked, matchedDelay, handoffDelay, run, onUpdateRun, attemptKey, hasTimer, remaining, graded, busy, timer.attemptKey])

  useEffect(() => {
    if (!canControl || busy || run?.matchingPhase !== 'matching' || !run.matchingBoard || run.matchingBoard.revealed.length !== 2 || unlocked) return
    const timeout = window.setTimeout(() => {
      setBusy(true)
      void ChallengeRunController.finishMatchingTurn(run).then(async (updated) => {
        setRun(updated)
        await onUpdateRun(updated)
        setResults([])
      }).catch((cause: unknown) => setError(englishText(cause instanceof Error ? cause.message : String(cause))))
        .finally(() => setBusy(false))
    }, 900)
    return () => window.clearTimeout(timeout)
  }, [canControl, busy, unlocked, run, onUpdateRun])

  useEffect(() => {
    if (!canControl || !running || !run || busy || graded || matching || !activeTeamId) return
    const index = run.runs.findIndex((entry) => entry.team === activeTeamId)
    if (index < 0 || index === run.nextTeamIndex || run.attemptedTeams.includes(activeTeamId)) return
    const next = { ...run, nextTeamIndex: index, turnDeadline: Date.now() + (run.secondsPerTurn ?? 15) * 1000 }
    setRun(next)
    void Promise.resolve(onUpdateRun(next)).catch((cause: unknown) => setError(String(cause)))
  }, [activeTeamId, canControl, running, run, busy, graded, matching, onUpdateRun])

  async function flipCard(cardId: string) {
    if (!run || busy || !canControl) return
    setBusy(true)
    try {
      const updated = flipRunCard(run, cardId)
      setRun(updated)
      await onUpdateRun(updated)
    } catch (cause) {
      setError(englishText(cause instanceof Error ? cause.message : String(cause)))
    } finally {
      setBusy(false)
    }
  }

  async function chooseAnswerTeam(teamId: string) {
    if (!run || busy || !canControl) return
    setBusy(true)
    try {
      const updated = ChallengeRunController.chooseAnswerTeam(run, teamId)
      setRun(updated)
      setAnswers({})
      setResults([])
      await onUpdateRun(updated)
    } catch (cause) {
      setError(englishText(cause instanceof Error ? cause.message : String(cause)))
    } finally {
      setBusy(false)
    }
  }

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
      const ordered = orderTeams(teams.filter((team) => chosen.includes(team.id)), turnOrder)
      const started = ChallengeRunController.start({ gameId, challengeId, teamIds: ordered.map((team) => team.id), questionIds })
      const selectedIndex = started.runs.findIndex((team) => team.team === activeTeamId)
      if (selectedIndex >= 0) started.nextTeamIndex = selectedIndex
      publishEventTimer({ ...readEventTimer(), activeTeamId: started.runs[started.nextTeamIndex]?.team ?? null })
      setRun(started)
      onStartRun(started)
      setAnswers({})
      setResults([])
      setAnswerMode('self')
      setOpponentId('')
      setTimer({ attemptKey: null, remaining: timerDuration ?? 0 })
      timeoutAttemptKey.current = null
      setError(null)
    } catch (cause) {
      setError(englishText(cause instanceof Error ? cause.message : String(cause)))
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

  async function submitAnswers(event?: FormEvent, manualCorrect?: boolean) {
    event?.preventDefault()
    if (!run || !unlocked || choosingAnswerTeam || graded || busy || (manualCorrect === undefined && !timerExpired && !answerOwnerAnswer.trim())) return
    setBusy(true)
    setError(null)
    try {
      const timedOut = timerExpired
      if (!currentTurnTeam) return
      const submittedAnswer = timedOut ? '' : answerOwnerAnswer
      if (!matching && answerMode === 'pass' && opponentId) {
        const passed = await ChallengeRunController.pass({ gameId, run, fromTeamId: currentTurnTeam.team, toTeamId: opponentId, answer: submittedAnswer, manualCorrect })
        setAnswers({})
        setResults([])
        setAnswerMode('self')
        setOpponentId('')
        if (passed.questionResolved) {
          const advanced = ChallengeRunController.nextQuestion(passed)
          setRun(advanced)
          await onUpdateRun(advanced)
        } else {
          setRun(passed)
          await onUpdateRun(passed)
        }
        return
      }
      const outcome = await ChallengeRunController.answer({
        gameId,
        run,
        teamId: currentTurnTeam.team,
        answer: submittedAnswer,
        timedOut,
        manualCorrect,
      })
      if (outcome.result.error) throw new Error(outcome.result.error)
      setResults([outcome.result])
      setAnswers({})

      // A correct answer (or the final unsuccessful attempt) completes this
      // question. Advance immediately so the next question opens ready for the
      // new team's own answer.
      if (outcome.run.questionResolved) {
        const advanced = ChallengeRunController.nextQuestion(outcome.run)
        setRun(advanced)
        await onUpdateRun(advanced)
        setResults([])
        setAnswerMode('self')
        setOpponentId('')
        return
      }

      // Incorrect answers and timeouts remain on this question. The run state
      // has already moved its turn to the next eligible team.
      setRun(outcome.run)
      await onUpdateRun(outcome.run)
      setAnswerMode('self')
      setOpponentId('')
    } catch (cause) {
      setError(englishText(cause instanceof Error ? cause.message : String(cause)))
    } finally {
      setBusy(false)
    }
  }

  async function nextQuestion() {
    if (!run) return
    const advanced = ChallengeRunController.nextQuestion(run)
    setRun(advanced)
    await onUpdateRun(advanced)
    setAnswers({})
    setResults([])
    setAnswerMode('self')
    setOpponentId('')
    setError(null)
  }

  const teamName = (id: string) => teams.find((team) => team.id === id)?.name ?? 'Team'

  if (running && run && question) {
    return (
      <section className="run-panel">
        <ChallengeTurnOrder teamIds={run.runs.map((entry) => entry.team)} disabled={busy} onShuffle={(ids) => {
          const reordered = { ...run, runs: ids.map((id) => run.runs.find((entry) => entry.team === id)!), nextTeamIndex: 0 }
          setRun(reordered)
          void Promise.resolve(onUpdateRun(reordered)).catch((cause: unknown) => setError(String(cause)))
        }} />
        <header className="run-panel__header">
          <div>
            <h3 className="run-panel__title">
              Team run · question {run.questionIndex + 1} of {run.questionCount}
            </h3>

            {unlocked && <p className="muted">{englishText(question.hint)}</p>}
            <p className="muted">
              {currentTurnTeam
              ? matching && !unlocked ? matchedDelay ? `Pair matched. The question unlocks in ${remaining} seconds.` : `${teamName(currentTurnTeam.team)} matches the cards now.` : handoffDelay ? `Next team gets a chance in ${remaining} seconds.` : choosingAnswerTeam ? `${teamName(currentTurnTeam.team)} chooses who will answer.` : `${teamName(currentTurnTeam.team)} answers this question.`
                : 'This question is resolved; move to the next question.'}
            </p>
          </div>
          {canControl && <div className="run-panel__actions">
            <button type="button" className="ghost" onClick={end}>
              End run
            </button>
          </div>}
        </header>

        {error && <p className="alert alert--error">{error}</p>}
        {gameId === 'emoji-decode' && remaining === 0 && !graded && <p role="status" className="alert alert--info">Reminder: 15 seconds have passed. Answers remain open.</p>}
        {unlocked && <QuestionPresentation gameId={gameId} question={question}
          counter={`Question ${run.questionIndex + 1} / ${run.questionCount}${currentTurnTeam ? ` · ${teamName(currentTurnTeam.team)}` : ''}`}
          seconds={hasTimer ? remaining : undefined} />}


        {matching && <>
          <p className="muted">Match a pair first to unlock its question. Each team gets two answer attempts. A correct answer returns to matching; otherwise the same question passes to the next eligible team until everyone has tried.</p>
          <RouletteOrder run={run} teamName={teamName} />
          {hasTimer && !unlocked && <p className="matching-timer" role="timer" aria-label="Matching time remaining">{remaining}s</p>}
          {handoffDelay && <p className="matching-timer" role="timer" aria-label="Next team chance in">Next team in {remaining}s</p>}
          {!unlocked && run.matchingBoard && <MatchingCards board={run.matchingBoard}
            disabled={!canControl || busy || matchedDelay || remaining === 0} onFlip={(cardId) => void flipCard(cardId)} />}
          {choosingAnswerTeam && canControl && currentTurnTeam && <fieldset className="matching-choice" disabled={busy}>
            <legend>{teamName(currentTurnTeam.team)} matched a pair. Who will answer?</legend>
            <button type="button" onClick={() => void chooseAnswerTeam(currentTurnTeam.team)}>Answer myself</button>
            <label>Give the question to another team
              <select aria-label="Opponent team" value={opponentId} onChange={(event) => setOpponentId(event.target.value)}>
                <option value="">Choose opponent</option>
                {run.runs.filter((entry) => entry.team !== currentTurnTeam.team && !run.attemptedTeams.includes(entry.team))
                  .map((entry) => <option key={entry.team} value={entry.team}>{teamName(entry.team)}</option>)}
              </select>
            </label>
            <button type="button" disabled={!opponentId} onClick={() => void chooseAnswerTeam(opponentId)}>Give question</button>
          </fieldset>}
          {unlocked && !choosingAnswerTeam && !graded && <p className="muted">Answer attempts: {run.answerAttempts ?? 0}/2</p>}
        </>}

        {handoffDelay && <p className="muted" role="status">The question is ready. The next team can answer when the countdown ends.</p>}
        {unlocked && !choosingAnswerTeam && !handoffDelay && <form ref={answersFormRef} className="run-panel__answers" onSubmit={submitAnswers}>
          {canControl && !matching && !graded && currentTurnTeam && (
            <fieldset className="run-panel__teams">
              <legend>How will {teamName(currentTurnTeam.team)} play?</legend>
              <label className="checkbox">
                <input name="answer-mode" type="radio" value="self" checked={answerMode === 'self'} onChange={() => setAnswerMode('self')} />
                <span className="checkbox__text">Answer yourself (+10 correct, −10 wrong)</span>
              </label>
              <label className="checkbox">
                <input name="answer-mode" type="radio" value="pass" checked={answerMode === 'pass'} onChange={() => setAnswerMode('pass')} />
                <span className="checkbox__text">Pass to an opponent</span>
              </label>
              {answerMode === 'pass' && <select aria-label="Opponent team" value={opponentId} onChange={(event) => setOpponentId(event.target.value)}>
                <option value="">Choose opponent</option>
                {run.runs
                  .filter((entry) => entry.team !== currentTurnTeam.team && !run.attemptedTeams.includes(entry.team))
                  .map((entry) => <option key={entry.team} value={entry.team}>{teamName(entry.team)}</option>)}
              </select>}
            </fieldset>
          )}
          {hasTimer && gameId !== 'emoji-decode' && (
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
                  const isAnswering = answerOwnerId === entry.team
                  return (
                    <tr key={entry.team} className={`${out ? 'run-panel__row--out ' : ''}${isAnswering ? 'run-panel__row--turn' : ''}`}>
                      <td>{teamName(entry.team)}</td>
                      <td>
                        {result && !result.skipped ? (
                          <span className={`badge${result.eliminated ? ' badge--muted' : ''}`}>
                            {result.eliminated ? 'Out this question' : matching && !result.correct ? 'One attempt left' : 'Answered'}
                          </span>
                        ) : isAnswering ? (
                          <span className="badge">Answering</span>
                        ) : isCurrentTurn && answerMode === 'pass' ? (
                          <span className="badge badge--muted">Passed</span>
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
                        {question.options?.length ? (
                          <select
                            value={answers[entry.team] ?? ''}
                            aria-label={`${teamName(entry.team)} answer`}
                            disabled={!canControl || answerOwnerId !== entry.team || out || graded || busy || timerExpired}
                            onChange={(event) => setAnswers((current) => ({ ...current, [entry.team]: event.target.value }))}
                          >
                            <option value="">{isAnswering ? 'Choose an answer' : 'Waiting for this team'}</option>
                            {question.options.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={answers[entry.team] ?? ''}
                            maxLength={80}
                            aria-label={`${teamName(entry.team)} answer`}
                            placeholder={isAnswering ? 'Type the answer' : result ? 'Answered this question' : "Waiting for this team's turn"}
                            disabled={!canControl || answerOwnerId !== entry.team || out || graded || busy || timerExpired}
                            onChange={(event) => setAnswers((current) => ({ ...current, [entry.team]: event.target.value }))}
                          />
                        )}
                      </td>
                      <td>{entry.score}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {canControl && <div className="run-panel__actions">
            {!graded ? (
              <button type="submit" disabled={busy || !currentTurnTeam || (answerMode === 'pass' && !opponentId) || (!timerExpired && !answerOwnerAnswer.trim())}>
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
          </div>}
        </form>}

        <p className="muted">
          One team answers at a time · {matching ? 'two wrong attempts pass' : 'a wrong answer passes'} this question to the next team ·{' '}
          {outCount} team{outCount === 1 ? '' : 's'} already tried this question.
        </p>
      </section>
    )
  }

  if (!canControl) {
    return (
      <section className="run-panel" aria-live="polite">
        <h3 className="run-panel__title">Waiting for the team run</h3>
        <p className="muted">The public screen will update as soon as the admin starts this challenge.</p>
      </section>
    )
  }

  return (
    <div className="run-panel">
      <h3 className="run-panel__title">Play this challenge with teams</h3>
      <p className="muted">
        {matching
          ? 'Choose the participating teams. Turn Order controls the active team. A mismatch or a 20-second matching timeout moves to the next team. Match a pair, then answer yourself or give the question to another team. Each answering team has 15 seconds and two attempts.'
          : 'Choose the participating teams. One team answers at a time. Turn Order controls the active team. A wrong answer gives the next team a chance. The 15-second timer is a reminder only.'}
        {' '}Each team's score is saved straight to the challenge scoreboard.
      </p>

      <ChallengeTurnOrder />
      <QuestionPicker questions={questions} selected={questionIds} onChange={setQuestionIds} />
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
          Up to {MAX_ENTRIES_PER_CHALLENGE} teams can be scored. The turn order above determines who plays first.
        </p>
      </fieldset>

      {error && <p className="alert alert--error">{error}</p>}

      <div className="run-panel__actions">
        <button type="button" disabled={chosen.length === 0 || questionIds.length === 0} onClick={begin}>
          Start team run{chosen.length > 0 ? ` (${chosen.length})` : ''}
        </button>
      </div>
    </div>
  )
}
