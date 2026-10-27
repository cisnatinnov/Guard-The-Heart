export const MAIN_SLIDES = [
  { kind: 'scene', title: 'Fight the Dragon' },
  { kind: 'scene', title: 'Game Goals' },
  { kind: 'scene', title: 'What is Guard Power (GP)?' },
  { kind: 'scene', title: 'Gilgamesh' },
  { kind: 'scene', title: 'Challenge 1 — Image Decode' },
  { kind: 'scene', title: 'Image Decode — How to Play' },
  { kind: 'scoreboard', title: 'Scoreboard', challengeName: 'Challenge 1 - Image Decode' },
] as const

const KEY = 'guard-the-heart-main-presentation'
const EVENT = 'guard-the-heart:main-presentation'

export function readMainSlide(): number {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '0')
    return Number.isInteger(value) && value >= 0 && value < MAIN_SLIDES.length ? value : 0
  } catch { return 0 }
}

export function selectMainSlide(index: number): void {
  if (!Number.isInteger(index)) return
  localStorage.setItem(KEY, String(Math.max(0, Math.min(MAIN_SLIDES.length - 1, index))))
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeMainSlide(onChange: () => void): () => void {
  const receive = (event: StorageEvent) => { if (event.key === KEY || event.key === null) onChange() }
  window.addEventListener('storage', receive)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('storage', receive)
    window.removeEventListener(EVENT, onChange)
  }
}
