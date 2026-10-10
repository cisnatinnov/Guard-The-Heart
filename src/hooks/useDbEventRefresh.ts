import { useEffect, useMemo, useRef } from 'react'
import { dbEvents } from './useDbEvents'
import { flushDatabase, refreshDatabaseFromStorage } from '../db/sequelize-provider'

console.log('[useDbEventRefresh] Module loaded')

const BROADCAST_CHANNEL_NAME = 'guard-the-heart-events'
const STORAGE_EVENT_KEY = 'guard-the-heart-db-event'

let broadcastChannel: BroadcastChannel | null = null
if (typeof window !== 'undefined') {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
  } catch (e) {
    console.warn('[BroadcastChannel] Failed to create:', e)
    broadcastChannel = null
  }
}

function getBroadcastChannel(): BroadcastChannel | null {
  return broadcastChannel
}

let outboundQueue = Promise.resolve()

function broadcastEvent(eventName: string): void {
  outboundQueue = outboundQueue.then(async () => {
    await flushDatabase()
    const channel = getBroadcastChannel()
    if (channel) {
      channel.postMessage({ type: 'db_event', eventName })
      return
    }
    try {
      localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify({ eventName, timestamp: Date.now() }))
    } catch (e) {
      console.warn('[localStorage] Event store failed:', e)
    }
  }).catch((error: unknown) => {
    console.warn('[BroadcastChannel] Could not persist or send update:', error)
  })
}

function listenForBroadcastEvents(onEvent: (eventName: string) => void): () => void {
  let inboundQueue = Promise.resolve()
  const receive = (eventName: string) => {
    inboundQueue = inboundQueue.then(async () => {
      await refreshDatabaseFromStorage()
      onEvent(eventName)
    }).catch((error: unknown) => {
      console.warn('[Database sync] Could not load the latest saved data:', error)
      onEvent(eventName)
    })
  }
  const channel = getBroadcastChannel()
  let bcCleanup = () => {}
  if (channel) {
    const bcHandler = (event: MessageEvent) => {
      if (event.data?.type === 'db_event' && event.data?.eventName) {
        receive(event.data.eventName)
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
          receive(data.eventName)
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
