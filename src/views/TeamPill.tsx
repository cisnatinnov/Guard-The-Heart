import { teamColour } from '../services/defaultTeams'

export function TeamPill({ name }: { name: string }) {
  return <span className={`team-pill team-pill--${teamColour(name) ?? 'neutral'}`} title={name}><span>Tim {name.replace(/^tim\s+/i, '')}</span></span>
}
