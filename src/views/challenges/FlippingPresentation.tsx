import { useState } from 'react'
import { createWordAssemblyState, type WordAssemblyState } from '../../services/games'
import { MatchingCards } from './MatchingCards'
import type { ChallengeRun } from '../../services/games/teamRun'
import '../../styles/flipping.css'

export function FlippingPresentation({ board, run, teamName, complete, disabled, onFlip, onChooseTeam, teamSelectionDisabled }: {
  board?: WordAssemblyState
  run?: ChallengeRun | null
  teamName: (id: string) => string
  complete?: boolean
  disabled?: boolean
  onFlip?: (id: string) => void
  onChooseTeam?: (id: string) => void
  teamSelectionDisabled?: boolean
}) {
  const [waitingBoard] = useState(createWordAssemblyState)
  return <section className="flipping-presentation" aria-label="Flipping Card matching board">
    <img className="flipping-presentation__art" src="/ui/flipping-slide-03-reference.png" alt="" />
    <ol className="flipping-presentation__teams" aria-label="Select the active team">
      {Array.from({ length: 5 }, (_, slot) => {
        const entry = run?.runs[slot]
        const active = !!entry && !complete && slot === run?.nextTeamIndex
        return <li key={entry?.team ?? slot} aria-hidden={!entry || undefined} aria-current={active ? 'step' : undefined}>
          {entry && onChooseTeam ? <button className="flipping-presentation__team-button" type="button" title={teamName(entry.team)} aria-pressed={active} disabled={teamSelectionDisabled || complete} onClick={() => onChooseTeam(entry.team)}><span className="flipping-presentation__team-name">{teamName(entry.team)}</span></button> : <span className="flipping-presentation__team-name" title={entry ? teamName(entry.team) : undefined}>{entry ? teamName(entry.team) : run ? '—' : ['Tim Pink', 'Tim Merah', 'Tim Biru', 'Tim Hijau', 'Tim Kuning'][slot]}</span>}{active && <span className="flipping-presentation__turn">Giliran</span>}
        </li>
      })}
    </ol>
    <MatchingCards board={board ?? waitingBoard} reference disabled={disabled || !board} onFlip={onFlip} />
    {complete && <p className="flipping-presentation__complete">All pairs matched!</p>}
    {!board && <p className="sr-only" role="status">Menunggu tantangan dimulai…</p>}
  </section>
}
