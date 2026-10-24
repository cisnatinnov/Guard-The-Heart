import { useEffect, useRef, useState } from 'react'
import { createWordAssemblyState, type WordAssemblyState } from '../../services/games'
import { MatchingCards } from './MatchingCards'
import type { ChallengeRun } from '../../services/games/teamRun'
import { MATCHING_PREVIEW_SECONDS, MATCHING_ATTEMPT_SECONDS } from '../../services/games/wordAssembly'
import { useRunCountdown } from './useRunCountdown'
import { useTurnOrder } from '../../hooks/useTurnOrder'
import { useActiveTeam } from '../../hooks/useActiveTeam'
import { orderTeams } from '../../services/turnOrder'
import '../../styles/flipping.css'

export function FlippingPresentation({ board, run, teamName, teamColour, teamGP, teamIds, complete, disabled, onFlip, onChooseTeam, teamSelectionDisabled }: {
  board?: WordAssemblyState
  run?: ChallengeRun | null
  teamName: (id: string) => string
  teamColour: (id: string) => string | null | undefined
  teamGP: (id: string) => number | undefined
  teamIds?: readonly string[]
  complete?: boolean
  disabled?: boolean
  onFlip?: (id: string) => void
  onChooseTeam?: (id: string) => void
  teamSelectionDisabled?: boolean
}) {
  const [waitingBoard] = useState(createWordAssemblyState)
  const order = useTurnOrder()
  const activeTeamId = useActiveTeam() ?? run?.runs[run.nextTeamIndex]?.team
  const orderedTeams = orderTeams((run ? run.runs.map((entry) => entry.team) : teamIds ?? []).map((id) => ({ id, name: teamName(id), colour: teamColour(id) })), order)
  const previewRemaining = useRunCountdown(run?.matchingPreviewDeadline)
  const previewing = (previewRemaining ?? 0) > 0
  const remaining = useRunCountdown(run?.matchingDeadline)
  const expired = remaining === 0 && !complete
  const previousBoard = useRef(board)
  const previousPreview = useRef(previewing)
  const [feedback, setFeedback] = useState<'closed' | 'match' | 'mismatch' | null>(null)
  useEffect(() => {
    const previous = previousBoard.current
    const wasPreviewing = previousPreview.current
    previousBoard.current = board
    previousPreview.current = previewing
    if (wasPreviewing && !previewing && board && previous && board.board.map((card) => card.id).join(',') === previous.board.map((card) => card.id).join(',')) {
      setFeedback('closed')
    } else if (!board || !previous || previewing || board.board.map((card) => card.id).join(',') !== previous.board.map((card) => card.id).join(',')) {
      setFeedback(null)
    } else if (board.matchedCardIds.length > previous.matchedCardIds.length) {
      setFeedback('match')
    } else if (board.mismatches > previous.mismatches) {
      setFeedback('mismatch')
    } else if (board.revealed.length === 1) {
      setFeedback(null)
    }
  }, [board, previewing])
  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(null), 1200)
    return () => window.clearTimeout(timeout)
  }, [feedback])
  const pop = previewing ? 'opened' : feedback

  return <section className="flipping-presentation" aria-label="Flipping Connect matching board">
    <img className="flipping-presentation__art" src="/ui/flipping-slide-03-reference.png" alt="" />
    {previewing && <div className="flipping-presentation__close-timer" role="timer" aria-label="Cards preview countdown">Memorize the cards: {Math.min(MATCHING_PREVIEW_SECONDS, previewRemaining!)}s</div>}
    {run && !previewing && !complete && <div className={`flipping-presentation__attempt-timer${expired ? ' is-expired' : ''}`} role="timer" aria-label="Matching time remaining">
      {!run.matchingAnswerId ? "Right Answer required" : expired ? "Time's up!" : `${Math.min(MATCHING_ATTEMPT_SECONDS, remaining ?? MATCHING_ATTEMPT_SECONDS)}s`}
    </div>}
    <ol className="flipping-presentation__teams" aria-label="Select the active team">
      {Array.from({ length: 5 }, (_, slot) => {
        const teamId = orderedTeams[slot]?.id
        const entry = run?.runs.find((entry) => entry.team === teamId)
        const active = !!teamId && !complete && teamId === activeTeamId
        return <li key={teamId ?? slot} className={`team-colour--${teamId ? teamColour(teamId) ?? 'neutral' : 'neutral'}`} aria-hidden={!teamId || undefined} aria-current={active ? 'step' : undefined}>
          {entry && onChooseTeam ? <button className="flipping-presentation__team-button" type="button" aria-label={teamName(entry.team)} title={teamName(entry.team)} aria-pressed={active} disabled={teamSelectionDisabled || previewing} onClick={() => onChooseTeam(entry.team)}><span className="flipping-presentation__team-name">{teamName(entry.team)}</span><span className="flipping-presentation__team-gp">{teamGP(entry.team) ?? '—'} GP</span></button> : <div className="flipping-presentation__team-info"><span className="flipping-presentation__team-name" title={teamId ? teamName(teamId) : undefined}>{teamId ? teamName(teamId) : run ? '—' : ['Team Yellow', 'Team Red', 'Team Blue', 'Team Pink', 'Team Green'][slot]}</span>{teamId && <span className="flipping-presentation__team-gp">{teamGP(teamId) ?? '—'} GP</span>}</div>}{active && <span className="flipping-presentation__turn">Your Turn</span>}
        </li>
      })}
    </ol>
    <MatchingCards board={board ?? waitingBoard} reference revealAll={previewing} disabled={disabled || !board || previewing || expired} onFlip={onFlip} />
    {pop && !expired && <div className={`flipping-presentation__feedback${pop === 'match' ? ' is-match' : pop === 'mismatch' ? ' is-mismatch' : ''}`} role="status" aria-live="polite">
      <b>{pop === 'opened' ? 'Card opened' : pop === 'closed' ? 'Card closed' : pop === 'match' ? 'Match!' : 'Mismatch!'}</b>
    </div>}
    {complete && <p className="flipping-presentation__complete">All pairs matched!</p>}
    {!board && <p className="sr-only" role="status">Waiting for the challenge to start…</p>}
  </section>
}
