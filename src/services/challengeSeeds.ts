import { CHALLENGE_GAMES, type ChallengeGameId } from './games'
import { Challenge } from '../models'

/**
 * Blueprint point 8/9: the six playable challenges are saved as challenge data
 * and cannot be added again, renamed or deleted.
 *
 * They are identified by their name, which is unique in the database and can
 * never be changed, so the lock survives reloads and older databases that
 * already hold one of these rows under a different id. Each game still carries
 * a fixed id, which is only used as the id for freshly seeded rows.
 */
export const LOCKED_CHALLENGE_IDS: readonly string[] = CHALLENGE_GAMES.map((game) => game.challengeId)

export function isLockedChallengeName(name: string): boolean {
  const wanted = normalize(name)
  return CHALLENGE_GAMES.some((game) => normalize(game.title) === wanted)
}

export function lockedChallengeNameFor(gameId: ChallengeGameId): string {
  const game = CHALLENGE_GAMES.find((entry) => entry.id === gameId)
  if (!game) throw new Error(`Unknown challenge game: ${gameId}`)
  return game.title
}

export function gameIdForChallengeName(name: string): ChallengeGameId | null {
  const wanted = normalize(name)
  return CHALLENGE_GAMES.find((game) => normalize(game.title) === wanted)?.id ?? null
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}

/**
 * Idempotent. An existing row with the same name is left untouched so its
 * scoreboard, bonus cards and timestamps survive a restart.
 */
export async function seedLockedChallenges(): Promise<Challenge[]> {
  const seeded: Challenge[] = []
  for (const game of CHALLENGE_GAMES) {
    const [challenge] = await Challenge.findOrCreate({
      where: { name: game.title },
      defaults: { id: game.challengeId, name: game.title },
    })
    seeded.push(challenge)
  }
  return seeded
}