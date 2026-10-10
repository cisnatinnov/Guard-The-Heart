import { describe, it, expect, beforeAll } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { getSequelize } from '../src/db/sequelize-provider'
import { Card, Challenge, ChallengePoint, GameQuestion, Scoreboard, TeamCard } from '../src/models'
import { type HeartTowerColumn } from '../src/controllers/TeamController'
import { ChallengeController } from '../src/controllers/ChallengeController'
import { TeamController } from '../src/controllers/TeamController'
import { ChallengePointController } from '../src/controllers/ChallengePointController'
import { ScoreboardController } from '../src/controllers/ScoreboardController'
import { CardController } from '../src/controllers/CardController'
import {
  BASE_TEAM_GUARD_POWER,
  capTotalCard,
  competitionRanks,
  rewardsForRank,
  teamGuardPower,
} from '../src/services/rankRules'
import { MAX_ENTRIES_PER_CHALLENGE, MAX_TOTAL_CARD } from '../src/services/rankRules'
import {
  CARD_POOL_TOTAL,
  CARD_TYPES,
  drawBonusCardsForChallenge,
  getCardPoolStatus,
  isChallengeCardsDrawn,
  seedCardPool,
  synchronizeAllChallengeBonusCards,
} from '../src/services/cardDraw'
import {
  gameIdForChallengeName,
  isLockedChallengeName,
  seedLockedChallenges,
} from '../src/services/challengeSeeds'
import { CHALLENGE_GAMES, EMOJI_DECODE_CHALLENGE_ID } from '../src/services/games'

beforeAll(async () => {
  await initializeAppDatabase()
})

describe('rank rules', () => {
  it('maps each rank to its blueprint rewards', () => {
    expect(rewardsForRank(1)).toEqual({ guard_power: 3 })
    expect(rewardsForRank(2)).toEqual({ guard_power: 2 })
    expect(rewardsForRank(3)).toEqual({ guard_power: 2 })
    expect(rewardsForRank(4)).toEqual({ guard_power: 1 })
    expect(rewardsForRank(5)).toEqual({ guard_power: 1 })
  })

  it('starts every team at 5 guard power', () => {
    expect(teamGuardPower(0)).toBe(BASE_TEAM_GUARD_POWER)
    expect(teamGuardPower(3)).toBe(BASE_TEAM_GUARD_POWER + 3)
    expect(teamGuardPower(-2)).toBe(BASE_TEAM_GUARD_POWER)
  })

  it('caps total_card at 8', () => {
    expect(capTotalCard(0)).toBe(0)
    expect(capTotalCard(5)).toBe(5)
    expect(capTotalCard(8)).toBe(8)
    expect(capTotalCard(12)).toBe(MAX_TOTAL_CARD)
    expect(capTotalCard(-3)).toBe(0)
  })

  it('rejects ranks outside 1-5', () => {
    expect(() => rewardsForRank(0)).toThrow()
    expect(() => rewardsForRank(6)).toThrow()
  })

  it('ranks ties by standard competition style (1,2,2,3)', () => {
    expect(competitionRanks([10, 10, 5])).toEqual([1, 1, 2])
    expect(competitionRanks([90, 70, 50, 30, 10])).toEqual([1, 2, 3, 4, 5])
    expect(competitionRanks([50, 50, 50])).toEqual([1, 1, 1])
  })
})

describe('database bootstrap', () => {
  it('creates the four blueprint tables', async () => {
    const tables = await getSequelize().getQueryInterface().showAllTables()
    expect(tables).toEqual(
      expect.arrayContaining(['challenge', 'team', 'challenge_point', 'scoreboard'])
    )
    expect(tables).not.toContain('challange')
  })

  it('persists the PPTX question and answer banks in SQLite', async () => {
    expect(await GameQuestion.count({ where: { game_key: 'image-decode' } })).toBe(11)
    expect(await GameQuestion.count({ where: { game_key: 'match-card' } })).toBe(50)
    expect(await GameQuestion.count({ where: { game_key: 'jaws-of-risk' } })).toBe(20)
    const first = await GameQuestion.findOne({ where: { game_key: 'image-decode', number: 1 } })
    expect(first?.prompt).toBe('Nasabah')
    expect(first?.answer).toBe('Rekening')
    const matchQuestion = await GameQuestion.findOne({ where: { game_key: 'match-card', number: 1 } })
    expect(matchQuestion?.answer).toBe('Tolak (Deny) dan laporkan sebagai aktivitas mencurigakan')
  })

  it('exposes the blueprint columns on challenge_point', async () => {
    const description = await getSequelize().getQueryInterface().describeTable('challenge_point')
    expect(Object.keys(description)).toEqual(
      expect.arrayContaining([
        'id',
        'challenge',
        'team',
        'rank',
        'challenge_point',
        'guard_power',
      ])
    )
  })

  it('keeps guard power on the team and off the scoreboard', async () => {
    const sequelize = getSequelize()
    expect(Object.keys(await sequelize.getQueryInterface().describeTable('team'))).toEqual(
      expect.arrayContaining(['id', 'name', 'status', 'total_gp'])
    )

    const scoreboard = Object.keys(await sequelize.getQueryInterface().describeTable('scoreboard'))
    expect(scoreboard).toEqual(
      expect.arrayContaining(['id', 'team', 'rank', 'total_cp', 'total_card'])
    )
    expect(scoreboard).not.toContain('total_gp')
    expect(scoreboard).not.toContain('total_score')
  })
})

describe('TeamController', () => {
  it('creates active teams with uuid keys', async () => {
    const created = await TeamController.create('Sentinels')
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(created.name).toBe('Sentinels')
    expect(created.status).toBe('active')
    expect(created.total_gp).toBe(BASE_TEAM_GUARD_POWER)
  })

  it('rejects blank and duplicate names', async () => {
    await expect(TeamController.create('   ')).rejects.toThrow()
    await TeamController.create('Warden')
    await expect(TeamController.create('Warden')).rejects.toThrow(/already exists/i)
  })

  it('supports rename, status toggle and delete', async () => {
    const team = await TeamController.create('Paladins')
    await TeamController.rename(team.id, 'Paladins II')
    expect((await TeamController.getById(team.id))?.name).toBe('Paladins II')

    expect((await TeamController.toggleStatus(team.id))?.status).toBe('inactive')
    expect((await TeamController.list()).some((t) => t.id === team.id)).toBe(false)
    expect((await TeamController.list({ includeInactive: true })).some((t) => t.id === team.id)).toBe(true)

    expect(await TeamController.remove(team.id)).toBe(true)
    expect(await TeamController.getById(team.id)).toBeNull()
  })
})

describe('ChallengeController', () => {
  it('creates and lists challenges with uuid keys', async () => {
    const created = await ChallengeController.create('Arena Alpha')
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect((await ChallengeController.list()).length).toBeGreaterThan(0)
  })

  it('rejects blank names and supports rename/delete', async () => {
    await expect(ChallengeController.create('   ')).rejects.toThrow()
    const challenge = await ChallengeController.create('Arena Beta')
    await ChallengeController.rename(challenge.id, 'Arena Beta 2')
    expect((await ChallengeController.getById(challenge.id))?.name).toBe('Arena Beta 2')
    expect(await ChallengeController.remove(challenge.id)).toBe(true)
  })
})

describe('built-in challenges', () => {
  it('saves the playable challenges as challenge data', async () => {
    const seeded = await seedLockedChallenges()
    expect(seeded).toHaveLength(CHALLENGE_GAMES.length)

    const titles = (await ChallengeController.list()).map((challenge) => challenge.name)
    for (const game of CHALLENGE_GAMES) {
      expect(titles).toContain(game.title)
      expect(isLockedChallengeName(game.title)).toBe(true)
      expect(gameIdForChallengeName(game.title)).toBe(game.id)
    }
    expect(isLockedChallengeName('Arena Gamma')).toBe(false)
    expect(gameIdForChallengeName('Arena Gamma')).toBeNull()
  })

  it('seeds only once, so ids and scoreboards survive a restart', async () => {
    const first = await seedLockedChallenges()
    const before = await ChallengeController.getById(CHALLENGE_GAMES[0].challengeId)
    await seedLockedChallenges()
    const after = await ChallengeController.getById(CHALLENGE_GAMES[0].challengeId)

    expect(first).toHaveLength(CHALLENGE_GAMES.length)
    expect(after?.createdAt).toEqual(before?.createdAt)

    const names = (await ChallengeController.list()).map((challenge) => challenge.name)
    for (const game of CHALLENGE_GAMES) {
      expect(names.filter((name) => name === game.title)).toHaveLength(1)
    }
  })

  it('cannot be added a second time', async () => {
    for (const game of CHALLENGE_GAMES) {
      await expect(ChallengeController.create(game.title)).rejects.toThrow(/built in/)
      await expect(ChallengeController.create(`  ${game.title.toUpperCase()}  `)).rejects.toThrow(/built in/)
    }
  })

  it('cannot be renamed or deleted', async () => {
    for (const game of CHALLENGE_GAMES) {
      const row = await ChallengeController.getById(game.challengeId)
      expect(row?.name).toBe(game.title)

      await expect(ChallengeController.rename(row!.id, 'Renamed')).rejects.toThrow(/built in/)
      await expect(ChallengeController.remove(row!.id)).rejects.toThrow(/built in/)
      expect((await ChallengeController.getById(row!.id))?.name).toBe(game.title)
    }
  })

  it('removes retired built-in challenges and their entries on seed', async () => {
    const retired = await Challenge.create({ name: 'Save the Core' })
    const team = await TeamController.create('Retired Runner')
    await ChallengePointController.create({ challenge: retired.id, team: team.id, challenge_point: 40 })
    expect((await TeamController.getById(team.id))?.total_gp).toBe(BASE_TEAM_GUARD_POWER + 3)

    await seedLockedChallenges()
    expect(await Challenge.findOne({ where: { name: 'Save the Core' } })).toBeNull()
    expect(await ChallengePoint.count({ where: { challenge: retired.id } })).toBe(0)
    expect((await TeamController.getById(team.id))?.total_gp).toBe(BASE_TEAM_GUARD_POWER)
  })

  it('does not let a custom challenge borrow a built-in name', async () => {
    const custom = await ChallengeController.create('Arena Borrow')
    await expect(ChallengeController.rename(custom.id, 'Match Card')).rejects.toThrow(/built-in/)
    expect((await ChallengeController.getById(custom.id))?.name).toBe('Arena Borrow')
    await ChallengeController.remove(custom.id)
  })

  it('accepts scoreboard entries like any other challenge', async () => {
    const teams = await Promise.all(
      ['Lock A', 'Lock B', 'Lock C', 'Lock D', 'Lock E'].map((team) => TeamController.create(team))
    )
    const emoji = await ChallengeController.getById(EMOJI_DECODE_CHALLENGE_ID)
    expect(emoji?.name).toBe('Image Decode')

    const entries = []
    for (const [index, team] of teams.entries()) {
      entries.push(
        await ChallengePointController.create({
          challenge: emoji!.id,
          team: team.id,
          challenge_point: (index + 1) * 10,
        })
      )
    }

    const leaderboard = await ChallengePointController.listByChallenge(emoji!.id)
    expect(leaderboard).toHaveLength(5)
    expect(leaderboard[0].challenge_point).toBe(50)
    expect(leaderboard[0].rank).toBe(1)
    expect(leaderboard[0].guard_power).toBe(3)

    for (const entry of entries) {
      await ChallengePointController.remove(entry.id)
    }
    for (const team of teams) {
      await TeamController.remove(team.id)
    }
  })
})

describe('ChallengePointController', () => {
  it('draws a completed challenge cards once to challenge pool (no team)', async () => {
    const challenge = await ChallengeController.create('Arena Card Rewards')
    const teams = await Promise.all(
      ['Reward A', 'Reward B', 'Reward C', 'Reward D', 'Reward E'].map((name) =>
        TeamController.create(name)
      )
    )

    for (const [index, team] of teams.entries()) {
      await ChallengePointController.create({
        challenge: challenge.id,
        team: team.id,
        challenge_point: (teams.length - index) * 20,
      })
    }

    // Completing a challenge no longer draws by itself.
    expect(await Card.count({ where: { challenge: challenge.id } })).toBe(0)
    expect(await isChallengeCardsDrawn(challenge.id)).toBe(false)

    const drawn = await drawBonusCardsForChallenge(challenge.id)
    expect(drawn).toHaveLength(8)
    expect(await isChallengeCardsDrawn(challenge.id)).toBe(true)

    // Cards should be in challenge pool with no team assigned
    const challengeCards = await Card.findAll({ where: { challenge: challenge.id } })
    expect(challengeCards).toHaveLength(8)
    for (const card of challengeCards) {
      expect(card.team).toBeNull()
    }

    const expectedGuardPower = [3, 2, 2, 1, 1]
    for (const [index] of teams.entries()) {
      expect((await ChallengePointController.listByChallenge(challenge.id))[index]?.guard_power).toBe(
        expectedGuardPower[index]
      )
    }

    // A second draw is refused and leaves the saved cards untouched.
    const savedIds = (await Card.findAll({ where: { challenge: challenge.id } })).map((card) => card.id).sort()
    await expect(drawBonusCardsForChallenge(challenge.id)).rejects.toThrow(/already been drawn/)
    await synchronizeAllChallengeBonusCards()
    expect((await Card.findAll({ where: { challenge: challenge.id } })).map((card) => card.id).sort()).toEqual(
      savedIds
    )
  })

  it('admin can assign drawn cards to teams', async () => {
    const challenge = await ChallengeController.create('Arena Card Assignment')
    const teams = await Promise.all(
      ['Team A', 'Team B', 'Team C', 'Team D', 'Team E'].map((name) =>
        TeamController.create(name)
      )
    )

    for (const [index, team] of teams.entries()) {
      await ChallengePointController.create({
        challenge: challenge.id,
        team: team.id,
        challenge_point: (teams.length - index) * 20,
      })
    }

    await drawBonusCardsForChallenge(challenge.id)

    // Admin assigns first card to first team
    const availableCards = await Card.findAll({ where: { challenge: challenge.id, team: null } })
    expect(availableCards.length).toBeGreaterThan(0)

    const firstCard = availableCards[0]
    await CardController.assignCardToTeam(firstCard.id, teams[0].id)

    // Card should now be assigned to team
    const assignedCard = await Card.findByPk(firstCard.id)
    expect(assignedCard?.team).toBe(teams[0].id)

    // TeamCard should be created
    const teamCards = await TeamCard.findAll({ where: { team: teams[0].id } })
    expect(teamCards).toHaveLength(1)
    expect(teamCards[0].name).toBe(firstCard.name)

    // Available cards should decrease
    const remainingAvailable = await Card.findAll({ where: { challenge: challenge.id, team: null } })
    expect(remainingAvailable.length).toBe(availableCards.length - 1)
  })

  it('refuses to draw cards before all five teams have an entry', async () => {
    const challenge = await ChallengeController.create('Arena Early Draw')
    const team = await TeamController.create('Early Drawer')
    await ChallengePointController.create({ challenge: challenge.id, team: team.id, challenge_point: 10 })
    await expect(drawBonusCardsForChallenge(challenge.id)).rejects.toThrow(/not complete/)
    expect(await isChallengeCardsDrawn(challenge.id)).toBe(false)
  })

  it('derives rank and rewards from the challenge point', async () => {
    const challenge = await ChallengeController.create('Arena Gamma')
    const team = await TeamController.create('Alpha Squad')

    const entry = await ChallengePointController.create({
      challenge: challenge.id,
      team: team.id,
      challenge_point: 120,
    })

    expect(entry.challenge_point).toBe(120)
    expect(entry.rank).toBe(1)
    expect(entry.guard_power).toBe(3)
  })

  it('ranks entries by challenge point and reshuffles on update', async () => {
    const challenge = await ChallengeController.create('Arena Reshuffle')
    const first = await TeamController.create('Team Low')
    const second = await TeamController.create('Team High')

    const lowEntry = await ChallengePointController.create({
      challenge: challenge.id,
      team: first.id,
      challenge_point: 10,
    })
    const highEntry = await ChallengePointController.create({
      challenge: challenge.id,
      team: second.id,
      challenge_point: 200,
    })

    expect(lowEntry.rank).toBe(1)
    expect((await ChallengePointController.getById(lowEntry.id))?.rank).toBe(2)
    expect((await ChallengePointController.getById(highEntry.id))?.rank).toBe(1)

    // Dropping the leader below the other team swaps the ranks.
    await ChallengePointController.update(highEntry.id, { challenge_point: 1 })
    expect((await ChallengePointController.getById(lowEntry.id))?.rank).toBe(1)
    expect((await ChallengePointController.getById(highEntry.id))?.rank).toBe(2)
  })

  it('gives tied challenge points the same rank and skips the next rank', async () => {
    const challenge = await ChallengeController.create('Arena Tie')
    const a = await TeamController.create('Tie A')
    const b = await TeamController.create('Tie B')
    const c = await TeamController.create('Tie C')

    const first = await ChallengePointController.create({ challenge: challenge.id, team: a.id, challenge_point: 50 })
    const second = await ChallengePointController.create({ challenge: challenge.id, team: b.id, challenge_point: 50 })
    const third = await ChallengePointController.create({ challenge: challenge.id, team: c.id, challenge_point: 10 })

    expect(first.rank).toBe(1)
    expect((await ChallengePointController.getById(second.id))?.rank).toBe(1)
    expect((await ChallengePointController.getById(third.id))?.rank).toBe(2)
    expect((await ChallengePointController.getById(third.id))?.challenge_point).toBe(10)
  })

  it('refuses entries for unknown challenges and teams', async () => {
    const team = await TeamController.create('Orphan Team')
    await expect(
      ChallengePointController.create({
        challenge: '00000000-0000-4000-8000-999999999999',
        team: team.id,
        challenge_point: 1,
      })
    ).rejects.toThrow(/challenge was not found/i)

    const challenge = await ChallengeController.create('Arena Orphan')
    await expect(
      ChallengePointController.create({
        challenge: challenge.id,
        team: '00000000-0000-4000-8000-888888888888',
        challenge_point: 1,
      })
    ).rejects.toThrow(/team was not found/i)
  })

  it('enforces one entry per team per challenge', async () => {
    const challenge = await ChallengeController.create('Arena Unique')
    const team = await TeamController.create('Solo Entry')
    await ChallengePointController.create({ challenge: challenge.id, team: team.id, challenge_point: 5 })
    await expect(
      ChallengePointController.create({ challenge: challenge.id, team: team.id, challenge_point: 6 })
    ).rejects.toThrow(/already has an entry/i)
  })

  it('rejects the sixth entry for a challenge', async () => {
    const challenge = await ChallengeController.create('Arena Capped')
    for (let i = 0; i < MAX_ENTRIES_PER_CHALLENGE; i += 1) {
      const team = await TeamController.create(`Capped Team ${i}`)
      await ChallengePointController.create({ challenge: challenge.id, team: team.id, challenge_point: i * 10 })
    }

    const overflow = await TeamController.create('Capped Team Overflow')
    await expect(
      ChallengePointController.create({ challenge: challenge.id, team: overflow.id, challenge_point: 999 })
    ).rejects.toThrow(/at most 5 entries/i)
  })

  it('validates the challenge point range', async () => {
    const challenge = await ChallengeController.create('Arena Range')
    const team = await TeamController.create('Range Team')
    await expect(
      ChallengePointController.create({ challenge: challenge.id, team: team.id, challenge_point: -1 })
    ).rejects.toThrow(/cannot be negative/i)
    await expect(
      ChallengePointController.create({ challenge: challenge.id, team: team.id, challenge_point: 1000 })
    ).rejects.toThrow(/cannot exceed 999/i)
  })

  it('applies the foreign key constraint', async () => {
    await expect(
      ChallengePoint.create({
        challenge: 'missing-id',
        team: 'missing-id',
        rank: 1,
        challenge_point: 0,
        guard_power: 0,
        card: 0,
      })
    ).rejects.toThrow(/FOREIGN KEY/i)
  })

  it('updates and deletes entries', async () => {
    const challenge = await ChallengeController.create('Arena Delta')
    const team = await TeamController.create('Delta Team')
    const entry = await ChallengePointController.create({
      challenge: challenge.id,
      team: team.id,
      challenge_point: 10,
    })
    expect((await ChallengePointController.getById(entry.id))?.challenge_point).toBe(10)
    expect(await ChallengePointController.remove(entry.id)).toBe(true)
    expect(await ChallengePointController.getById(entry.id)).toBeNull()
  })

  it('lets a participating team gain challenge point without a new entry', async () => {
    const challenge = await ChallengeController.create('Arena Follow')
    const team = await TeamController.create('Follower Squad')
    const rival = await TeamController.create('Rival Squad')

    const follower = await ChallengePointController.create({
      challenge: challenge.id,
      team: team.id,
      challenge_point: 20,
    })
    const leader = await ChallengePointController.create({
      challenge: challenge.id,
      team: rival.id,
      challenge_point: 90,
    })

    // The team gains rank and rewards as its challenge point rises.
    expect((await ChallengePointController.getById(follower.id))?.rank).toBe(2)
    expect((await ChallengePointController.getById(leader.id))?.rank).toBe(1)

    // Correcting the challenge point in place, which is what the view calls.
    const corrected = await ChallengePointController.update(follower.id, { challenge_point: 95 })
    expect(corrected?.challenge_point).toBe(95)
    expect(corrected?.rank).toBe(1)
    expect(corrected?.challenge_point).toBe(95)
    expect(corrected?.guard_power).toBe(3)
    expect((await ChallengePointController.getById(leader.id))?.rank).toBe(2)

    // The team total scoreboard follows the corrected challenge point. Other teams from
    // earlier cases share the test database, so compare the pair relatively.
    const totals = await ScoreboardController.recalculate()
    const followerTotal = totals.find((row) => row.team === team.id)
    const rivalTotal = totals.find((row) => row.team === rival.id)
    expect(followerTotal?.total_cp).toBe(95)
    expect(rivalTotal?.total_cp).toBe(90)
    expect(followerTotal!.rank).toBeLessThan(rivalTotal!.rank)

    // Updating is idempotent with respect to entries: still two rows.
    expect(await ChallengePointController.listByChallenge(challenge.id)).toHaveLength(2)
  })
})

describe('ScoreboardController', () => {
  it('aggregates per team and ranks by total cp', async () => {
    const challenge = await ChallengeController.create('Arena Omega')
    const leader = await TeamController.create('Omega Leader')
    const runnerUp = await TeamController.create('Omega Runner Up')

    await ChallengePointController.create({ challenge: challenge.id, team: leader.id, challenge_point: 100 })
    await ChallengePointController.create({ challenge: challenge.id, team: runnerUp.id, challenge_point: 40 })

    const rows = await ScoreboardController.list()
    const leaderRow = rows.find((row) => row.team === leader.id)
    const runnerUpRow = rows.find((row) => row.team === runnerUp.id)

    expect(leaderRow?.total_cp).toBe(100)
    expect(leaderRow?.total_cp).toBe(100)
    expect(leaderRow?.total_card).toBe(0)

    expect(runnerUpRow?.total_cp).toBe(40)
    // Ranks are global across every team, so only the ordering is asserted.
    expect(leaderRow!.rank).toBeLessThan(runnerUpRow!.rank)
  })

  it('includes the per-challenge scores on each scoreboard row', async () => {
    const first = await ChallengeController.create('Arena Detail One')
    const second = await ChallengeController.create('Arena Detail Two')
    const team = await TeamController.create('Detail Team')
    const other = await TeamController.create('Detail Other')

    await ChallengePointController.create({ challenge: first.id, team: team.id, challenge_point: 70 })
    await ChallengePointController.create({ challenge: second.id, team: team.id, challenge_point: 30 })
    await ChallengePointController.create({ challenge: second.id, team: other.id, challenge_point: 50 })

    const rows = await ScoreboardController.list()
    const row = rows.find((entry) => entry.team === team.id)
    expect(row?.challengeScores?.map((score) => score.challengeName).sort()).toEqual([
      'Arena Detail One',
      'Arena Detail Two',
    ])
    expect(row?.challengeScores?.find((score) => score.challengeName === 'Arena Detail One')?.challenge_point).toBe(70)
    expect(row?.challengeScores?.find((score) => score.challengeName === 'Arena Detail Two')?.challenge_point).toBe(30)

    const otherRow = rows.find((entry) => entry.team === other.id)
    expect(otherRow?.challengeScores).toHaveLength(1)
    expect(otherRow?.challengeScores?.[0]?.challenge_point).toBe(50)
  })

  it('sums totals across multiple challenges for the same team', async () => {
    const first = await ChallengeController.create('Arena Sum One')
    const second = await ChallengeController.create('Arena Sum Two')
    const team = await TeamController.create('Sum Team')

    await ChallengePointController.create({ challenge: first.id, team: team.id, challenge_point: 70 })
    await ChallengePointController.create({ challenge: second.id, team: team.id, challenge_point: 30 })

    const row = await ScoreboardController.getByTeam(team.id)
    expect(row?.total_cp).toBe(100)
    expect(row?.total_cp).toBe(100)
    expect(row?.total_card).toBe(0)
  })

  it('accrues team guard power from 5 plus the guard_power earned', async () => {
    const first = await ChallengeController.create('Guard Arena One')
    const second = await ChallengeController.create('Guard Arena Two')
    const team = await TeamController.create('Guard Team')
    const other = await TeamController.create('Idle Guard Team')

    // A team with no entries stays on the base value.
    expect(other.total_gp).toBe(BASE_TEAM_GUARD_POWER)

    // Rank 1 in both challenges: 3 + 3 earned, and 2 for the runner-up.
    await ChallengePointController.create({ challenge: first.id, team: team.id, challenge_point: 90 })
    await ChallengePointController.create({ challenge: second.id, team: team.id, challenge_point: 30 })
    await ChallengePointController.create({ challenge: second.id, team: other.id, challenge_point: 10 })

    expect((await TeamController.getById(team.id))?.total_gp).toBe(BASE_TEAM_GUARD_POWER + 6)
    expect((await TeamController.getById(other.id))?.total_gp).toBe(BASE_TEAM_GUARD_POWER + 2)

    // Guard power follows the challenge point: dropping the team to last recalculates it.
    await ChallengePointController.update(
      (await ChallengePointController.listByChallenge(second.id)).find((e) => e.team === team.id)!.id,
      { challenge_point: 0 }
    )
    // Second challenge drops to rank 2 (2 GP), so 3 + 2 earned.
    expect((await TeamController.getById(team.id))?.total_gp).toBe(BASE_TEAM_GUARD_POWER + 5)

    // Deleting the remaining entries returns the team to the base value.
    for (const challengeId of [first.id, second.id]) {
      for (const entry of await ChallengePointController.listByChallenge(challengeId)) {
        if (entry.team === team.id) await ChallengePointController.remove(entry.id)
      }
    }
    expect((await TeamController.getById(team.id))?.total_gp).toBe(BASE_TEAM_GUARD_POWER)
  })

  it('caps total_card at 8 per team across challenges on scoreboard (now 0, cards from TeamCard)', async () => {
    const team = await TeamController.create('Card Hoarder')
    // Four wins at rank 1 would award 12 cards, which exceeds the cap of 8.
    for (let i = 0; i < 4; i += 1) {
      const challenge = await ChallengeController.create(`Card Arena ${i}`)
      await ChallengePointController.create({ challenge: challenge.id, team: team.id, challenge_point: 100 })
    }

    const row = await ScoreboardController.getByTeam(team.id)
    // total_card on scoreboard is now 0; card limits enforced at TeamCard level
    expect(row?.total_card).toBe(0)
    // The other totals are not capped, so they keep accumulating.
    expect(row?.total_cp).toBe(400)
  })

  it('rejects a total_card above the cap', async () => {
    const team = await TeamController.create('Over Cap Team')
    await ChallengePointController.create({
      challenge: (await ChallengeController.create('Over Cap Arena')).id,
      team: team.id,
      challenge_point: 100,
    })
    const row = (await ScoreboardController.getByTeam(team.id)) as Scoreboard

    await expect(row.update({ total_card: MAX_TOTAL_CARD + 1 })).rejects.toThrow(/cannot exceed/i)
  })

  it('keeps totals in sync after deleting an entry', async () => {
    const challenge = await ChallengeController.create('Arena Sync')
    const team = await TeamController.create('Sync Team')
    const entry = await ChallengePointController.create({
      challenge: challenge.id,
      team: team.id,
      challenge_point: 30,
    })

    const before = await ScoreboardController.getByTeam(team.id)
    expect(before?.total_cp).toBe(30)

    await ChallengePointController.remove(entry.id)
    // With no entries left the team drops out of the aggregate entirely.
    const after = await ScoreboardController.getByTeam(team.id)
    expect(after).toBeNull()
  })

  it('raises the heart tower for active teams only', async () => {
    const challenge = await ChallengeController.create('Tower Arena')
    const leader = await TeamController.create('Tower Leader')
    const runnerUp = await TeamController.create('Tower Runner Up')
    const standby = await TeamController.create('Tower Standby')

    await ChallengePointController.create({ challenge: challenge.id, team: leader.id, challenge_point: 90 })
    await ChallengePointController.create({ challenge: challenge.id, team: runnerUp.id, challenge_point: 40 })
    // Third place also awards 2 GP, so the standby team is level with the runner-up.
    await ChallengePointController.create({ challenge: challenge.id, team: standby.id, challenge_point: 5 })

    // Other suites share this database, so only these three columns are compared.
    const mine = new Set([leader.id, runnerUp.id, standby.id])
    const filterMine = (rows: HeartTowerColumn[]) => rows.filter((r) => mine.has(r.team.id))

    const rows = filterMine(await TeamController.heartTower())
    expect(rows.map((row) => row.team.name)).toEqual([
      'Tower Leader',
      'Tower Runner Up',
      'Tower Standby',
    ])
    expect(rows[0].team.total_gp).toBe(BASE_TEAM_GUARD_POWER + 3)
    expect(rows[0].earned).toBe(3)
    expect(rows[1].earned).toBe(2)
    expect(rows[2].earned).toBe(2)

    // Deactivating a team removes its column from the tower.
    await TeamController.toggleStatus(standby.id)
    const active = filterMine(await TeamController.heartTower())
    expect(active.map((row) => row.team.name)).toEqual(['Tower Leader', 'Tower Runner Up'])

    const withInactive = filterMine(await TeamController.heartTower({ includeInactive: true }))
    expect(withInactive.map((row) => row.team.name)).toContain('Tower Standby')
  })

  it('drops totals when the challenge is deleted', async () => {
    const challenge = await ChallengeController.create('Arena Doomed')
    const team = await TeamController.create('Doomed Team')
    await ChallengePointController.create({ challenge: challenge.id, team: team.id, challenge_point: 45 })
    expect((await ScoreboardController.getByTeam(team.id))?.total_cp).toBe(45)
    expect((await TeamController.getById(team.id))?.total_gp).toBe(BASE_TEAM_GUARD_POWER + 3)

    await ChallengeController.remove(challenge.id)
    const rows = await ChallengePoint.findAll({ where: { challenge: challenge.id } })
    expect(rows).toHaveLength(0)
    expect((await TeamController.getById(team.id))?.total_gp).toBe(BASE_TEAM_GUARD_POWER)
  })
})

describe('card pool', () => {
  it('declares 80 cards split 48 Normal, 24 Rare, 6 Epic and 2 Legendary', async () => {
    const pool = await getCardPoolStatus()
    const inventory = await Card.findAll()
    const names = inventory.map((card) => card.name)
    const queryInterface = getSequelize().getQueryInterface()
    expect(CARD_POOL_TOTAL).toBe(80)
    expect(inventory).toHaveLength(80)
    expect(new Set(names).size).toBe(80)
    expect(inventory.every((card) => card.effect_action.trim().length > 0)).toBe(true)
    expect(await queryInterface.describeTable('card')).toHaveProperty('effect_action')
    expect(await queryInterface.describeTable('team_card')).toHaveProperty('effect_action')
    expect(pool.total).toBe(CARD_POOL_TOTAL)
    expect(pool.byType.Normal.total).toBe(48)
    expect(pool.byType.Rare.total).toBe(24)
    expect(pool.byType.Epic.total).toBe(6)
    expect(pool.byType.Legendary.total).toBe(2)

    for (const type of CARD_TYPES) {
      const bucket = pool.byType[type]
      expect(bucket.drawn + bucket.remaining).toBe(bucket.total)
    }
    expect(pool.drawn + pool.remaining).toBe(pool.total)

    await seedCardPool()
    expect(await Card.count()).toBe(80)
  })

  it('consumes pool cards on draw and returns them only when the challenge is deleted', async () => {
    const before = await getCardPoolStatus()
    const unassignedBefore = await Card.count({ where: { challenge: null, team: null } })
    const challenge = await ChallengeController.create('Arena Pool Drain')
    const teams = await Promise.all(
      ['Pool A', 'Pool B', 'Pool C', 'Pool D', 'Pool E'].map((name) => TeamController.create(name))
    )

    for (const [index, team] of teams.entries()) {
      await ChallengePointController.create({
        challenge: challenge.id,
        team: team.id,
        challenge_point: (teams.length - index) * 20,
      })
    }

    await drawBonusCardsForChallenge(challenge.id)
    const drawn = await Card.findAll({ where: { challenge: challenge.id } })
    expect(drawn).toHaveLength(8)
    expect(new Set(drawn.map((card) => card.name)).size).toBe(8)
    expect(drawn.every((card) => card.effect_action.trim().length > 0)).toBe(true)

    const afterDraw = await getCardPoolStatus()
    expect(afterDraw.drawn - before.drawn).toBe(8)
    expect(afterDraw.remaining).toBe(before.remaining - 8)
    expect(afterDraw.byType.Normal.drawn - before.byType.Normal.drawn).toBe(
      drawn.filter((card) => card.type === 'Normal').length
    )
    expect(afterDraw.byType.Rare.drawn - before.byType.Rare.drawn).toBe(
      drawn.filter((card) => card.type === 'Rare').length
    )
    expect(afterDraw.byType.Epic.drawn - before.byType.Epic.drawn).toBe(
      drawn.filter((card) => card.type === 'Epic').length
    )

    const firstEntry = (await ChallengePointController.listByChallenge(challenge.id))[0]
    await ChallengePointController.remove(firstEntry.id)
    expect(await Card.count({ where: { challenge: challenge.id } })).toBe(8)

    expect(await ChallengeController.remove(challenge.id)).toBe(true)
    expect(await Card.count({ where: { challenge: challenge.id } })).toBe(0)
    expect(await Card.count({ where: { challenge: null, team: null } })).toBe(unassignedBefore)
    expect(await getCardPoolStatus()).toEqual(before)
  })

  it('never hands the same pool card to two teams (drawn to challenge pool, unassigned)', async () => {
    const baseline = await getCardPoolStatus()
    const drawnCardNames = new Set<string>()

    for (const round of [0, 1, 2]) {
      const challenge = await ChallengeController.create(`Arena Unique Draw ${round}`)
      const teams = await Promise.all(
        ['Draw', 'Flop', 'Call', 'Raise', 'Fold'].map((name) => TeamController.create(`${name} ${round}`))
      )
      for (const [index, team] of teams.entries()) {
        await ChallengePointController.create({
          challenge: challenge.id,
          team: team.id,
          challenge_point: (teams.length - index) * 20,
        })
      }
      await drawBonusCardsForChallenge(challenge.id)

      for (const card of await Card.findAll({ where: { challenge: challenge.id } })) {
        // Cards should be in challenge pool with no team assigned
        expect(card.team).toBeNull()
        expect(card.challenge).toBe(challenge.id)
        expect(drawnCardNames.has(card.name)).toBe(false)
        drawnCardNames.add(card.name)
      }
    }

    // 3 completed challenges x 8 cards drawn, all from distinct pool entries.
    expect(drawnCardNames.size).toBe(24)
    expect((await getCardPoolStatus()).drawn - baseline.drawn).toBe(24)
  })

  it('returns assigned inventory rows when their challenge is deleted', async () => {
    const baseline = await getCardPoolStatus()
    const challenge = await ChallengeController.create('Arena Return Inventory')
    const teams = await Promise.all(
      ['Return A', 'Return B', 'Return C', 'Return D', 'Return E'].map((name) =>
        TeamController.create(name)
      )
    )
    for (const [index, team] of teams.entries()) {
      await ChallengePointController.create({
        challenge: challenge.id,
        team: team.id,
        challenge_point: (teams.length - index) * 10,
      })
    }

    await drawBonusCardsForChallenge(challenge.id)
    expect(await Card.count({ where: { challenge: challenge.id } })).toBe(8)
    expect(await ChallengeController.remove(challenge.id)).toBe(true)
    expect(await Card.count()).toBe(80)
    expect(await getCardPoolStatus()).toEqual(baseline)
  })
})
