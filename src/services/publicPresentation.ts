const PRESENTATION_SLIDE_KEY = 'guard-the-heart-presentation-slide'
const PRESENTATION_SLIDE_EVENT = 'guard-the-heart:presentation-slide'

export const FIRST_PRESENTATION_SLIDE = 1
export const LAST_PRESENTATION_SLIDE = 7

export function readPresentationSlide(): number {
  const value = Number(localStorage.getItem(PRESENTATION_SLIDE_KEY))
  return Number.isInteger(value) && value >= FIRST_PRESENTATION_SLIDE && value <= LAST_PRESENTATION_SLIDE
    ? value
    : FIRST_PRESENTATION_SLIDE
}

export function publishPresentationSlide(slide: number): void {
  const next = Math.max(FIRST_PRESENTATION_SLIDE, Math.min(LAST_PRESENTATION_SLIDE, Math.trunc(slide)))
  localStorage.setItem(PRESENTATION_SLIDE_KEY, String(next))
  window.dispatchEvent(new CustomEvent(PRESENTATION_SLIDE_EVENT, { detail: next }))
}

export function subscribePresentationSlide(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === PRESENTATION_SLIDE_KEY) onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(PRESENTATION_SLIDE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(PRESENTATION_SLIDE_EVENT, onChange)
  }
}
