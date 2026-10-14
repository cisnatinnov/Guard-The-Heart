import { useEffect, useState, type FormEvent } from 'react'
import { presentationTimerRemaining, publishPresentationTimer, readPresentationTimer, subscribePresentationTimer } from '../services/publicPresentation'

export function PresentationTimerControls() {
  const [timer, setTimer] = useState(readPresentationTimer)
  const [minutes, setMinutes] = useState(Math.floor(timer.duration / 60))
  const [seconds, setSeconds] = useState(timer.duration % 60)
  useEffect(() => subscribePresentationTimer(() => {
    const next = readPresentationTimer()
    setTimer(next)
  }), [])
  function configure(event: FormEvent) {
    event.preventDefault()
    const duration = minutes * 60 + seconds
    if (!Number.isInteger(duration) || duration < 1 || duration > 5999) return
    publishPresentationTimer({ duration, remaining: duration, deadline: null, label: '' })
  }
  return <section className="presentation-timer-controls" aria-label="Timer controls">
    <form onSubmit={configure} className="presentation-timer-controls__form">
      <label>Minutes<input type="number" min="0" max="99" required value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label>
      <label>Seconds<input type="number" min="0" max="59" required value={seconds} onChange={(event) => setSeconds(Number(event.target.value))} /></label>
      <button type="submit">Set timer</button>
    </form>
    <div className="presentation-timer-controls__actions">
      <button type="button" disabled={timer.deadline !== null} onClick={() => {
        const remaining = presentationTimerRemaining(timer) || timer.duration
        publishPresentationTimer({ ...timer, remaining, deadline: Date.now() + remaining * 1000 })
      }}>Start timer</button>
      <button type="button" disabled={timer.deadline === null} onClick={() => publishPresentationTimer({ ...timer, remaining: presentationTimerRemaining(timer), deadline: null })}>Pause timer</button>
      <button type="button" className="ghost" onClick={() => publishPresentationTimer({ ...timer, remaining: timer.duration, deadline: null })}>Reset timer</button>
    </div>
  </section>
}
