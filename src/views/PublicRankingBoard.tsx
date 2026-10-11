import type { CSSProperties } from 'react'

export interface PublicRankingRow {
  id: string
  rank: number
  team: string
  points: number
  guardPower?: number
}

const number = new Intl.NumberFormat('id-ID')

/** Keep the original illustration intact; only its data fields are live. */
export function PublicRankingBoard({ variant, rows, challenge, message }: {
  variant: 'scoreboard' | 'leaderboard'
  rows: PublicRankingRow[]
  challenge?: string
  message?: string
}) {
  const final = variant === 'leaderboard'
  const pages = Array.from({ length: Math.max(1, Math.ceil(rows.length / 5)) }, (_, page) => rows.slice(page * 5, page * 5 + 5))

  return <div className="public-ranking-pages">
    {pages.map((page, pageIndex) => <section className={`public-ranking public-ranking--${variant}`} key={pageIndex} aria-label={final ? 'Final leaderboard' : 'Score Board'}>
      <img className="public-ranking__art" src={final ? '/ui/Page_Leaderboard.jpeg' : '/ui/scoreboard-slide9.png'} alt="" />
      <h1 className="sr-only">{final ? 'Final Leaderboard' : 'Score Board'}</h1>
      {!final && <>
        <div className="public-ranking__challenge">{challenge}</div>
        <div className="public-ranking__point-heading" aria-hidden="true">Point</div>
      </>}
      {final && <div className="public-ranking__score-headings" aria-hidden="true">
        <span>🏆 Skor Challenge</span><span>🛡 Final GP Point</span>
      </div>}
      <table className="public-ranking__table" aria-label={final ? 'Team leaderboard' : 'Challenge ranking'}>
        <thead className="sr-only"><tr>
          <th scope="col">Rank</th><th scope="col">Tim</th><th scope="col">{final ? 'Skor Challenge' : 'Challenge point'}</th>
          {final && <th scope="col">Final GP Point</th>}
        </tr></thead>
        <tbody>{Array.from({ length: 5 }, (_, slot) => {
          const row = page[slot]
          return <tr key={row?.id ?? `empty-${slot}`} className={`public-ranking__row public-ranking__row--${slot + 1}`} style={{ '--slot': slot } as CSSProperties} aria-hidden={!row || undefined}>
            <td className="public-ranking__rank"><span className={row?.rank === slot + 1 ? 'sr-only' : 'public-ranking__rank-value'}>{row?.rank ?? '–'}</span></td>
            <td className="public-ranking__team" title={row?.team}>{row?.team ?? '—'}</td>
            <td className="public-ranking__points">{row ? number.format(row.points) : '—'}</td>
            {final && <td className="public-ranking__gp">{row ? number.format(row.guardPower ?? 0) : '—'}</td>}
          </tr>
        })}</tbody>
      </table>
      {message && <p className="public-ranking__status" role="status">{message}</p>}
    </section>)}
  </div>
}
