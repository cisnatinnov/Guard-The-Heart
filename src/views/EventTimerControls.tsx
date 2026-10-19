import { useEffect, useState, type FormEvent } from 'react'
import { useTeams } from '../hooks/useTeams'
import { CHALLENGE_GAMES } from '../services/games'
import { timerRemaining, publishEventTimer, readEventTimer, subscribeEventTimer } from '../services/eventTimer'

export function EventTimerControls() {
  const { teams } = useTeams()
  const [timer, setTimer] = useState(readEventTimer)
  const [now,setNow]=useState(Date.now)
  useEffect(()=>{if(timer.deadline===null)return;const interval=window.setInterval(()=>setNow(Date.now()),250);return()=>window.clearInterval(interval)},[timer.deadline])
  const running=timer.deadline!==null&&timerRemaining(timer,now)>0
  const [minutes, setMinutes] = useState(Math.floor(timer.duration / 60))
  const [seconds, setSeconds] = useState(timer.duration % 60)
  useEffect(() => subscribeEventTimer(() => {
    const next = readEventTimer()
    setTimer(next)
  }), [])
  function configure(event: FormEvent) {
    event.preventDefault()
    const duration = minutes * 60 + seconds
    if (!Number.isInteger(duration) || duration < 1 || duration > 5999) return
    publishEventTimer({ ...readEventTimer(), duration, remaining: duration, deadline: null })
  }
  return <section className="event-timer-controls" aria-label="Timer controls">
    <div className="event-timer-controls__context">
      <label>Challenge<select value={timer.label} onChange={(event) => publishEventTimer({ ...readEventTimer(), label: event.target.value })}>
        {CHALLENGE_GAMES.map((game) => <option key={game.id} value={game.title}>{game.title}</option>)}
      </select></label>
      <label>Active team<select value={timer.activeTeamId ?? ''} onChange={(event) => publishEventTimer({ ...readEventTimer(), activeTeamId: event.target.value || null })}>
        <option value="">No active team</option>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select></label>
    </div>
    <form onSubmit={configure} className="event-timer-controls__form">
      <label>Minutes<input type="number" min="0" max="99" required value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label>
      <label>Seconds<input type="number" min="0" max="59" required value={seconds} onChange={(event) => setSeconds(Number(event.target.value))} /></label>
      <button type="submit">Set timer</button>
    </form>
    <div className="event-timer-controls__actions">
      <button type="button" disabled={running} onClick={() => {
        const remaining = timerRemaining(timer) || timer.duration
        publishEventTimer({ ...timer, remaining, deadline: Date.now() + remaining * 1000 })
      }}>Start timer</button>
      <button type="button" disabled={!running} onClick={() => publishEventTimer({ ...timer, remaining: timerRemaining(timer), deadline: null })}>Pause timer</button>
      <button type="button" className="ghost" onClick={() => publishEventTimer({ ...timer, remaining: timer.duration, deadline: null })}>Reset timer</button>
    </div>
  </section>
}
