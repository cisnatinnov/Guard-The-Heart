import { col, fn } from 'sequelize'
import { ChallengeScoreboard, Scoreboard, Team } from '../models'
import { capTotalCard, competitionRanks, rewardsForRank, teamGuardPower } from './rankRules'

interface RankedRow {
  id: string
  score: number
}

/**
 * Recomputes ranks and rank rewards for every entry of a challenge. Ranks are
 * derived from scores alone, so editing one score reshuffles the whole board.
 */
export async function rerankChallenge(challengeId: string): Promise<void> {
  const entries = await ChallengeScoreboard.findAll({
    where: { challenge: challengeId },
    attributes: ['id', 'score'],
    order: [['score', 'DESC']],
  })

  const ranks = competitionRanks(entries.map((entry) => entry.score))

  for (const [index, entry] of (entries as RankedRow[]).entries()) {
    const rank = ranks[index]
    // Ties can push a team past 5th place, where the blueprint awards nothing.
    const rewards = rank <= 5 ? rewardsForRank(rank) : { challenge_point: 0, guard_power: 0, card: 0 }
    await ChallengeScoreboard.update({ rank, ...rewards }, { where: { id: entry.id } })
  }
}

interface TeamTotals {
  team: string
  total_score: number
  total_cp: number
  total_card: number
  total_gp?: number
}

/**
 * Rebuilds the `scoreboard` table as one aggregated row per team, then assigns
 * overall ranks by total_score (competition style, highest score is rank 1).
 */
export async function recalculateTotalScoreboard(): Promise<Scoreboard[]> {
  const totals = (await ChallengeScoreboard.findAll({
    attributes: [
      'team',
      [fn('SUM', col('score')), 'total_score'],
      [fn('SUM', col('challenge_point')), 'total_cp'],
      [fn('SUM', col('card')), 'total_card'],
      [fn('SUM', col('guard_power')), 'total_gp'],
    ],
    group: ['team'],
    raw: true,
  })) as unknown as TeamTotals[]

  await Scoreboard.destroy({ where: {} })

  const rows = totals.map((row) => ({
    team: row.team,
    total_score: Number(row.total_score ?? 0),
    total_cp: Number(row.total_cp ?? 0),
    total_card: capTotalCard(Number(row.total_card ?? 0)),
  }))

  const ranks = competitionRanks(rows.map((row) => row.total_score))

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
  const earned = (await ChallengeScoreboard.findAll({
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