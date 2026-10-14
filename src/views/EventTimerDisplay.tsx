import { useEffect, useState } from 'react'
import { timerRemaining, readEventTimer, subscribeEventTimer } from '../services/eventTimer'

export function EventTimerDisplay() {
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
    <img src="/ui/presentation-timer-reference.png" alt="Guard the Heart fantasy arena with a stopwatch banner" />
    <div className="event-timer__digits" role="timer" aria-label="Time remaining">{display}</div>
    <div className="event-timer__scenery" aria-hidden="true" />
  </article>
}
