import { cardDesignKey } from '../data/card-pool'
import type { CardType } from '../models'

interface AllocatableCard { id: string; name: string; type: CardType }
interface AllocationTeam { id: string; quota: number; ownedDesigns: ReadonlySet<string> }
interface Edge { to: string; capacity: number; reverse: Edge }

/** Maximum allocation with one copy of each design per team, including owned cards. */
export function allocateUniqueCards<T extends AllocatableCard>(cards: T[], teams: AllocationTeam[]): { card: T; teamId: string }[] {
  const graph = new Map<string, Edge[]>()
  const links: { card: T; teamId: string; edge: Edge }[] = []
  function add(from: string, to: string, capacity: number) {
    const forward = { to, capacity } as Edge
    const reverse = { to: from, capacity: 0, reverse: forward }
    forward.reverse = reverse
    graph.set(from, [...(graph.get(from) ?? []), forward])
    graph.set(to, [...(graph.get(to) ?? []), reverse])
    return forward
  }
  for (const team of teams) add(`team:${team.id}`, 'sink', Math.max(0, team.quota))
  const designNodes = new Set<string>()
  for (const card of cards) {
    const node = `card:${card.id}`
    const design = cardDesignKey(card)
    add('source', node, 1)
    for (const team of teams) {
      if (team.quota <= 0 || team.ownedDesigns.has(design)) continue
      const designNode = `design:${team.id}:${design}`
      if (!designNodes.has(designNode)) {
        add(designNode, `team:${team.id}`, 1)
        designNodes.add(designNode)
      }
      links.push({ card, teamId: team.id, edge: add(node, designNode, 1) })
    }
  }
  while (true) {
    const parents = new Map<string, { from: string; edge: Edge }>()
    const visited = new Set(['source'])
    const queue = ['source']
    for (let index = 0; index < queue.length && !visited.has('sink'); index++) {
      const from = queue[index]
      for (const edge of graph.get(from) ?? []) {
        if (edge.capacity <= 0 || visited.has(edge.to)) continue
        visited.add(edge.to)
        parents.set(edge.to, { from, edge })
        queue.push(edge.to)
      }
    }
    if (!visited.has('sink')) break
    let node = 'sink'
    while (node !== 'source') {
      const step = parents.get(node)!
      step.edge.capacity--
      step.edge.reverse.capacity++
      node = step.from
    }
  }
  return links.filter(({ edge }) => edge.capacity === 0).map(({ card, teamId }) => ({ card, teamId }))
}
