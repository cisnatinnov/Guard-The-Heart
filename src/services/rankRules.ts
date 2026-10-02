/**
 * Blueprint rules that map a finishing rank to the points a team earns.
 *
 * | rank | challenge_point | guard_power | card |
 * | ---- | --------------- | ----------- | ---- |
 * | 1    | +10             | +3          | +3   |
 * | 2    | +8              | +2          | +2   |
 * | 3    | +6              | +2          | +2   |
 * | 4    | +4              | +1          | +1   |
 * | 5    | +2              | +1          | 0    |
 */
export const MAX_ENTRIES_PER_CHALLENGE = 5
export const MIN_RANK = 1
export const MAX_RANK = 5

/**
 * A team can hold at most 8 cards in total, so summed `card` rewards are
 * clamped instead of accumulating without bound across challenges.
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
  challenge_point: number
  guard_power: number
  card: number
}

const REWARDS_BY_RANK: Record<number, RankRewards> = {
  1: { challenge_point: 10, guard_power: 3, card: 3 },
  2: { challenge_point: 8, guard_power: 2, card: 2 },
  3: { challenge_point: 6, guard_power: 2, card: 2 },
  4: { challenge_point: 4, guard_power: 1, card: 1 },
  5: { challenge_point: 2, guard_power: 1, card: 0 },
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
 * Competition ranking (1, 1, 3): entries sharing a score share a rank and the
 * following rank skips the occupied slots. The result is returned in the same
 * order as the input.
 */
export function competitionRanks(scores: number[]): number[] {
  const ranked = scores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)

  const ranks: number[] = new Array(scores.length)
  let previousScore: number | null = null
  let previousRank = 0

  for (const [position, entry] of ranked.entries()) {
    const rank = previousScore !== null && entry.score === previousScore ? previousRank : position + 1
    ranks[entry.index] = rank
    previousScore = entry.score
    previousRank = rank
  }

  return ranks
}