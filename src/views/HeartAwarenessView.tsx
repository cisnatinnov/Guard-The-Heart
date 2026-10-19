import { useTeams } from '../hooks/useTeams'
import { teamColour } from '../services/defaultTeams'
import { TeamPill } from './PublicRankingBoard'
import { GPShield } from './GPShield'

const colours = ['hijau', 'merah', 'kuning', 'biru', 'pink']
const number = new Intl.NumberFormat('id-ID')

export function HeartAwarenessView({ admin = false }: { admin?: boolean }) {
  const { teams, loading, error } = useTeams()
  const ordered = [...teams].sort((a, b) => {
    const position = (name: string) => {
      const index = colours.indexOf(teamColour(name) ?? '')
      return index < 0 ? colours.length : index
    }
    return position(a.name) - position(b.name) || a.name.localeCompare(b.name)
  })
  const pages = Array.from({ length: Math.max(1, Math.ceil(ordered.length / 5)) }, (_, index) => ordered.slice(index * 5, index * 5 + 5))
  return <section className={admin ? 'view reference-feature-admin' : 'reference-feature-public'}>
    {admin && <header className="view__header"><h2>Heart of Awareness</h2><p className="view__hint">Live Guard Power for active teams.</p></header>}
    {pages.map((page, index) => <section key={index} className="reference-stage awareness-stage" aria-label="Heart of Awareness">
      <img className="reference-art" src="/ui/heart-of-awareness-no-gp.png" alt="" />
      <h1 className="sr-only">Heart of Awareness</h1>
      <ol className="awareness-teams" aria-label="Current team GP">
        {Array.from({ length: 5 }, (_, slot) => {
          const team = page[slot]
          const gp = team?.total_gp ?? 0
          return <li key={team?.id ?? slot} className="awareness-team" aria-label={team ? `${team.name}: ${gp} GP` : 'Empty team slot'}>
            <div className={`awareness-name${team && teamColour(team.name) === colours[slot] ? ' awareness-name--native' : ''}`}>{team ? <TeamPill name={team.name} /> : <span className="team-pill">—</span>}</div>
            <GPShield className="awareness-gp-icon" />
            <div className="awareness-score"><strong style={{ fontSize: `${Math.min(5.5, 10 / number.format(gp).length)}cqw` }}>{team ? number.format(gp) : '—'}</strong></div>
          </li>
        })}
      </ol>
      {(error || loading || !ordered.length) && <p className="reference-status" role="status">{error ?? (loading ? 'Loading teams…' : 'No active teams.')}</p>}
    </section>)}
  </section>
}
