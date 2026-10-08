import { useEffect, useMemo, useRef } from 'react'
import { dbEvents } from './useDbEvents'

console.log('[useDbEventRefresh] Module loaded')

const BROADCAST_CHANNEL_NAME = 'guard-the-heart-events'
const STORAGE_EVENT_KEY = 'guard-the-heart-db-event'

// Create BroadcastChannel EAGERLY at module load time
// This ensures it exists before any events are emitted
let broadcastChannel: BroadcastChannel | null = null
if (typeof window !== 'undefined') {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'db_event' && event.data?.eventName) {
        console.log('[BroadcastChannel] Received:', event.data.eventName)
        localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify({ 
          eventName: event.data.eventName, 
          timestamp: Date.now() 
        }))
      }
    }
    console.log('[BroadcastChannel] Created eagerly at module load with onmessage handler')
  } catch (e) {
    console.warn('[BroadcastChannel] Failed to create:', e)
    broadcastChannel = null
  }
}

function getBroadcastChannel(): BroadcastChannel | null {
  return broadcastChannel
}

function broadcastEvent(eventName: string): void {
  const channel = getBroadcastChannel()
  if (channel) {
    try {
      channel.postMessage({ type: 'db_event', eventName })
      console.log('[BroadcastChannel] Sent:', eventName)
    } catch (e) {
      console.warn('[BroadcastChannel] Send failed:', e)
    }
  }
  try {
    localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify({ 
      eventName, 
      timestamp: Date.now(),
      source: 'broadcast'
    }))
    console.log('[localStorage] Event stored:', eventName)
  } catch (e) {
    console.warn('[localStorage] Store failed:', e)
  }
}

function listenForBroadcastEvents(onEvent: (eventName: string) => void): () => void {
  const channel = getBroadcastChannel()
  let bcCleanup = () => {}
  if (channel) {
    const bcHandler = (event: MessageEvent) => {
      if (event.data?.type === 'db_event' && event.data?.eventName) {
        console.log('[BroadcastChannel] Handler got:', event.data.eventName)
        onEvent(event.data.eventName)
      }
    }
    channel.addEventListener('message', bcHandler)
    bcCleanup = () => channel.removeEventListener('message', bcHandler)
  }

  const storageHandler = (event: StorageEvent) => {
    if (event.key === STORAGE_EVENT_KEY && event.newValue) {
      try {
        const data = JSON.parse(event.newValue)
        if (data?.eventName) {
          console.log('[localStorage] Storage event:', data.eventName)
          onEvent(data.eventName)
        }
      } catch {
        // Ignore parse errors
      }
    }
  }
  window.addEventListener('storage', storageHandler)

  return () => {
    bcCleanup()
    window.removeEventListener('storage', storageHandler)
  }
}

// Override the emit function to also broadcast
const originalEmit = dbEvents.emit.bind(dbEvents)
dbEvents.emit = function (eventName: string): void {
  console.log('[EventEmitter] Local emit:', eventName)
  originalEmit(eventName)
  broadcastEvent(eventName)
}

/**
 * Hook for real-time updates that works both within the same tab
 * and across multiple tabs via BroadcastChannel + localStorage.
 * Also refreshes on window focus/visibility change.
 */
export function useDbEventRefresh(
  eventNames: string | string[],
  onRefresh: () => void
): void {
  const events = useMemo(() => (Array.isArray(eventNames) ? eventNames : [eventNames]), [eventNames])
  const onRefreshRef = useRef(onRefresh)

  console.log('[useDbEventRefresh] Hook called with events:', events)

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    console.log('[useDbEventRefresh] Registering listeners for:', events)
    const unsubscribers = events.map((event) => {
      console.log('[useDbEventRefresh] Registering local listener for:', event)
      return dbEvents.on(event, () => {
        console.log('[useDbEventRefresh] Local event fired:', event)
        onRefreshRef.current()
      })
    })
    const unsubscribeBroadcast = listenForBroadcastEvents((eventName) => {
      console.log('[useDbEventRefresh] Broadcast event received:', eventName)
      if (events.includes(eventName)) {
        console.log('[useDbEventRefresh] Triggering refresh for:', eventName)
        onRefreshRef.current()
      }
    })

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        onRefreshRef.current()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)

    return () => {
      unsubscribers.forEach((unsub) => unsub())
      unsubscribeBroadcast()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
  }, [events])
}

/**
 * Emit an event locally and broadcast to other tabs
 */
export function emitDbEvent(eventName: string): void {
  dbEvents.emit(eventName)
}