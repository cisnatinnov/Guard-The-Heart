export interface EventTimer {
  duration: number
  remaining: number
  deadline: number | null
  label: string
  activeTeamId?: string | null
}
const LEGACY_TIMER_KEY = 'guard-the-heart-presentation-timer'
const TIMER_KEY = 'guard-the-heart-presentation-timer-v2'
const TIMER_EVENT = 'guard-the-heart:presentation-timer'
const DEFAULT_TIMER: EventTimer = { duration: 900, remaining: 900, deadline: null, label: 'Challenge 1 - Image Decode', activeTeamId: null }

export function readEventTimer(): EventTimer {
  try {
    const current = localStorage.getItem(TIMER_KEY)
    const value = JSON.parse(current ?? localStorage.getItem(LEGACY_TIMER_KEY) ?? 'null') as EventTimer | null
    if (value && Number.isInteger(value.duration) && value.duration > 0 && value.duration <= 5999 &&
      Number.isFinite(value.remaining) && value.remaining >= 0 && value.remaining <= value.duration &&
      (value.deadline === null || Number.isFinite(value.deadline)) && typeof value.label === 'string') {
      return { ...value, label: !value.label || value.label === 'Challenge 1 - Flipping Card' ? DEFAULT_TIMER.label : value.label, activeTeamId: typeof value.activeTeamId === 'string' ? value.activeTeamId : null }
    }
  } catch { /* Use the default for missing or invalid state. */ }
  return { ...DEFAULT_TIMER }
}

export function timerRemaining(timer: EventTimer, now = Date.now()): number {
  return timer.deadline === null ? timer.remaining : Math.max(0, Math.min(timer.duration, Math.ceil((timer.deadline - now) / 1000)))
}

export function publishEventTimer(timer: EventTimer): void {
  localStorage.setItem(TIMER_KEY, JSON.stringify(timer))
  window.dispatchEvent(new Event(TIMER_EVENT))
}

export function subscribeEventTimer(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => { if (event.key === TIMER_KEY) onChange() }
  window.addEventListener('storage', onStorage)
  window.addEventListener(TIMER_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(TIMER_EVENT, onChange)
  }
}

