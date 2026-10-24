import { englishText } from '../services/english'
import { useEffect, useRef, useState } from 'react'
import { MAIN_SLIDES, readMainSlide, selectMainSlide, subscribeMainSlide } from '../services/mainPresentation'
import { publishPublicDisplay } from '../services/publicDisplay'
import { ChallengePointPublicView } from './ChallengePointPublicView'
import '../styles/main-presentation.css'
import { MainEnglishCopy } from './MainEnglishCopy'

export function MainPresentationView({ admin = false }: { admin?: boolean }) {
  const [index, setIndex] = useState(readMainSlide)
  const [error, setError] = useState<string | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => subscribeMainSlide(() => setIndex(readMainSlide())), [])
  useEffect(() => {
    if (!admin) return
    const keyboard = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.closest('input, select, textarea, button, a')))) return
      const current = readMainSlide()
      const next = { ArrowRight: current + 1, PageDown: current + 1, ArrowLeft: current - 1, PageUp: current - 1, Home: 0, End: MAIN_SLIDES.length - 1 }[event.key]
      if (next !== undefined) { event.preventDefault(); selectMainSlide(next) }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [admin])
  const slide = MAIN_SLIDES[index]
  async function show() {
    try { await publishPublicDisplay('presentation', ''); setError(null) }
    catch (cause) { setError(englishText(cause instanceof Error ? cause.message : String(cause))) }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await stage.current?.requestFullscreen()
      setError(null)
    } catch (cause) { setError(englishText(cause instanceof Error ? cause.message : String(cause))) }
  }
  return <section className={admin ? 'view main-presentation-admin' : 'main-presentation-public'}>
    {admin && <>
      <header className="view__header"><h2>Main Presentation</h2><p className="view__hint">Choose a slide for the public display. Use ← / →, Page Up / Page Down, Home or End when no control is focused.</p></header>
      <div className="presentation-controls" aria-label="Presentation controls">
        <div className="presentation-controls__navigation">
          <button type="button" className="ghost" aria-label="Previous slide" disabled={index === 0} onClick={() => selectMainSlide(readMainSlide() - 1)}>← Previous</button>
          <label className="presentation-controls__select"><span className="sr-only">Slide</span><select aria-label="Presentation slide" value={index} onChange={(event) => selectMainSlide(Number(event.target.value))}>{MAIN_SLIDES.map((entry, i) => <option value={i} key={entry.title}>{i + 1}. {entry.title}</option>)}</select></label>
          <button type="button" className="ghost" aria-label="Next slide" disabled={index === MAIN_SLIDES.length - 1} onClick={() => selectMainSlide(readMainSlide() + 1)}>Next →</button>
        </div>
        <div className="presentation-controls__footer">
          <output className="presentation-controls__count" aria-live="polite">Slide {index + 1} <span>/ {MAIN_SLIDES.length}</span>{slide.kind === 'scoreboard' && <span className="presentation-controls__live">Live</span>}</output>
          <div className="presentation-controls__actions">
            <button type="button" className="ghost" onClick={() => void fullscreen()}>Fullscreen preview</button>
            <button type="button" onClick={() => void show()}>Show presentation ↗</button>
          </div>
        </div>
      </div>
      {error && <p className="alert alert--error" role="alert">{error}</p>}
    </>}
    <div ref={stage} className={`main-presentation-stage${slide.kind === 'scoreboard' ? ' main-presentation-stage--scoreboard' : ''}`} aria-label="Main Presentation">
      {slide.kind === 'image' ? <img src={`/ui/main-presentation/${slide.file}`} alt={slide.title} />
        : <ChallengePointPublicView challengeName={slide.challengeName} />}
      {slide.kind === 'image' && <MainEnglishCopy index={index} />}
      <p className="sr-only" aria-live="polite">Slide {index + 1} of {MAIN_SLIDES.length}: {slide.title}</p>
    </div>
    {admin && <nav className="main-presentation-thumbnails" aria-label="Presentation slides">{MAIN_SLIDES.map((entry, i) => <button type="button" key={entry.title} aria-current={i === index ? 'step' : undefined} aria-label={`Slide ${i + 1}: ${entry.title}`} onClick={() => selectMainSlide(i)}>
      <div className="main-presentation-thumbnails__art"><img src={entry.kind === 'image' ? `/ui/main-presentation/${entry.file}` : '/ui/Page_Score_Board.jpeg'} alt="" loading="lazy" />{entry.kind === 'image' && <MainEnglishCopy index={i} />}{entry.kind === 'scoreboard' && <small>Live scoreboard</small>}</div>
      <span>{i + 1}. {entry.title}</span>
    </button>)}</nav>}
  </section>
}
