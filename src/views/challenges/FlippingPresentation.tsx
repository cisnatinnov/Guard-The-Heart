import { useState } from 'react'
import { createWordAssemblyState, type WordAssemblyState } from '../../services/games'
import { MatchingCards } from './MatchingCards'
import type { ChallengeRun } from '../../services/games/teamRun'
import '../../styles/flipping.css'

export function FlippingPresentation({ board, run, teamName, seconds, complete, disabled, onFlip, onChooseTeam, teamSelectionDisabled }: {
  board?: WordAssemblyState
  run?: ChallengeRun | null
  teamName: (id: string) => string
  seconds?: number
  complete?: boolean
  disabled?: boolean
  onFlip?: (id: string) => void
  onChooseTeam?: (id: string) => void
  teamSelectionDisabled?: boolean
}) {
  const [waitingBoard] = useState(createWordAssemblyState)
  return <section className="flipping-presentation" aria-label="Flipping Card matching board">
    <img className="flipping-presentation__art" src="/ui/flipping-slide-03-reference.png" alt="" />
    <ol className="flipping-presentation__teams" aria-label="Roulette turn order">
      {Array.from({ length: 5 }, (_, slot) => {
        const entry = run?.runs[slot]
        const active = !!entry && !complete && slot === run?.nextTeamIndex
        return <li key={entry?.team ?? slot} aria-hidden={!entry || undefined} aria-current={active ? 'step' : undefined}>
          {entry && onChooseTeam ? <button className="flipping-presentation__team-button" type="button" aria-pressed={active} disabled={teamSelectionDisabled || complete} onClick={() => onChooseTeam(entry.team)}>{teamName(entry.team)}</button> : entry ? teamName(entry.team) : run ? '—' : ['Tim Pink', 'Tim Merah', 'Tim Biru', 'Tim Hijau', 'Tim Kuning'][slot]}{active && <span className="flipping-presentation__turn">Giliran</span>}
        </li>
      })}
    </ol>
    <MatchingCards board={board ?? waitingBoard} reference disabled={disabled || !board} onFlip={onFlip} />
    <span className="sr-only" role="timer">{seconds ?? 0}s</span>
    {complete && <p className="flipping-presentation__complete">All pairs matched!</p>}
    {!board && <p className="sr-only" role="status">Menunggu tantangan dimulai…</p>}
  </section>
}
