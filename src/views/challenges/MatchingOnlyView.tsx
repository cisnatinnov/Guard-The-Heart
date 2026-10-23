import { useEffect, useState } from 'react'
import { ChallengeRunController } from '../../controllers/ChallengeRunController'
import { useTeams } from '../../hooks/useTeams'
import { isRunComplete, selectMatchingTeam, teamForQuestion, type ChallengeRun } from '../../services/games/teamRun'
import { MATCHING_MISMATCH_MS, MATCHING_ATTEMPT_SECONDS } from '../../services/games/wordAssembly'
import { useRunCountdown } from './useRunCountdown'
import { FlippingPresentation } from './FlippingPresentation'
import { useActiveTeam } from '../../hooks/useActiveTeam'
import { publishEventTimer, readEventTimer } from '../../services/eventTimer'

export function MatchingOnlyView({ challengeId, sharedRun, canControl, onStart, onUpdate, onEnd }: {
  challengeId: string
  sharedRun: ChallengeRun | null
  canControl: boolean
  onStart?: (run: ChallengeRun) => void | Promise<void>
  onUpdate?: (run: ChallengeRun) => Promise<void>
  onEnd?: () => void
}) {
  // Keep balances available for teams in an existing run even after deactivation.
  const { teams } = useTeams({ includeInactive: true })
  const activeTeams = teams.filter((team) => team.status === 'active')
  const run = sharedRun?.matchingOnly ? sharedRun : null
  const [chosen, setChosen] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const complete = !!run && isRunComplete(run)
  const remaining = useRunCountdown(run?.matchingDeadline)
  const expired = remaining === 0 && !complete
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
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setBusy(false))
  }, [canControl, run, onUpdate, busy, activeTeamId, previewRemaining])
  useEffect(() => {
    if (!canControl || !run || run.matchingDeadline !== undefined || !onUpdate || complete) return
    // Give legacy untimed runs one saved deadline; reload never extends it.
    void onUpdate({ ...run, matchingDeadline: Math.max(Date.now(), run.matchingPreviewDeadline ?? 0) + MATCHING_ATTEMPT_SECONDS * 1000 })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
  }, [canControl, run, onUpdate, complete])
  const team = run ? teamForQuestion(run) : undefined
  const teamName = (id: string) => teams.find((entry) => entry.id === id)?.name ?? 'Team'
  useEffect(() => {
    if (!canControl || !run || !onUpdate || busy || complete) return
    const mismatch = run.matchingBoard?.revealed.length === 2
    if (!mismatch) return
    const timeout = window.setTimeout(() => {
      setBusy(true)
      void ChallengeRunController.finishMatchingTurn({ ...run, matchingCloseDeadline: undefined }).then(onUpdate)
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
        .finally(() => setBusy(false))
    }, Math.min(MATCHING_MISMATCH_MS, Math.max(0, (run.matchingCloseDeadline ?? 0) - Date.now())))
    return () => window.clearTimeout(timeout)
  }, [canControl, run, onUpdate, busy, complete])

  async function start() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      let next = ChallengeRunController.startMatchingOnly(challengeId, chosen)
      const selectedIndex = next.runs.findIndex((entry) => entry.team === readEventTimer().activeTeamId)
      if (selectedIndex >= 0) next = { ...next, nextTeamIndex: selectedIndex }
      publishEventTimer({ ...readEventTimer(), activeTeamId: next.runs[next.nextTeamIndex]?.team ?? null })
      await onStart?.(next)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  async function flip(id: string) {
    if (!run || busy || expired) return
    setBusy(true)
    setError(null)
    try { await onUpdate?.(await ChallengeRunController.flipMatchingOnly(run, id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
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
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  const presentation = <FlippingPresentation board={run?.matchingBoard} run={run} teamName={teamName} teamColour={(id) => teams.find((team) => team.id === id)?.colour} teamIds={activeTeams.map((team) => team.id)}
    teamGP={(teamId) => teams.find((entry) => entry.id === teamId)?.total_gp}
    complete={complete} disabled={busy || complete || expired || run?.matchingDeadline === undefined}
    onFlip={canControl ? (id) => void flip(id) : undefined}
    onChooseTeam={canControl ? (id) => void chooseTeam(id) : undefined} teamSelectionDisabled={busy || run?.matchingBoard?.revealed.length === 2} />
  if (!canControl) return presentation
  return <section className="view matching-only">
    <h2>Challenge 2 - Flipping Connect</h2>
    <p>All cards open for 5 seconds at the start, then close for matching. Each team has 15 seconds after the preview. When time is up, cards lock until another team is selected. Match identical pictures to complete all ten pairs. Both unmatched cards appear briefly, then close; matched pairs stay open. Changing to another team reshuffles the board, clears previous matches and starts a new 5-second preview.</p>
    {error && <p className="alert alert--error">{error}</p>}
    {run ? <>
      <header className="matching-only__header"><h3>Matched pairs: {run.questionIndex}/10 · {team ? teamName(team.team) : ''}</h3><button type="button" className="ghost" disabled={busy} onClick={onEnd}>End run</button></header>
      {presentation}
    </> : <>
      <div className="run-panel__teams" aria-label="Teams following this challenge">
        {activeTeams.map((entry) => <label key={entry.id}><input type="checkbox" checked={chosen.includes(entry.id)} disabled={busy || (!chosen.includes(entry.id) && chosen.length >= 5)} onChange={() => setChosen((current) => current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id])} />{entry.name}</label>)}
      </div>
      <button type="button" disabled={busy || !chosen.length} onClick={() => void start()}>Start team run ({chosen.length})</button>
    </>}
  </section>
}
