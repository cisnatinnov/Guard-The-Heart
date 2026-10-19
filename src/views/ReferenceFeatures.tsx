import { shuffleTeamIds } from '../services/turnOrder'
import { useEffect, useState } from 'react'
import { useTeams } from '../hooks/useTeams'
import { useChallenges } from '../hooks/useChallenges'
import { useParams } from 'react-router-dom'
import { latestTacticalResolution, readTacticalPhase, subscribeTacticalPhase } from '../services/tacticalPhase'
import { GPMark, TeamPill } from './PublicRankingBoard'
import '../styles/reference-ui.css'

const ORDER_KEY = 'guard-the-heart-turn-order'
function readOrder(): string[] { try { const value: unknown = JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [] } catch { return [] } }
export function TurnOrderView({ admin = false }: { admin?: boolean }) {
  const { teams } = useTeams()
  const [chosen, setChosen] = useState(readOrder)
  useEffect(() => { const update = () => setChosen(readOrder()); window.addEventListener('storage', update); return () => window.removeEventListener('storage', update) }, [])
  const names = ['kuning','merah','biru','pink','hijau']
  const candidates = [...teams].sort((a,b) => {
    const order = (name: string) => { const position = names.indexOf(name.toLowerCase().replace(/^tim\s+/, '')); return position < 0 ? 5 : position }
    return order(a.name) - order(b.name) || a.name.localeCompare(b.name)
  }).slice(0,5)
  const ordered = [...candidates].sort((a,b) => {
    const position = (id: string) => { const index = chosen.indexOf(id); return index < 0 ? chosen.length + candidates.findIndex((team) => team.id === id) : index }
    return position(a.id) - position(b.id)
  })
  function save(ids: string[]) { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)); setChosen(ids) }
  function shuffle() { save(shuffleTeamIds(candidates.map((team) => team.id))) }
  return <section className={admin ? 'view reference-feature-admin' : 'reference-feature-public'}>
    {admin && <div className="admin-toolbar"><button className="ghost" onClick={() => save([])}>Reset order</button><p>Click team names in the order they will play.</p></div>}
    <section className="reference-stage turn-order-stage" aria-label="Urutan Main"><img className="reference-art" src="/ui/visual-guide-slide-01.png" alt="" /><h1 className="sr-only">Urutan Main</h1>
      <div className="turn-order-panel"><ol className="turn-order-list">{ordered.map((team, slot) => <li key={team.id} className={`turn-order-item turn-order-item--${slot+1}`}><span className="turn-order-number">{slot + 1}</span><button type="button" aria-pressed={chosen.includes(team.id)} onClick={() => save(chosen.includes(team.id) ? chosen.filter((id) => id !== team.id) : [...chosen,team.id])}><TeamPill name={team.name} /></button></li>)}</ol></div>
      <button className="turn-order-shuffle" disabled={!candidates.length} onClick={shuffle}>Acak Giliran</button>
    </section>
  </section>
}
export function GigaRiskView({ admin = false }: { admin?: boolean }) {
  const { challengeId } = useParams()
  const { challenges } = useChallenges()
  const { teams } = useTeams({ includeInactive: true })
  const [, refresh] = useState(0)
  useEffect(() => {
    const ids = challengeId ? [challengeId] : challenges.map((challenge) => challenge.id)
    const unsubscribe = ids.map((id) => subscribeTacticalPhase(id, () => refresh((value) => value + 1)))
    return () => unsubscribe.forEach((stop) => stop())
  }, [challengeId, challenges])
  const result = challengeId
    ? (() => { const phase = readTacticalPhase(challengeId); return phase.resolution ?? phase.strike })()
    : latestTacticalResolution(challenges.map((challenge) => challenge.id))
  const activeChallenge = challengeId ? challenges.find((challenge) => challenge.id === challengeId)
    : challenges.find((challenge) => { const phase = readTacticalPhase(challenge.id); return result && (phase.resolution ?? phase.strike)?.resolvedAt === result.resolvedAt })
  const ordered = teams.filter((team) => result ? result.teams.some((entry) => entry.teamId === team.id) : team.status === 'active').sort((a,b) => { const names=['merah','biru','kuning','pink','hijau']; return names.indexOf(a.name.toLowerCase())-names.indexOf(b.name.toLowerCase()) }).slice(0,5)
  return <section className={admin ? 'view reference-feature-admin' : 'reference-feature-public'}>
    <section className="reference-stage giga-stage" aria-label="Serangan GigaRisk"><img className="reference-art" src="/ui/visual-guide-slide-08.png" alt="" /><h1 className="sr-only">Serangan GigaRisk</h1>
      <div className="giga-challenge">{activeChallenge?.name ?? 'Belum ada serangan'}</div>
      <div className="giga-panel">{ordered.map((team) => {
        const resolved = result?.teams.find((entry) => entry.teamId === team.id)
        const effects = resolved?.effects ?? []
        const before = resolved?.initialGP ?? team.total_gp
        const after = resolved?.finalGP ?? before
        const change = resolved?.gigaRisk ?? 0
        return <article key={team.id} className={`giga-row${after === 0 ? ' is-out' : ''}`} aria-label={`Hasil GigaRisk ${team.name}`}>
          <TeamPill name={team.name} />
          <div className="giga-health" role="meter" aria-label={`${team.name} GP`} aria-valuemin={0} aria-valuemax={Math.max(1,before,after)} aria-valuenow={after}><span style={{width:`${after / Math.max(1,before,after) * 100}%`}} /></div>
          <div className="giga-gp"><GPMark /><span>{before}</span><span className="giga-arrow">→</span><strong>{after}</strong><span>GP</span></div>
          <span className="giga-burst" title="Serangan GigaRisk">{change > 0 ? '+' : ''}{change}</span>
          <div className="giga-effects" aria-label={`Efek kartu ${team.name}`}>
            {effects.length > 0 && <ul tabIndex={0} aria-label={`Daftar efek ${team.name}`}>{effects.map((effect, index) => <li key={`${index}-${effect}`} className={`card-effect-outcome ${effect.startsWith('-') ? 'is-negative' : 'is-positive'}`}>{effect}</li>)}</ul>}
          </div>
        </article>
      })}</div>
    </section>
  </section>
}
