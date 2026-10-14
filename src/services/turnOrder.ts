export function shuffleTeamIds(ids: readonly string[]): string[] {
  const order = [...ids]
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[order[index], order[other]] = [order[other], order[index]]
  }
  return order
}
