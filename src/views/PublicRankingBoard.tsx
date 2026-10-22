import { TeamPill } from './TeamPill'
import { TeamGPBadge } from './TeamGPBadge'
import { CARD_BACK_IMAGE } from '../data/card-pool'
import { GPShield } from './GPShield'
import { MAX_ENTRIES_PER_CHALLENGE } from '../services/rankRules'
import '../styles/reference-ui.css'

export interface PublicRankingRow {
  id: string; rank: number; team: string; points: number; guardPower?: number
  initialGP?: number; gigaRisk?: number; effects?: string[]; remainingCards?: number; status?: 'active' | 'inactive'
  pendingScore?: boolean
}
const number = new Intl.NumberFormat('id-ID')
export function GPMark() { return <GPShield className="gp-mark" /> }
export { TeamPill } from './TeamPill'
export function PublicRankingBoard({ variant, rows, challenge, message, guardPoints = [] }: {
  variant: 'scoreboard' | 'leaderboard'; rows: PublicRankingRow[]; challenge?: string; message?: string
  guardPoints?: Array<Pick<PublicRankingRow, 'id' | 'team' | 'guardPower'>>
}) {
  const final = variant === 'leaderboard'
  const scoresComplete = rows.length === MAX_ENTRIES_PER_CHALLENGE && new Set(rows.map((row) => row.team)).size === MAX_ENTRIES_PER_CHALLENGE
    && rows.every((row) => Number.isFinite(row.points) && row.rank > 0)
  const byName = (a: PublicRankingRow, b: PublicRankingRow) => a.team.replace(/^tim\s+/i, '').trim().localeCompare(b.team.replace(/^tim\s+/i, '').trim(), 'id', { sensitivity: 'base', numeric: true })
  const displayRows: PublicRankingRow[] = final ? rows : scoresComplete ? [...rows].sort((a, b) => a.rank - b.rank || byName(a, b))
    : [...rows, ...guardPoints.filter((team) => !rows.some((row) => row.team === team.team))
      .map((team) => ({ ...team, points: 0, rank: 0, pendingScore: true }))].sort(byName)
  const pages = Array.from({ length: Math.max(1, Math.ceil(displayRows.length / 5)) }, (_, index) => displayRows.slice(index * 5, index * 5 + 5))
  return <div className="public-ranking-pages">{pages.map((page, index) => <section key={index} className={`public-ranking reference-ranking reference-ranking--${variant}`} aria-label={final ? 'Final leaderboard' : 'Score Board'}>
    <img className="reference-art" src={final ? '/ui/visual-guide-slide-09.png' : '/ui/Page_Score_Board.jpeg'} alt="" />
    <h1 className="sr-only">{final ? 'Leaderboard' : 'Scoreboard'}</h1>
    {!final && <div className="ranking-challenge">{challenge ?? 'Scoreboard'}</div>}
    {final ? <div className="ranking-leader-panel"><table className="ranking-table" aria-label="Team leaderboard">
      <thead><tr>{['Rank','Nama Tim','GP Awal','Serangan GigaRisk','Efek Kartu','GP Akhir','Sisa Kartu'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{page.map((row) => <tr key={row.id} className={row.status === 'inactive' || row.guardPower === 0 ? 'is-out' : ''}>
        <td><img className="ranking-medal" src={`/ui/Icon%20rank/Icon-Rank_${Math.min(5, row.rank)}.png`} alt={`Rank ${row.rank}`} /></td>
        <td><div className="ranking-team-name"><TeamPill name={row.team} />{(row.status === 'inactive' || row.guardPower === 0) && <small className="out-label">OUT</small>}</div></td>
        <td><GPMark /><strong>{number.format(row.initialGP ?? row.guardPower ?? 0)}</strong></td>
        <td className="ranking-damage">{(row.gigaRisk ?? 0) > 0 ? '+' : ''}{row.gigaRisk ?? 0}</td>
        <td className={`ranking-effects${(row.effects?.length ?? 0)>4 ? ' ranking-effects--dense' : ''}`} title={row.effects?.join('\n')}><div className="ranking-effect-list">{row.effects?.length ? row.effects.map((effect, i) => <div className={effect.startsWith('+') || effect.startsWith('Fortune Draw:') ? 'positive' : 'negative'} key={i}>{effect}</div>) : <span>—</span>}</div></td>
        <td><GPMark /><strong>{number.format(row.guardPower ?? 0)}</strong></td>
        <td><img className="ranking-card" src={encodeURI(CARD_BACK_IMAGE)} alt="" /><strong>{row.remainingCards ?? 0}</strong></td>
      </tr>)}</tbody>
    </table></div> : <div className="ranking-score-panel"><ol className={`ranking-score-list${scoresComplete ? '' : ' ranking-score-list--pending'}`} aria-label="Challenge ranking">
      {page.map((row, slot) => <li key={row.id} className={`ranking-score-item ranking-score-item--${slot + 1}`}>
        {scoresComplete && <img className="ranking-medal" src={`/ui/Icon%20rank/Icon-Rank_${Math.min(5, row.rank)}.png`} alt={`Rank ${row.rank}`} />}
        <TeamPill name={row.team} /><strong aria-label={row.pendingScore ? 'Score not entered' : undefined}>{row.pendingScore ? '—' : number.format(row.points)}</strong><span className="ranking-point-label">Poin</span>
      </li>)}
    </ol></div>}
    {!final && <ol className="ranking-gp-strip" aria-label="Current team GP">
      {[...page.map(row=>guardPoints.find(team=>team.team===row.team)??row),...guardPoints.filter(team=>!page.some(row=>row.team===team.team))].slice(0,5).map(team=><li key={team.id} className="ranking-gp-item" aria-label={`${team.team}: ${team.guardPower??0} GP`}>
        <TeamGPBadge name={team.team} gp={team.guardPower??0}/>
      </li>)}
    </ol>}
    {message && <p className="reference-status" role="status">{message}</p>}
  </section>)}</div>
}
