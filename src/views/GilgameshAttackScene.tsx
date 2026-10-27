import { useEffect, useState } from 'react'
import '../styles/gilgamesh-attack.css'

const SCENE_MS = 6500

/** Presentation only: replaying the scene never reapplies damage. */
export function GilgameshAttackScene({ resolvedAt }: { resolvedAt: number }) {
  const [visible, setVisible] = useState(() => Date.now() < resolvedAt + SCENE_MS)
  useEffect(() => {
    const remaining = resolvedAt + SCENE_MS - Date.now()
    if (remaining <= 0) return
    const timeout = window.setTimeout(() => setVisible(false), remaining)
    return () => window.clearTimeout(timeout)
  }, [resolvedAt])
  if (!visible) return null
  return <section className="dragon-attack-scene" aria-label="Gilgamesh attack animation">
    <img className="dragon-attack-scene__dragon" src="/characters/gilgamesh.png" alt="Gilgamesh, the silver and cobalt dragon, lunges forward" />
    <div className="dragon-attack-scene__flame" aria-hidden="true" />
    <div className="dragon-attack-scene__copy"><p>Brace yourselves</p><h2>Gilgamesh Attack</h2><span>Each active team faces −2 GP</span></div>
    <button type="button" onClick={() => setVisible(false)}>Show attack results →</button>
  </section>
}
