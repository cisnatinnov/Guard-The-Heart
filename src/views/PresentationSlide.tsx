import { PRESENTATION_SLIDES } from '../services/publicPresentation'
import { PresentationTimerSlide } from './PresentationTimerSlide'

export function PresentationSlide({ slide }: { slide: number }) {
  const source = PRESENTATION_SLIDES[slide - 1] ?? 1
  if (source === 'timer') return <PresentationTimerSlide />
  if (source === 5) {
    return (
      <article className="main-presentation__slide main-presentation__slide--five" aria-label={`Slide ${slide}: Gigarisk Muncul`}>
        <img src="/ui/main-presentation/slide-05-art.png" alt="GigaRisk dragon above a fantasy battlefield" />
        <h1>Gigarisk Muncul</h1>
      </article>
    )
  }

  const image = '/ui/main-presentation/slide-' + String(source).padStart(2, '0') + '.png'
  const labels: Record<number, string> = {
    1: 'Guard The Heart title slide',
    2: 'Goals permainan: defend the Heart of Awareness, join challenges, survive GigaRisk, and earn the most Guard Points',
    3: 'Guard Point definition, group objective, starting points and elimination warning',
    6: 'Image Decode challenge title slide',
    7: 'Image Decode gameplay instructions and scoring',
  }
  return (
    <article className="main-presentation__slide" aria-label={'Slide ' + slide}>
      <img src={image} alt={labels[source] ?? 'Presentation slide ' + slide} />
    </article>
  )
}
