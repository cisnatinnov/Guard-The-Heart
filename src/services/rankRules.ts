/**
 * Blueprint rules that map a finishing rank to the points a team earns.
 *
 * | rank | challenge_point | guard_power |
 * | ---- | --------------- | ----------- |
 * | 1    | +10             | +3          |
 * | 2    | +8              | +2          |
 * | 3    | +6              | +2          |
 * | 4    | +4              | +1          |
 * | 5    | +2              | +1          |
 */
export const MAX_ENTRIES_PER_CHALLENGE = 5
export const MIN_RANK = 1
export const MAX_RANK = 5

/**
 * A team can hold at most 8 cards in total.
 */
export const MAX_TOTAL_CARD = 8

export function capTotalCard(total: number): number {
  return Math.max(0, Math.min(MAX_TOTAL_CARD, Math.trunc(total)))
}

/**
 * Guard power is not summed straight from the rank rewards: every team starts
 * with 5 GP and accrues the `guard_power` it earns per challenge on top.
 */
export const BASE_TEAM_GUARD_POWER = 5

export function teamGuardPower(earned: number): number {
  return BASE_TEAM_GUARD_POWER + Math.max(0, Math.trunc(earned))
}

export interface RankRewards {
  guard_power: number
  challenge_point: number
  cards: number
}

const REWARDS_BY_RANK: Record<number, RankRewards> = {
  1: { challenge_point: 10, guard_power: 3, cards: 3 },
  2: { challenge_point: 8, guard_power: 2, cards: 2 },
  3: { challenge_point: 6, guard_power: 2, cards: 2 },
  4: { challenge_point: 4, guard_power: 1, cards: 1 },
  5: { challenge_point: 2, guard_power: 1, cards: 0 },
}

/** GP first, earned challenge points second. Equal values share a dense rank. */
export function rankGuardPointStandings<T extends { guardPower: number; points: number; team: string }>(entries: readonly T[]): Array<T & { rank: number }> {
  const sorted = [...entries].sort((a,b) => b.guardPower-a.guardPower || b.points-a.points || a.team.localeCompare(b.team))
  let rank = 0
  return sorted.map((entry,index) => {
    const previous = sorted[index-1]
    if (!previous || previous.guardPower !== entry.guardPower || previous.points !== entry.points) rank++
    return { ...entry, rank }
  })
}

export function isRankable(rank: number): boolean {
  return Number.isInteger(rank) && rank >= MIN_RANK && rank <= MAX_RANK
}

export function rewardsForRank(rank: number): RankRewards {
  if (!isRankable(rank)) {
    throw new Error(`Rank must be between ${MIN_RANK} and ${MAX_RANK}`)
  }
  return REWARDS_BY_RANK[rank]
}

/**
 * Dense ranking (1, 2, 2, 3, 4): entries sharing a score share a rank
 * and the following rank increments by 1 (does not skip).
 */
export function competitionRanks(scores: number[]): number[] {
  const ranked = scores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)

  const ranks: number[] = new Array(scores.length)
  let previousScore: number | null = null
  let previousRank = 0
  let tieCount = 0

  for (const [position, entry] of ranked.entries()) {
    if (previousScore !== null && entry.score === previousScore) {
      // Tie: same rank as previous, increment tie counter
      tieCount++
      ranks[entry.index] = previousRank
    } else {
      // New score: rank is position + 1 - tieCount (accounts for previous ties)
      const rank = position + 1 - tieCount
      ranks[entry.index] = rank
      previousScore = entry.score
      previousRank = rank
    }
  }

  return ranks
}
