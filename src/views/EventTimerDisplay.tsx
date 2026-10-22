import { useEffect, useState } from 'react'
import { useTeams } from '../hooks/useTeams'
import { teamColour } from '../services/defaultTeams'
import { TeamGPBadge } from './TeamGPBadge'
import { timerRemaining, readEventTimer, subscribeEventTimer, publishEventTimer } from '../services/eventTimer'

export function EventTimerDisplay({ admin = false }: { admin?: boolean }) {
  const { teams } = useTeams()
  const [timer, setTimer] = useState(readEventTimer)
  const [now, setNow] = useState(Date.now)
  useEffect(() => subscribeEventTimer(() => { setTimer(readEventTimer()); setNow(Date.now()) }), [])
  useEffect(() => {
    if (timer.deadline === null) return
    const interval = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(interval)
  }, [timer.deadline])
  const remaining = timerRemaining(timer, now)
  const display = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
  return <article className="event-timer-stage" aria-label="Event countdown timer">
    <img src="/ui/presentation-timer-clean.png" alt="Guard the Heart fantasy arena with a stopwatch" />
    <div className="event-timer__digits" role="timer" aria-label="Time remaining">{display}</div>
    <h2 className="event-timer__label">{timer.label}</h2>
    <div className="event-timer__teams" role="list" aria-label="Team turns">
      {teams.map((team) => <div key={team.id} role="listitem" className={`event-timer__team team-colour--${teamColour(team) ?? 'neutral'}${team.id === timer.activeTeamId ? ' is-active' : ''}`} aria-current={team.id === timer.activeTeamId ? 'step' : undefined}>
        {admin ? <button type="button" className="event-timer__team-name" aria-label={`${team.name.replace(/^tim\s+/i, '')}`} aria-pressed={team.id === timer.activeTeamId}
          onClick={() => publishEventTimer({ ...readEventTimer(), activeTeamId: team.id })}>
          <TeamGPBadge name={team.name} colour={team.colour} gp={team.total_gp}/>
        </button> : <span className="event-timer__team-name"><TeamGPBadge name={team.name} colour={team.colour} gp={team.total_gp}/></span>}
        {team.id === timer.activeTeamId && <span className="event-timer__turn">Giliran</span>}
      </div>)}
      {teams.length === 0 && <p className="event-timer__empty">No active teams</p>}
    </div>
  </article>
}
