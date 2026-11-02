import { useEffect, useState } from 'react'
import { useRunCountdown } from './useRunCountdown'

export function TurnReminder({ challengeId, turnKey, canControl }: { challengeId: string; turnKey: string; canControl: boolean }) {
  const key = `guard-the-heart-turn-reminder:${challengeId}`
  const read = (): { turn?: string; deadline?: number; manual?: boolean } => {
    try { return JSON.parse(localStorage.getItem(key) ?? '{}') } catch { return {} }
  }
  const [state, setState] = useState(read)
  const reset = () => {
    localStorage.setItem(key, JSON.stringify({ turn: turnKey, deadline: Date.now() + 15000, manual: true }))
    window.dispatchEvent(new Event(key))
  }
  useEffect(() => {
    const sync = () => setState(read())
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) sync() }
    window.addEventListener(key, sync)
    window.addEventListener('storage', storage)
    sync()
    return () => { window.removeEventListener(key, sync); window.removeEventListener('storage', storage) }
  }, [key, turnKey, canControl]) // eslint-disable-line react-hooks/exhaustive-deps
  const remaining = useRunCountdown(state.turn === turnKey && state.manual ? state.deadline : undefined) ?? 15
  return <div className="turn-reminder">
    <span role="timer" aria-label="Turn reminder">{remaining}s</span>
    <span>{state.turn !== turnKey || !state.manual ? 'Ready · click Timer to start' : remaining === 0 ? 'Time reminder · answers remain open' : 'Turn reminder · 15 seconds'}</span>
    {canControl && <button type="button" className="ghost" onClick={reset}>Timer</button>}
  </div>
}
