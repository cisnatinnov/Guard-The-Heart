export function shuffleTeamIds(ids: readonly string[]): string[] {
  const order = [...ids]
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[order[index], order[other]] = [order[other], order[index]]
  }
  return order
}
const ORDER_KEY = 'guard-the-heart-turn-order'
const ORDER_EVENT = 'guard-the-heart:turn-order'
const DEFAULT_COLOURS = ['kuning', 'merah', 'biru', 'pink', 'hijau']

export function readTurnOrder(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch { return [] }
}

export function publishTurnOrder(ids: readonly string[]): void {
  localStorage.setItem(ORDER_KEY, JSON.stringify(ids))
  window.dispatchEvent(new Event(ORDER_EVENT))
}

export function subscribeTurnOrder(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => { if (event.key === ORDER_KEY || event.key === null) onChange() }
  window.addEventListener('storage', onStorage)
  window.addEventListener(ORDER_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(ORDER_EVENT, onChange)
  }
}

export function orderTeams<T extends { id: string; name: string; colour?: string | null }>(teams: readonly T[], order: readonly string[]): T[] {
  const position = (id: string) => { const index = order.indexOf(id); return index < 0 ? order.length : index }
  const colourPosition = (colour?: string | null) => { const index = DEFAULT_COLOURS.indexOf(colour ?? ''); return index < 0 ? DEFAULT_COLOURS.length : index }
  return [...teams].sort((a, b) => position(a.id) - position(b.id)
    || colourPosition(a.colour) - colourPosition(b.colour) || a.name.localeCompare(b.name))
}
