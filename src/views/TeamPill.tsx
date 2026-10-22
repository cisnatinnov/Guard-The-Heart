import { teamColour } from '../services/defaultTeams'

export function TeamPill({ name, colour }: { name: string; colour?: string | null }) {
  return <span className={`team-pill team-pill--${(colour === undefined ? teamColour(name) : colour) ?? 'neutral'}`} title={name}><span>{name.replace(/^tim\s+/i, '')}</span></span>
}
