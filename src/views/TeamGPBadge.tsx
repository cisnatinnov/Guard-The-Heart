import { TeamPill } from './TeamPill'
import { GPShield } from './GPShield'
import '../styles/team-gp.css'

export function TeamGPBadge({ name, colour, gp, className = '' }: { name: string; colour?: string | null; gp: number | null; className?: string }) {
  return <span className={`team-gp-badge ${className}`.trim()} aria-label={`${name}: ${gp === null ? '—' : gp} GP`}>
    <TeamPill name={name} colour={colour} /><GPShield className="gp-mark" />
    <strong className="team-gp-badge__value">{gp === null ? '—' : new Intl.NumberFormat('id-ID').format(gp)}</strong>
  </span>
}
