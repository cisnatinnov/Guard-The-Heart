import { col, fn } from 'sequelize'
import { ChallengePoint, Scoreboard, Team, TeamCard } from '../models'
import { competitionRanks, rewardsForRank, teamGuardPower, MAX_TOTAL_CARD } from './rankRules'

interface RankedRow {
  id: string
  challenge_point: number
}

/**
 * Recomputes ranks and rank rewards for every entry of a challenge. Ranks are
 * derived from challenge_point alone, so editing one entry reshuffles the whole board.
 */
export async function rerankChallenge(challengeId: string): Promise<void> {
  const entries = await ChallengePoint.findAll({
    where: { challenge: challengeId },
    attributes: ['id', 'challenge_point'],
    order: [['challenge_point', 'DESC']],
  })

  const ranks = competitionRanks(entries.map((entry) => entry.challenge_point))

  for (const [index, entry] of (entries as RankedRow[]).entries()) {
    const rank = ranks[index]
    // Ties can push a team past 5th place, where the blueprint awards nothing.
    const rewards = rank <= 5 ? rewardsForRank(rank) : { guard_power: 0 }
    await ChallengePoint.update({ rank, guard_power: rewards.guard_power }, { where: { id: entry.id } })
  }
}

interface TeamTotals {
  team: string
  total_cp: number
  total_gp?: number
}

/**
 * Rebuilds the `scoreboard` table as one aggregated row per team, then assigns
 * overall ranks by total_cp (competition style, highest cp is rank 1).
 * Cards are now managed separately via TeamCard, not summed from ChallengePoint.
 */
export async function recalculateTotalScoreboard(): Promise<Scoreboard[]> {
  const totals = (await ChallengePoint.findAll({
    attributes: [
      'team',
      [fn('SUM', col('challenge_point')), 'total_cp'],
      [fn('SUM', col('guard_power')), 'total_gp'],
    ],
    group: ['team'],
    raw: true,
  })) as unknown as TeamTotals[]

  // Count TeamCards per team
  const teamCardCounts = (await TeamCard.findAll({
    attributes: ['team', [fn('COUNT', col('id')), 'total_card']],
    group: ['team'],
    raw: true,
  })) as unknown as { team: string; total_card: number }[]

  const cardCountByTeam = new Map(teamCardCounts.map((row) => [row.team, Number(row.total_card ?? 0)]))

  await Scoreboard.destroy({ where: {} })

  const rows = totals.map((row) => ({
    team: row.team,
    total_cp: Number(row.total_cp ?? 0),
    total_card: Math.min(cardCountByTeam.get(row.team) ?? 0, MAX_TOTAL_CARD),
  }))

  const ranks = competitionRanks(rows.map((row) => row.total_cp))

  const created: Scoreboard[] = []
  for (const [index, row] of rows.entries()) {
    created.push(await Scoreboard.create({ ...row, rank: ranks[index] }))
  }

  await syncTeamGuardPower()

  return created
}

/**
 * Guard power lives on the team, not on the scoreboard row: every team starts
 * from `BASE_TEAM_GUARD_POWER` and adds up the `guard_power` earned across all
 * of its challenge entries. Teams with no entries fall back to the base value.
 */
export async function syncTeamGuardPower(): Promise<void> {
  const earned = (await ChallengePoint.findAll({
    attributes: ['team', [fn('SUM', col('guard_power')), 'total_gp']],
    group: ['team'],
    raw: true,
  })) as unknown as TeamTotals[]

  const earnedByTeam = new Map(earned.map((row) => [row.team, Number(row.total_gp ?? 0)]))

  for (const team of await Team.findAll({ attributes: ['id', 'total_gp'] })) {
    const next = teamGuardPower(earnedByTeam.get(team.id) ?? 0)
    if (team.total_gp !== next) await team.update({ total_gp: next })
  }
}