import { flushDatabase } from '../db/sequelize-provider'
import { openPublicDisplay } from './publicWindow'

export type DisplayStage = 'scoreboard' | 'heart-of-awareness' | 'leaderboard' | 'podium' | 'rewards' | 'tactical' | 'card-reveal' | 'turn-order' | 'gigarisk' | 'timer' | 'presentation' | 'flipping-connect' | 'jaws-of-risk' | 'image-decode' | 'matching-cards' | 'dragon'
export interface PublicDisplay { stage: DisplayStage; challengeId: string; id: string }
const KEY = 'guard-the-heart-public-display'
let latestRequest = 0

export function displayPath(display: Pick<PublicDisplay, 'stage' | 'challengeId'>, admin = false): string {
  if (['image-decode', 'matching-cards', 'dragon'].includes(display.stage)) {
    const gameId = display.stage === 'image-decode' ? 'emoji-decode' : display.stage === 'matching-cards' ? 'word-assembly' : 'jaws-of-risk'
    const board = !admin && display.stage !== 'image-decode' ? display.stage === 'dragon' ? '/dragon' : '/cards' : ''
    return `${admin ? '/admin' : ''}/play/${gameId}/${encodeURIComponent(display.challengeId)}${board}`
  }
  if (display.stage === 'timer') return admin ? '/admin/challenges' : '/scoreboard'
  if (display.stage === 'presentation') return admin ? '/admin/presentation' : '/'
  if (display.stage === 'flipping-connect' || display.stage === 'jaws-of-risk') {
    const gameId = display.stage === 'flipping-connect' ? 'word-assembly' : 'jaws-of-risk'
    return `${admin ? '/admin' : ''}/play/${gameId}/${encodeURIComponent(display.challengeId)}`
  }
  if (['leaderboard', 'heart-of-awareness', 'podium', 'turn-order', 'timer', 'presentation'].includes(display.stage)) return `${admin ? '/admin' : ''}/${display.stage}`
  return `${admin ? '/admin' : ''}/${display.stage}${display.challengeId ? `/${encodeURIComponent(display.challengeId)}` : ''}`
}

/** Persist scores/cards before telling the projector window to read them. */
export async function publishPublicDisplay(stage: DisplayStage, challengeId: string): Promise<void> {
  const request = ++latestRequest
  openPublicDisplay(displayPath({ stage, challengeId }))
  await flushDatabase()
  if (request !== latestRequest) return
  const display: PublicDisplay = { stage, challengeId, id: crypto.randomUUID() }
  localStorage.setItem(KEY, JSON.stringify(display))
}

export function listenForPublicDisplay(accept: (display: PublicDisplay) => void): () => void {
  const receive = (event: StorageEvent) => {
    if (event.key !== KEY || !event.newValue) return
    if (event.newValue !== localStorage.getItem(KEY)) return
    try {
      const display = JSON.parse(event.newValue) as PublicDisplay
      if (['scoreboard', 'leaderboard', 'heart-of-awareness', 'podium', 'rewards', 'tactical', 'card-reveal', 'turn-order', 'gigarisk', 'timer', 'presentation', 'flipping-connect', 'jaws-of-risk', 'image-decode', 'matching-cards', 'dragon'].includes(display.stage) && typeof display.challengeId === 'string') accept(display)
    } catch { /* Ignore unrelated or malformed storage updates. */ }
  }
  window.addEventListener('storage', receive)
  // A newly opened projector may finish loading after the admin's next click.
  // Catch up owned popups to the latest command; direct public URLs stay direct.
  try {
    if (window.opener?.location.origin === window.location.origin && window.opener.location.pathname.startsWith('/admin')) {
      const latest = localStorage.getItem(KEY)
      if (latest) receive(new StorageEvent('storage', { key: KEY, newValue: latest }))
    }
  } catch { /* An unrelated opener cannot control this display. */ }
  return () => window.removeEventListener('storage', receive)
}
