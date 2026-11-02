import { useEffect, useState } from 'react'

/** A host-owned reveal, synchronized with current and newly opened public views. */
export function usePublicChallengeBoard(challengeId: string, kind: 'dragon' | 'cards') {
  const key = `guard-the-heart-public-board:${kind}:${challengeId}`
  const read = () => localStorage.getItem(key) === 'shown'
  const [visible, setVisible] = useState(read)
  useEffect(() => {
    const sync = () => setVisible(read())
    const stored = (event: StorageEvent) => { if (event.key === key || event.key === null) sync() }
    sync()
    window.addEventListener(key, sync)
    window.addEventListener('storage', stored)
    return () => { window.removeEventListener(key, sync); window.removeEventListener('storage', stored) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const reveal = (shown: boolean) => {
    localStorage.setItem(key, shown ? 'shown' : 'hidden')
    window.dispatchEvent(new Event(key))
  }
  return { visible, reveal }
}
