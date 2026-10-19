import { useEffect, useRef, useState } from 'react'
import { CROCODILE_TEETH } from '../../services/games/crocodile'

export interface CrocodilePointer { tooth: number; x: number; y: number }
type HoverMessage = { type: 'request' } | { type: 'hover'; pointer: CrocodilePointer | null }

function validPointer(value: CrocodilePointer | null): boolean {
  return value === null || (typeof value === 'object' && Number.isInteger(value.tooth)
    && value.tooth >= 0 && value.tooth < CROCODILE_TEETH && Number.isFinite(value.x)
    && value.x >= 0 && value.x <= 1920 && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1080)
}

/** Hover is transient; ask the admin for its current position when a display connects. */
export function useCrocodileHover(challengeId: string, canControl: boolean) {
  const [pointer, setPointer] = useState<CrocodilePointer | null>(null)
  const current = useRef<CrocodilePointer | null>(null)
  const send = useRef<(message: HoverMessage) => void>(() => {})
  useEffect(() => {
    const key = `guard-the-heart-crocodile-hover:${challengeId}`
    let channel: BroadcastChannel | null = null
    try { channel = new BroadcastChannel(key) } catch { /* Storage events support older browsers. */ }
    const post = (message: HoverMessage) => {
      if (channel) channel.postMessage(message)
      else localStorage.setItem(key, JSON.stringify({ ...message, nonce: Math.random() }))
    }
    send.current = post
    const receive = (message: HoverMessage) => {
      if (!message || typeof message !== 'object') return
      if (message.type === 'request' && canControl) post({ type: 'hover', pointer: current.current })
      if (message.type === 'hover' && !canControl && validPointer(message.pointer)) setPointer(message.pointer)
    }
    if (channel) channel.onmessage = (event: MessageEvent<HoverMessage>) => receive(event.data)
    const stored = (event: StorageEvent) => {
      if (!channel && event.key === key && event.newValue) {
        try { receive(JSON.parse(event.newValue) as HoverMessage) } catch { /* Ignore invalid messages. */ }
      }
    }
    const clear = () => {
      if (!canControl) return
      current.current = null
      setPointer(null)
      post({ type: 'hover', pointer: null })
    }
    window.addEventListener('storage', stored)
    window.addEventListener('blur', clear)
    window.addEventListener('pagehide', clear)
    if (!canControl) post({ type: 'request' })
    return () => {
      if (canControl) post({ type: 'hover', pointer: null })
      window.removeEventListener('storage', stored)
      window.removeEventListener('blur', clear)
      window.removeEventListener('pagehide', clear)
      channel?.close()
      send.current = () => {}
    }
  }, [challengeId, canControl])

  function publishPointer(next: CrocodilePointer | null) {
    if (!canControl) return
    current.current = next
    setPointer(next)
    send.current({ type: 'hover', pointer: next })
  }
  return [pointer, publishPointer] as const
}
