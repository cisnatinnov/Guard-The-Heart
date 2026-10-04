import { initDatabase, getSequelize } from './sequelize-provider'
import { defineModels } from '../models'
import { synchronizeAllChallengeBonusCards } from '../services/cardDraw'
import { seedLockedChallenges } from '../services/challengeSeeds'

const LEGACY_TABLES = ['challange', 'challange_scoreboard']
const REQUIRED_TABLES = ['team', 'challenge', 'challenge_scoreboard', 'scoreboard', 'card', 'team_card']

let readyPromise: Promise<void> | null = null

async function isLegacySchema(sequelize: ReturnType<typeof getSequelize>): Promise<boolean> {
  const queryInterface = sequelize.getQueryInterface()
  const tables = (await queryInterface.showAllTables()) as string[]

  if (LEGACY_TABLES.some((table) => tables.includes(table))) return true

  const missingTables = REQUIRED_TABLES.filter((table) => !tables.includes(table))
  if (missingTables.length > 0) return false

  for (const table of REQUIRED_TABLES) {
    const description = (await queryInterface.describeTable(table)) as Record<string, unknown>
    if (!('createdAt' in description) || !('updatedAt' in description)) {
      return true
    }
  }

  // Guard power moved from the scoreboard onto the team, so a database created
  // by an older build no longer matches the models.
  const team = (await queryInterface.describeTable('team')) as Record<string, unknown>
  return !('total_gp' in team)
}

export function initializeAppDatabase(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const sequelize = await initDatabase()
      defineModels(sequelize)
      // The blueprint changed shape (team FKs, per-team scoreboard), so a
      // database persisted by an older build is discarded rather than
      // migrated. Current databases keep their data and are synced in place.
      await sequelize.sync({ force: await isLegacySchema(sequelize) })
      // The six playable challenges are challenge data, so they exist from the
      // first launch and cannot be added again, renamed or deleted.
      await seedLockedChallenges()
      await synchronizeAllChallengeBonusCards()
    })()
  }
  return readyPromise
}

export function isDatabaseReady(): boolean {
  try {
    getSequelize()
    return true
  } catch {
    return false
  }
}