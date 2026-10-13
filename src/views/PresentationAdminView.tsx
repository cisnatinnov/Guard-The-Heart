import { useEffect, useState } from 'react'
import { LAST_PRESENTATION_SLIDE, publishPresentationSlide, readPresentationSlide, subscribePresentationSlide } from '../services/publicPresentation'
import { PresentationSlide } from './PresentationSlide'

export function PresentationAdminView() {
  const [slide, setSlide] = useState(readPresentationSlide)

  useEffect(() => subscribePresentationSlide(() => setSlide(readPresentationSlide())), [])

  function goTo(next: number) {
    publishPresentationSlide(next)
  }

  return (
    <section className="view presentation-admin">
      <header className="view__header">
        <h2>Public presentation</h2>
        <p className="view__hint">Control slides 1–7. The public display follows each slide change.</p>
      </header>
      <nav className="presentation-admin__controls" aria-label="Presentation controls">
        <button type="button" className="ghost" disabled={slide <= 1} onClick={() => goTo(slide - 1)}>← Previous</button>
        <span aria-live="polite">Slide {slide} of {LAST_PRESENTATION_SLIDE}</span>
        <button type="button" disabled={slide >= LAST_PRESENTATION_SLIDE} onClick={() => goTo(slide + 1)}>Next →</button>
      </nav>
      <PresentationSlide slide={slide} />
    </section>
  )
}
