import { useState } from 'react'
import { teamColour } from '../../services/defaultTeams'
import { createWordAssemblyState, type WordAssemblyState } from '../../services/games'
import { MatchingCards } from './MatchingCards'
import type { ChallengeRun } from '../../services/games/teamRun'
import { MATCHING_PREVIEW_SECONDS } from '../../services/games/wordAssembly'
import { useRunCountdown } from './useRunCountdown'
import '../../styles/flipping.css'

export function FlippingPresentation({ board, run, teamName, teamGP, teamIds, complete, disabled, onFlip, onChooseTeam, teamSelectionDisabled }: {
  board?: WordAssemblyState
  run?: ChallengeRun | null
  teamName: (id: string) => string
  teamGP: (id: string) => number | undefined
  teamIds?: readonly string[]
  complete?: boolean
  disabled?: boolean
  onFlip?: (id: string) => void
  onChooseTeam?: (id: string) => void
  teamSelectionDisabled?: boolean
}) {
  const [waitingBoard] = useState(createWordAssemblyState)
  const previewRemaining = useRunCountdown(run?.matchingPreviewDeadline)
  const previewing = (previewRemaining ?? 0) > 0
  return <section className="flipping-presentation" aria-label="Flipping Connect matching board">
    <img className="flipping-presentation__art" src="/ui/flipping-slide-03-reference.png" alt="" />
    {previewing && <div className="flipping-presentation__close-timer" role="timer" aria-label="Cards preview countdown">Hafalkan kartu: {Math.min(MATCHING_PREVIEW_SECONDS, previewRemaining!)}s</div>}
    <ol className="flipping-presentation__teams" aria-label="Select the active team">
      {Array.from({ length: 5 }, (_, slot) => {
        const entry = run?.runs[slot]
        const teamId = entry?.team ?? (!run ? teamIds?.[slot] : undefined)
        const active = !!entry && !complete && slot === run?.nextTeamIndex
        return <li key={teamId ?? slot} className={`team-colour--${teamId ? teamColour(teamName(teamId)) ?? 'neutral' : 'neutral'}`} aria-hidden={!teamId || undefined} aria-current={active ? 'step' : undefined}>
          {entry && onChooseTeam ? <button className="flipping-presentation__team-button" type="button" aria-label={teamName(entry.team)} title={teamName(entry.team)} aria-pressed={active} disabled={teamSelectionDisabled || complete || previewing} onClick={() => onChooseTeam(entry.team)}><span className="flipping-presentation__team-name">{teamName(entry.team)}</span><span className="flipping-presentation__team-gp">{teamGP(entry.team) ?? '—'} GP</span></button> : <div className="flipping-presentation__team-info"><span className="flipping-presentation__team-name" title={teamId ? teamName(teamId) : undefined}>{teamId ? teamName(teamId) : run ? '—' : ['Tim Pink', 'Tim Merah', 'Tim Biru', 'Tim Hijau', 'Tim Kuning'][slot]}</span>{teamId && <span className="flipping-presentation__team-gp">{teamGP(teamId) ?? '—'} GP</span>}</div>}{active && <span className="flipping-presentation__turn">Giliran</span>}
        </li>
      })}
    </ol>
    <MatchingCards board={board ?? waitingBoard} reference revealAll={previewing} disabled={disabled || !board || previewing} onFlip={onFlip} />
    {complete && <p className="flipping-presentation__complete">All pairs matched!</p>}
    {!board && <p className="sr-only" role="status">Menunggu tantangan dimulai…</p>}
  </section>
}
