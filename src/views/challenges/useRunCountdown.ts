import { useEffect, useState } from 'react'

/** Both screens read the same deadline; a reload never grants extra time. */
export function useRunCountdown(deadline: number | undefined): number | undefined {
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => {
    if (deadline === undefined) return
    const tick = () => setClock(Date.now())
    tick()
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [deadline])
  return deadline === undefined ? undefined : Math.max(0, Math.ceil((deadline - clock) / 1000))
}
