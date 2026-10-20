import { useEffect, useState } from 'react'
import { GPShield } from './GPShield'
import type { GPPreview } from '../services/cardGPPreview'

export function AnimatedTeamGP({ value, preview }: { value: number; preview?: GPPreview }) {
  const from = preview?.from ?? value, to = preview?.to ?? value
  const [display, setDisplay] = useState(from)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const frame = requestAnimationFrame(() => setDisplay(to))
      return () => cancelAnimationFrame(frame)
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1100)
      setDisplay(Math.round(from + (to - from) * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [from, to])
  return <span className={`tactical-stage__gp${preview ? ` tactical-stage__gp--${preview.direction}` : ''}`} data-gp-from={preview?.from} data-gp-to={preview?.to}>
    <GPShield /><span className="tactical-stage__gp-number">{display} GP</span>
    {preview && <small className="tactical-stage__gp-change">{preview.label}</small>}
  </span>
}
