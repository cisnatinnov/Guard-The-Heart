import { usePublicChallengeBoard } from '../../hooks/usePublicChallengeBoard'
import { beginMatchingBonus } from '../../services/challengeAnswers'
import { publishPublicDisplay } from '../../services/publicDisplay'
import { useChallengeAnswers } from '../../hooks/useChallengeAnswers'
import { englishText } from '../../services/english'
import { useEffect, useRef, useState } from 'react'
import { ChallengeRunController } from '../../controllers/ChallengeRunController'
import { useTeams } from '../../hooks/useTeams'
import { isRunComplete, selectMatchingTeam, teamForQuestion, type ChallengeRun } from '../../services/games/teamRun'
import { MATCHING_MISMATCH_MS } from '../../services/games/wordAssembly'
import { useRunCountdown } from './useRunCountdown'
import { FlippingPresentation } from './FlippingPresentation'
import { orderTeams } from '../../services/turnOrder'
import { useTurnOrder } from '../../hooks/useTurnOrder'
import { useActiveTeam } from '../../hooks/useActiveTeam'
import { publishEventTimer, readEventTimer } from '../../services/eventTimer'
import type { ChallengeAnswer } from '../../models'
import { ChallengeAnswerControls } from './ChallengeAnswerControls'
import { playMatchingCard, closeMatchingCards } from '../../services/games/matchingPlay'

export function MatchingOnlyView({ challengeId, sharedRun, canControl, onStart, onUpdate }: {
  challengeId: string
  sharedRun: ChallengeRun | null
  canControl: boolean
  onStart?: (run: ChallengeRun) => void | Promise<void>
  onUpdate?: (run: ChallengeRun) => Promise<void>
  onEnd?: () => void
}) {
  // Keep balances available for teams in an existing run even after deactivation.
  const { teams } = useTeams({ includeInactive: true })
  const answerState = useChallengeAnswers(challengeId)
  const publicBoard = usePublicChallengeBoard(challengeId, 'cards')
  const activeTeams = teams.filter((team) => team.status === 'active')
  const run = sharedRun?.matchingOnly ? sharedRun : null
  const order = useTurnOrder()
  const autoStarted = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const complete = !!run && isRunComplete(run)
  const expired = false
  const activeTeamId = useActiveTeam()
  const previewRemaining = useRunCountdown(run?.matchingPreviewDeadline)
  useEffect(() => {
    if (!canControl || !run || !onUpdate || busy || !activeTeamId || (previewRemaining ?? 0) > 0
      || run.matchingBoard?.revealed.length === 2 || !run.runs.some((entry) => entry.team === activeTeamId)
      || run.runs[run.nextTeamIndex]?.team === activeTeamId) return
    const next = selectMatchingTeam(run, activeTeamId)
    if (next === run) return
    setBusy(true)
    void onUpdate(next)
      .catch((cause: unknown) => setError(englishText(cause instanceof Error ? cause.message : String(cause))))
      .finally(() => setBusy(false))
  }, [canControl, run, onUpdate, busy, activeTeamId, previewRemaining])
  const team = run ? teamForQuestion(run) : undefined
  const teamName = (id: string) => teams.find((entry) => entry.id === id)?.name ?? 'Team'
  useEffect(() => {
    if (!run?.matchingAnswerId || busy || complete) return
    const mismatch = run.matchingBoard?.revealed.length === 2
    if (!mismatch) return
    const timeout = window.setTimeout(() => {
      setBusy(true)
      void closeMatchingCards(challengeId, run.matchingAnswerId!, run.matchingCloseDeadline ?? 0)
        .catch((cause: unknown) => setError(englishText(cause instanceof Error ? cause.message : String(cause))))
        .finally(() => setBusy(false))
    }, Math.min(MATCHING_MISMATCH_MS, Math.max(0, (run.matchingCloseDeadline ?? 0) - Date.now())))
    return () => window.clearTimeout(timeout)
  }, [challengeId, run, busy, complete])

  async function answered(answer: ChallengeAnswer) {
    publicBoard.reveal(false)
    if (!answer.correct) {
      if (run) await onUpdate?.({ ...run, matchingAnswerId: undefined, matchingDeadline: 0 })
      return
    }
    const participants = run?.runs.some((team) => team.team === answer.team) ? run.runs.map((team) => team.team) : [answer.team, ...activeTeams.filter((team) => team.id !== answer.team).map((team) => team.id)].slice(0, 5)
    const next = ChallengeRunController.startMatchingOnly(challengeId, participants)
    next.nextTeamIndex = next.runs.findIndex((entry) => entry.team === answer.team)
    next.matchingAnswerId = answer.id
    next.matchingDeadline = 0
    next.matchingPreviewDeadline = undefined
    if (run) await onUpdate?.(next)
    else await onStart?.(next)
  }
  useEffect(() => {
    if (!canControl || sharedRun || autoStarted.current || !activeTeams.length || activeTeams.length > 5) return
    autoStarted.current = true
    const participants = orderTeams(activeTeams, order).map((team) => team.id)
    const next = { ...ChallengeRunController.startMatchingOnly(challengeId, participants), matchingAnswerId: undefined, matchingDeadline: 0 }
    const selectedIndex = next.runs.findIndex((entry) => entry.team === readEventTimer().activeTeamId)
    if (selectedIndex >= 0) next.nextTeamIndex = selectedIndex
    publishEventTimer({ ...readEventTimer(), activeTeamId: next.runs[next.nextTeamIndex]?.team ?? null })
    void Promise.resolve(onStart?.(next)).catch((cause: unknown) => { autoStarted.current = false; setError(String(cause)) })
  }, [canControl, sharedRun, activeTeams, order, challengeId, onStart])

  useEffect(() => {
    if (!canControl || !run || !onUpdate || activeTeams.length > 5) return
    const missing = orderTeams(activeTeams, order).filter((entry) => !run.runs.some((team) => team.team === entry.id))
    if (!missing.length || run.runs.length + missing.length > 5) return
    void onUpdate({ ...run, runs: [...run.runs, ...missing.map((team) => ({ team: team.id, score: 0, state: 'following' as const, answered: 0, correct: 0 }))] }).catch((cause: unknown) => setError(String(cause)))
  }, [canControl, run, onUpdate, activeTeams, order])

  async function flip(id: string) {
    if (!run || busy || expired || !run.matchingAnswerId || !run.matchingDeadline) return
    setBusy(true)
    setError(null)
    try { await playMatchingCard(challengeId, run.matchingAnswerId, id) }
    catch (cause) { setError(englishText(cause instanceof Error ? cause.message : String(cause))) }
    finally { setBusy(false) }
  }
  async function chooseTeam(id: string) {
    if (!canControl || !run || busy || run.matchingBoard?.revealed.length === 2) return
    setBusy(true)
    setError(null)
    try {
      const next = selectMatchingTeam(run,id)
      await onUpdate?.(next)
      publishEventTimer({ ...readEventTimer(), activeTeamId: next.runs[next.nextTeamIndex]?.team ?? null })
    }
    catch (cause) { setError(englishText(cause instanceof Error ? cause.message : String(cause))) }
    finally { setBusy(false) }
  }
  useEffect(() => {
    if (canControl && !run?.matchingAnswerId && publicBoard.visible) publicBoard.reveal(false)
  }, [canControl, run?.matchingAnswerId, publicBoard])

  async function showCards() {
    if (!canControl || !run?.matchingAnswerId || busy) return
    setBusy(true)
    setError(null)
    try {
      await publishPublicDisplay('matching-cards', challengeId)
      const deadline = await beginMatchingBonus(run.matchingAnswerId)
      await onUpdate?.({ ...run, matchingDeadline: deadline, matchingPreviewDeadline: deadline })
      publicBoard.reveal(true)
    } catch (cause) { setError(englishText(cause instanceof Error ? cause.message : String(cause))) }
    finally { setBusy(false) }
  }

  const presentation = <FlippingPresentation board={run?.matchingBoard} run={run} teamName={teamName} teamColour={(id) => teams.find((team) => team.id === id)?.colour} teamIds={activeTeams.map((team) => team.id)}
    teamGP={(teamId) => teams.find((entry) => entry.id === teamId)?.total_gp}
    complete={complete} disabled={busy || complete || expired || !run?.matchingAnswerId || !run?.matchingDeadline}
    onFlip={(id) => void flip(id)}
    onChooseTeam={canControl ? (id) => void chooseTeam(id) : undefined} teamSelectionDisabled={busy || run?.matchingBoard?.revealed.length === 2} />
  if (!canControl) return <><ChallengeAnswerControls challengeId={challengeId} canControl={false} hideQuiz state={answerState} />{error && <p className="alert alert--error">{error}</p>}{publicBoard.visible ? presentation : <section className="public-board-placeholder" aria-label="Matching Cards waiting" role="region"><h2>Matching Cards</h2><p>Waiting for the host to show cards.</p></section>}</>
  return <section className="view matching-only">
    <h2>Challenge 2 - Matching Cards</h2>

    <ChallengeAnswerControls challengeId={challengeId} canControl state={answerState} matching onAnswer={answered} disabled={busy} />
    <p>A Right Answer earns 10 raw score and unlocks a fresh matching board: memorize the open cards for 5 seconds, then match pairs at your own pace. Each matched pair earns +5 raw score. Mismatches close after a short pause; mismatches never deduct score. A Wrong Answer deducts 10 raw score and does not unlock matching. Selecting another team ends the current bonus attempt.</p>
    {error && <p className="alert alert--error">{error}</p>}
    <div className="board-reveal-control">
      <button type="button" disabled={busy || !run?.matchingAnswerId} onClick={() => void showCards()}>Show cards</button>
      {publicBoard.visible && <button type="button" className="ghost" disabled={busy} onClick={() => {
        publicBoard.reveal(false)
        void publishPublicDisplay('flipping-connect', challengeId).catch((cause: unknown) => setError(englishText(cause instanceof Error ? cause.message : String(cause))))
      }}>Hide cards</button>}
      <p className="muted">{!run?.matchingAnswerId ? 'Answer correctly to unlock matching cards.' : publicBoard.visible ? 'Matching cards are visible on the public display.' : 'Click Show cards to start the five-second preview on the public display.'}</p>
    </div>
    {run && <>
      <header className="matching-only__header"><h3>Bonus pairs: {run.questionIndex}/10 · {team ? teamName(team.team) : ''}</h3></header>
      {presentation}
    </>}
  </section>
}
