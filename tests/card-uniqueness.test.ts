import { beforeAll, describe, expect, it } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { Card, TeamCard } from '../src/models'
import { TeamController } from '../src/controllers/TeamController'
import { ChallengeController } from '../src/controllers/ChallengeController'
import { CARD_POOL, cardDesignKey, cardTitleFor } from '../src/data/card-pool'
import { allocateUniqueCards } from '../src/services/cardAllocation'
import { assignCardToTeam, replaceTeamCard, repairDuplicateTeamCards } from '../src/services/cardDraw'

beforeAll(async () => { await initializeAppDatabase() })

const thieves = CARD_POOL.filter((entry) => entry.type === 'Normal' && cardTitleFor(entry.name, entry.type) === 'Thief Card')
const shields = CARD_POOL.filter((entry) => entry.type === 'Normal' && cardTitleFor(entry.name, entry.type) === 'Shield Card')
const card = (index: number) => ({ ...thieves[index], id: `copy-${index}` })

describe('unique team card designs', () => {
  it('recognizes numbered copies, while different rarities are different designs', () => {
    expect(cardDesignKey(thieves[0])).toBe(cardDesignKey(thieves[1]))
    const rare = CARD_POOL.find((entry) => entry.type === 'Rare' && cardTitleFor(entry.name, entry.type) === 'Thief Card')!
    expect(cardDesignKey(thieves[0])).not.toBe(cardDesignKey(rare))
  })

  it('reassigns an earlier choice to fill every feasible reward slot', () => {
    const shield = { ...shields[0], id: 'shield' }
    const plan = allocateUniqueCards([card(0), shield], [
      { id: 'flexible', quota: 1, ownedDesigns: new Set<string>() },
      { id: 'thief-only', quota: 1, ownedDesigns: new Set([cardDesignKey(shield)]) },
    ])
    expect(plan).toHaveLength(2)
    expect(plan.find((entry) => entry.teamId === 'thief-only')?.card.id).toBe('copy-0')
  })

  it('leaves duplicate copies waiting and excludes designs owned in other challenges', () => {
    const plan = allocateUniqueCards([card(0), card(1), card(2)], [
      { id: 'already-owned', quota: 3, ownedDesigns: new Set([cardDesignKey(thieves[0])]) },
      { id: 'new-team', quota: 3, ownedDesigns: new Set<string>() },
    ])
    expect(plan).toHaveLength(1)
    expect(plan[0].teamId).toBe('new-team')
  })

  it('blocks concurrent duplicate assignments without consuming the rejected card', async () => {
    const team = await TeamController.create('Unique Concurrent Team')
    const challenge = await ChallengeController.create('Unique Concurrent Challenge')
    const copies = await Promise.all(thieves.slice(0, 2).map(async (entry) => {
      const inventory = (await Card.findOne({ where: { name: entry.name } }))!
      await inventory.update({ challenge: challenge.id })
      return inventory
    }))
    const results = await Promise.allSettled(copies.map((entry) => assignCardToTeam(entry.id, team.id)))
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await TeamCard.count({ where: { team: team.id } })).toBe(1)
    expect(await Card.count({ where: { challenge: challenge.id, team: null } })).toBe(1)
  })

  it('rejects duplicate replacements before removing the original card', async () => {
    const team = await TeamController.create('Unique Replacement Team')
    const challenge = await ChallengeController.create('Unique Replacement Challenge')
    const copies = await Promise.all([thieves[2], shields[0], thieves[3]].map(async (entry) => {
      const inventory = (await Card.findOne({ where: { name: entry.name } }))!
      await inventory.update({ challenge: challenge.id })
      return inventory
    }))
    await assignCardToTeam(copies[0].id, team.id)
    const old = await assignCardToTeam(copies[1].id, team.id)
    await expect(replaceTeamCard(team.id, old.id, copies[2].id)).rejects.toThrow(/already owns this card design/)
    expect(await TeamCard.findByPk(old.id)).not.toBeNull()
    expect((await Card.findByPk(copies[2].id))?.team).toBeNull()
  })

  it('repairs saved duplicate designs while preserving card count and reward ownership', async () => {
    const team = await TeamController.create('Unique Repair Team')
    const challenge = await ChallengeController.create('Unique Repair Challenge')
    for (const entry of thieves.slice(4, 7)) {
      const inventory = (await Card.findOne({ where: { name: entry.name } }))!
      await inventory.update({ challenge: challenge.id, team: team.id })
      await TeamCard.create({ ...entry, team: team.id })
    }
    const before = await Card.count({ where: { challenge: challenge.id } })
    await repairDuplicateTeamCards()
    const owned = await TeamCard.findAll({ where: { team: team.id } })
    expect(owned).toHaveLength(3)
    expect(new Set(owned.map(cardDesignKey)).size).toBe(3)
    expect(owned.every((entry) => entry.type === 'Normal')).toBe(true)
    expect(await Card.count({ where: { challenge: challenge.id, team: team.id } })).toBe(before)
    const names = owned.map((entry) => entry.name)
    await repairDuplicateTeamCards()
    expect((await TeamCard.findAll({ where: { team: team.id } })).map((entry) => entry.name)).toEqual(names)
  })
})
