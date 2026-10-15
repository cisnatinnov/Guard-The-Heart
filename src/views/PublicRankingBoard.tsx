import { teamColour } from '../services/defaultTeams'
import { CARD_BACK_IMAGE } from '../data/card-pool'
import '../styles/reference-ui.css'

export interface PublicRankingRow {
  id: string; rank: number; team: string; points: number; guardPower?: number
  initialGP?: number; gigaRisk?: number; effects?: string[]; remainingCards?: number
}
const number = new Intl.NumberFormat('id-ID')
export function GPMark() { return <span className="gp-mark" aria-hidden="true">GP</span> }
export function TeamPill({ name }: { name: string }) {
  return <span className={`team-pill team-pill--${teamColour(name) ?? 'neutral'}`} title={name}><span>Tim {name.replace(/^tim\s+/i, '')}</span></span>
}
export function PublicRankingBoard({ variant, rows, challenge, message, guardPoints = [] }: {
  variant: 'scoreboard' | 'leaderboard'; rows: PublicRankingRow[]; challenge?: string; message?: string
  guardPoints?: Array<Pick<PublicRankingRow, 'id' | 'team' | 'guardPower'>>
}) {
  const final = variant === 'leaderboard'
  const pages = Array.from({ length: Math.max(1, Math.ceil(rows.length / 5)) }, (_, index) => rows.slice(index * 5, index * 5 + 5))
  return <div className="public-ranking-pages">{pages.map((page, index) => <section key={index} className={`public-ranking reference-ranking reference-ranking--${variant}`} aria-label={final ? 'Final leaderboard' : 'Score Board'}>
    <img className="reference-art" src={final ? '/ui/visual-guide-slide-09.png' : '/ui/Page_Score_Board.jpeg'} alt="" />
    <h1 className="sr-only">{final ? 'Leaderboard' : 'Scoreboard'}</h1>
    {!final && <div className="ranking-challenge">{challenge ?? 'Scoreboard'}</div>}
    {final ? <div className="ranking-leader-panel"><table className="ranking-table" aria-label="Team leaderboard">
      <thead><tr>{['Rank','Nama Tim','CP','GP Awal','Serangan GigaRisk','Efek Kartu','GP Akhir','Sisa Kartu'].map((label) => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{page.map((row) => <tr key={row.id} className={row.guardPower === 0 ? 'is-out' : ''}>
        <td><img className="ranking-medal" src={`/ui/Icon%20rank/Icon-Rank_${Math.min(5, row.rank)}.png`} alt={`Rank ${row.rank}`} /></td>
        <td><TeamPill name={row.team} />{row.guardPower === 0 && <small className="out-label">OUT</small>}</td>
        <td className="ranking-cp"><strong>{number.format(row.points)}</strong></td>
        <td><GPMark /><strong>{number.format(row.initialGP ?? row.guardPower ?? 0)}</strong></td>
        <td className="ranking-damage">{(row.gigaRisk ?? 0) > 0 ? '+' : ''}{row.gigaRisk ?? 0}</td>
        <td className={`ranking-effects${(row.effects?.length ?? 0)>4 ? ' ranking-effects--dense' : ''}`} title={row.effects?.join('\n')}><div className="ranking-effect-list">{row.effects?.length ? row.effects.map((effect, i) => <div className={effect.startsWith('+') ? 'positive' : 'negative'} key={i}>{effect}</div>) : <span>—</span>}</div></td>
        <td><GPMark /><strong>{number.format(row.guardPower ?? 0)}</strong></td>
        <td><img className="ranking-card" src={encodeURI(CARD_BACK_IMAGE)} alt="" /><strong>{row.remainingCards ?? 0}</strong></td>
      </tr>)}</tbody>
    </table></div> : <div className="ranking-score-panel"><ol className="ranking-score-list" aria-label="Challenge ranking">
      {page.map((row, slot) => <li key={row.id} className={`ranking-score-item ranking-score-item--${slot + 1}`}>
        <img className="ranking-medal" src={`/ui/Icon%20rank/Icon-Rank_${Math.min(5, row.rank)}.png`} alt={`Rank ${row.rank}`} />
        <TeamPill name={row.team} /><strong>{number.format(row.points)}</strong><span className="ranking-point-label">Poin</span>
      </li>)}
    </ol></div>}
    {!final && <ol className="ranking-gp-strip" aria-label="Current team GP">
      {[...page.map(row=>guardPoints.find(team=>team.team===row.team)??row),...guardPoints.filter(team=>!page.some(row=>row.team===team.team))].slice(0,5).map(team=><li key={team.id} className="ranking-gp-item" aria-label={`${team.team}: ${team.guardPower??0} GP`}>
        <TeamPill name={team.team}/><GPMark/><strong>{number.format(team.guardPower??0)}</strong>
      </li>)}
    </ol>}
    {message && <p className="reference-status" role="status">{message}</p>}
  </section>)}</div>
}
