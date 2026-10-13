import { useEffect, useState } from 'react'
import { readPresentationSlide, subscribePresentationSlide } from '../services/publicPresentation'
import { PresentationSlide } from './PresentationSlide'

export function PresentationPublicView() {
  const [slide, setSlide] = useState(readPresentationSlide)

  useEffect(() => subscribePresentationSlide(() => setSlide(readPresentationSlide())), [])

  return (
    <main className="main-presentation main-presentation--public" aria-label="Guard The Heart presentation">
      <PresentationSlide slide={slide} />
    </main>
  )
}
