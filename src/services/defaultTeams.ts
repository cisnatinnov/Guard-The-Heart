import { Team } from '../models'

export const DEFAULT_TEAM_NAMES = ['Merah', 'Hijau', 'Biru', 'Kuning', 'Pink'] as const

type TeamIdentity = { name: string; colour: string | null }

export function teamColour(team: string | TeamIdentity): string | null {
  if (typeof team !== 'string') return team.colour
  const colour = team.trim().toLowerCase().replace(/^tim\s+/, '')
  return DEFAULT_TEAM_NAMES.find((entry) => entry.toLowerCase() === colour)?.toLowerCase() ?? null
}

export function isDefaultTeam(team: string | TeamIdentity): boolean {
  return teamColour(team) !== null
}

/** Persist original colours and reuse their identities even after a rename. */
export async function seedDefaultTeams(): Promise<void> {
  const teams = await Team.findAll()
  for (const name of DEFAULT_TEAM_NAMES) {
    const colour = name.toLowerCase()
    const existing = teams.find((team) => team.colour === colour)
      ?? teams.find((team) => !team.colour && teamColour(team.name) === colour)
    if (existing) {
      if (!existing.colour) await existing.update({ colour })
    } else {
      await Team.create({ name, colour, status: 'active' })
    }
  }
}
