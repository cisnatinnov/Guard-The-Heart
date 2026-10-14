import { useEffect, useState } from 'react'
import { presentationTimerRemaining, readPresentationTimer, subscribePresentationTimer } from '../services/publicPresentation'

export function PresentationTimerSlide() {
  const [timer, setTimer] = useState(readPresentationTimer)
  const [now, setNow] = useState(Date.now)
  useEffect(() => subscribePresentationTimer(() => { setTimer(readPresentationTimer()); setNow(Date.now()) }), [])
  useEffect(() => {
    if (timer.deadline === null) return
    const interval = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(interval)
  }, [timer.deadline])
  const remaining = presentationTimerRemaining(timer, now)
  const display = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
  return <article className="main-presentation__slide presentation-timer" aria-label="Presentation timer slide">
    <img src="/ui/presentation-timer-reference.png" alt="Guard the Heart fantasy arena with a stopwatch banner" />
    <div className="presentation-timer__digits" role="timer" aria-label="Presentation time remaining">{display}</div>
    <div className="presentation-timer__scenery" aria-hidden="true" />
  </article>
}
