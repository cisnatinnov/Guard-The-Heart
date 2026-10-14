import { flushDatabase } from '../db/sequelize-provider'

export type DisplayStage = 'scoreboard' | 'leaderboard' | 'podium' | 'rewards' | 'tactical' | 'card-reveal' | 'turn-order' | 'gigarisk' | 'timer'
export interface PublicDisplay { stage: DisplayStage; challengeId: string; id: string }
const KEY = 'guard-the-heart-public-display'

export function displayPath(display: Pick<PublicDisplay, 'stage' | 'challengeId'>, admin = false): string {
  if (['leaderboard', 'podium', 'turn-order', 'timer'].includes(display.stage)) return `${admin ? '/admin' : ''}/${display.stage}`
  return `${admin ? '/admin' : ''}/${display.stage}/${encodeURIComponent(display.challengeId)}`
}

/** Persist scores/cards before telling the projector window to read them. */
export async function publishPublicDisplay(stage: DisplayStage, challengeId: string): Promise<void> {
  await flushDatabase()
  const display: PublicDisplay = { stage, challengeId, id: crypto.randomUUID() }
  localStorage.setItem(KEY, JSON.stringify(display))
}

export function listenForPublicDisplay(accept: (display: PublicDisplay) => void): () => void {
  const receive = (event: StorageEvent) => {
    if (event.key !== KEY || !event.newValue) return
    try {
      const display = JSON.parse(event.newValue) as PublicDisplay
      if (['scoreboard', 'leaderboard', 'podium', 'rewards', 'tactical', 'card-reveal', 'turn-order', 'gigarisk', 'timer'].includes(display.stage) && typeof display.challengeId === 'string') accept(display)
    } catch { /* Ignore unrelated or malformed storage updates. */ }
  }
  window.addEventListener('storage', receive)
  return () => window.removeEventListener('storage', receive)
}
