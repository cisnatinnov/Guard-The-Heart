import { Team } from '../models'

export const DEFAULT_TEAM_NAMES = ['Merah', 'Hijau', 'Biru', 'Kuning', 'Pink'] as const

export function teamColour(name: string): string | null {
  const colour = name.trim().toLowerCase().replace(/^tim\s+/, '')
  return DEFAULT_TEAM_NAMES.find((entry) => entry.toLowerCase() === colour)?.toLowerCase() ?? null
}

export function isDefaultTeam(name: string): boolean {
  return teamColour(name) !== null
}

/** Reuse existing colour teams so their scores and cards stay attached. */
export async function seedDefaultTeams(): Promise<void> {
  const teams = await Team.findAll()
  for (const name of DEFAULT_TEAM_NAMES) {
    const existing = teams.find((team) => teamColour(team.name) === name.toLowerCase())
    if (!existing) await Team.create({ name, status: 'active' })
  }
}
