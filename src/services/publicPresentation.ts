const PRESENTATION_SLIDE_KEY = 'guard-the-heart-presentation-slide-v2'
const PRESENTATION_SLIDE_EVENT = 'guard-the-heart:presentation-slide'

export const FIRST_PRESENTATION_SLIDE = 1
export const LAST_PRESENTATION_SLIDE = 7
/** Visible order skips the removed reward slide and places the timer fifth. */
export const PRESENTATION_SLIDES = [1, 2, 3, 5, 'timer', 6, 7] as const

export interface PresentationTimer {
  duration: number
  remaining: number
  deadline: number | null
  label: string
}
const LEGACY_TIMER_KEY = 'guard-the-heart-presentation-timer'
const TIMER_KEY = 'guard-the-heart-presentation-timer-v2'
const TIMER_EVENT = 'guard-the-heart:presentation-timer'
const DEFAULT_TIMER: PresentationTimer = { duration: 900, remaining: 900, deadline: null, label: 'Challenge 1 - Image Decode' }

export function readPresentationTimer(): PresentationTimer {
  try {
    const current = localStorage.getItem(TIMER_KEY)
    const value = JSON.parse(current ?? localStorage.getItem(LEGACY_TIMER_KEY) ?? 'null') as PresentationTimer | null
    if (value && Number.isInteger(value.duration) && value.duration > 0 && value.duration <= 5999 &&
      Number.isFinite(value.remaining) && value.remaining >= 0 && value.remaining <= value.duration &&
      (value.deadline === null || Number.isFinite(value.deadline)) && typeof value.label === 'string') {
      return !current && value.label === 'Challenge 1 - Flipping Card'
        ? { ...value, label: DEFAULT_TIMER.label } : value
    }
  } catch { /* Use the default for missing or invalid state. */ }
  return { ...DEFAULT_TIMER }
}

export function presentationTimerRemaining(timer: PresentationTimer, now = Date.now()): number {
  return timer.deadline === null ? timer.remaining : Math.max(0, Math.min(timer.duration, Math.ceil((timer.deadline - now) / 1000)))
}

export function publishPresentationTimer(timer: PresentationTimer): void {
  localStorage.setItem(TIMER_KEY, JSON.stringify(timer))
  window.dispatchEvent(new Event(TIMER_EVENT))
}

export function subscribePresentationTimer(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => { if (event.key === TIMER_KEY) onChange() }
  window.addEventListener('storage', onStorage)
  window.addEventListener(TIMER_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(TIMER_EVENT, onChange)
  }
}

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
