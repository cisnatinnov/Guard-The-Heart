import { useEffect, useState } from 'react'
import type { ChallengeGameId } from '.'
import type { ChallengeRun } from './teamRun'

export interface SharedChallengeRun {
  gameId: ChallengeGameId
  challengeId: string
  run: ChallengeRun | null
  updatedAt: number
}

const STORAGE_KEY = 'guard-the-heart-active-challenge-runs'
const CHANNEL_NAME = 'guard-the-heart-challenge-runs'
const CHANGE_EVENT = 'guard-the-heart-challenge-run-change'

let channel: BroadcastChannel | null = null
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  channel = new BroadcastChannel(CHANNEL_NAME)
}

function readAll(): Record<string, SharedChallengeRun> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, SharedChallengeRun>
  } catch {
    return {}
  }
}

function keyFor(gameId: ChallengeGameId, challengeId: string) {
  return `${gameId}:${challengeId}`
}

export function readSharedChallengeRun(gameId: ChallengeGameId, challengeId: string): ChallengeRun | null {
  return readAll()[keyFor(gameId, challengeId)]?.run ?? null
}

export function publishSharedChallengeRun(gameId: ChallengeGameId, challengeId: string, run: ChallengeRun | null): void {
  const update: SharedChallengeRun = { gameId, challengeId, run, updatedAt: Date.now() }
  const all = readAll()
  all[keyFor(gameId, challengeId)] = update
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  channel?.postMessage(update)
  window.dispatchEvent(new CustomEvent<SharedChallengeRun>(CHANGE_EVENT, { detail: update }))
}

export function useSharedChallengeRun(gameId: ChallengeGameId, challengeId: string): ChallengeRun | null {
  const [run, setRun] = useState<ChallengeRun | null>(() => readSharedChallengeRun(gameId, challengeId))

  useEffect(() => {
    const accept = (update: SharedChallengeRun) => {
      if (update.gameId === gameId && update.challengeId === challengeId) setRun(update.run)
    }
    const local = (event: Event) => accept((event as CustomEvent<SharedChallengeRun>).detail)
    const stored = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      accept(readAll()[keyFor(gameId, challengeId)] ?? { gameId, challengeId, run: null, updatedAt: Date.now() })
    }
    const broadcast = (event: MessageEvent<SharedChallengeRun>) => accept(event.data)

    setRun(readSharedChallengeRun(gameId, challengeId))
    window.addEventListener(CHANGE_EVENT, local)
    window.addEventListener('storage', stored)
    channel?.addEventListener('message', broadcast)
    return () => {
      window.removeEventListener(CHANGE_EVENT, local)
      window.removeEventListener('storage', stored)
      channel?.removeEventListener('message', broadcast)
    }
  }, [gameId, challengeId])

  return run
}
