type Listener = () => void

class EventEmitter {
  private listeners: Map<string, Set<Listener>> = new Map()

  on(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
    return () => this.off(event, listener)
  }

  off(event: string, listener: Listener): void {
    this.listeners.get(event)?.delete(listener)
  }

  emit(event: string): void {
    this.listeners.get(event)?.forEach((listener) => listener())
  }
}

export const dbEvents = new EventEmitter()

export const DB_EVENTS = {
  CHALLENGE_POINTS_CHANGED: 'challenge_points_changed',
  TEAMS_CHANGED: 'teams_changed',
  CARDS_CHANGED: 'cards_changed',
  CHALLENGES_CHANGED: 'challenges_changed',
  SCOREBOARD_CHANGED: 'scoreboard_changed',
} as const