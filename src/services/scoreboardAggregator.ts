import { syncRewardGP } from './gpTransactions'
import { col, fn, Op } from 'sequelize'
import { usedTacticalCardIds } from './tacticalPhase'
import { ChallengePoint, Scoreboard, TeamCard, Team } from '../models'
import { competitionRanks, rankGuardPointStandings, rewardsForRank, MAX_TOTAL_CARD } from './rankRules'

interface RankedRow {
  id: string
  score: number
  raw_score_only?: boolean
}

/**
 * Recomputes ranks and rank rewards for every entry of a challenge. Ranks are
 * derived from raw score, with challenge_point and guard_power awarded by rank.
 */
export async function rerankChallenge(challengeId: string): Promise<void> {
  const entries = await ChallengePoint.findAll({
    where: { challenge: challengeId },
    attributes: ['id', 'score', 'raw_score_only'],
    order: [['score', 'DESC']],
  })

  const ranks = competitionRanks(entries.map((entry) => entry.score))

  for (const [index, entry] of (entries as RankedRow[]).entries()) {
    const rank = ranks[index]
    // Ties can push a team past 5th place, where the blueprint awards nothing.
    const rewards = rank <= 5 ? rewardsForRank(rank) : { guard_power: 0, challenge_point: 0 }
    await ChallengePoint.update({ rank, raw_score_only: false, guard_power: rewards.guard_power, challenge_point: rewards.challenge_point }, { where: { id: entry.id } })
  }
}

interface TeamTotals {
  team: string
  total_cp: number
  total_gp?: number
}

/**
 * Rebuilds the `scoreboard` table as one aggregated row per team, then assigns
 * overall ranks by current GP, using total earned CP to break GP ties.
 * Cards are now managed separately via TeamCard, not summed from ChallengePoint.
 */
let recalculationQueue: Promise<void> = Promise.resolve()
export function recalculateTotalScoreboard(challengeId?: string): Promise<Scoreboard[]> {
  const pending = recalculationQueue.then(() => rebuildTotalScoreboard(challengeId))
  recalculationQueue = pending.then(() => undefined, () => undefined)
  return pending
}

async function rebuildTotalScoreboard(challengeId?: string): Promise<Scoreboard[]> {
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
    where: { id: { [Op.notIn]: [...usedTacticalCardIds()] } },
    attributes: ['team', [fn('COUNT', col('id')), 'total_card']],
    group: ['team'],
    raw: true,
  })) as unknown as { team: string; total_card: number }[]

  const cardCountByTeam = new Map(teamCardCounts.map((row) => [row.team, Number(row.total_card ?? 0)]))

  const rows = totals.map((row) => ({
    team: row.team,
    total_cp: Number(row.total_cp ?? 0),
    total_card: Math.min(cardCountByTeam.get(row.team) ?? 0, MAX_TOTAL_CARD),
  }))

  await syncTeamGuardPower(challengeId)
  const teams = new Map((await Team.findAll()).map(team=>[team.id,team]))
  const ranked = rankGuardPointStandings(rows.map(row=>({ ...row, teamId:row.team, team:teams.get(row.team)?.name??row.team, points:row.total_cp, guardPower:teams.get(row.team)?.total_gp??0 })))

  const created: Scoreboard[] = []
  for (const row of ranked) {
    const values = { team:row.teamId, total_cp:row.total_cp, total_card:row.total_card, rank:row.rank }
    const existing = await Scoreboard.findOne({ where:{team:row.teamId} })
    created.push(existing ? await existing.update(values) : await Scoreboard.create(values))
  }
  await Scoreboard.destroy({where:{team:{[Op.notIn]:rows.map(row=>row.team)}}})

  return created
}

/**
 * Guard power lives on the team, not on the scoreboard row: every team starts
 * from `BASE_TEAM_GUARD_POWER` and adds up the `guard_power` earned across all
   * of its challenge entries, plus recorded GigaRisk and card-effect changes.
   * Recalculation preserves those combat transactions.
 */
export async function syncTeamGuardPower(challengeId?: string): Promise<void> {
  const earned = (await ChallengePoint.findAll({
    attributes: ['team', [fn('SUM', col('guard_power')), 'total_gp']],
    group: ['team'],
    raw: true,
  })) as unknown as TeamTotals[]

  const earnedByTeam = new Map(earned.map((row) => [row.team, Number(row.total_gp ?? 0)]))

  await syncRewardGP(earnedByTeam,challengeId)
}
