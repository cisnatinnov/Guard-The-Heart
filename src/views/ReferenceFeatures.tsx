import { englishText } from '../services/english'
import { orderTeams, publishTurnOrder, shuffleTeamIds } from '../services/turnOrder'
import { useTurnOrder } from '../hooks/useTurnOrder'
import { useEffect, useState } from 'react'
import { useTeams } from '../hooks/useTeams'
import { useChallenges } from '../hooks/useChallenges'
import { useParams } from 'react-router-dom'
import { latestTacticalResolution, readTacticalPhase, subscribeTacticalPhase } from '../services/tacticalPhase'
import { GPMark, TeamPill } from './PublicRankingBoard'
import '../styles/reference-ui.css'
import { gigaRiskImpact } from '../services/cardPresentation'
import { publishEventTimer, readEventTimer, subscribeEventTimer } from '../services/eventTimer'

export function TurnOrderView({ admin = false }: { admin?: boolean }) {
  const { teams } = useTeams()
  const chosen = useTurnOrder()
  const [timer, setTimer] = useState(readEventTimer)
  useEffect(() => subscribeEventTimer(() => setTimer(readEventTimer())), [])
  const candidates = orderTeams(teams, []).slice(0,5)
  const ordered = orderTeams(candidates, chosen)
  function save(ids: string[]) {
    if (!admin) return
    publishTurnOrder(ids)
    publishEventTimer({ ...readEventTimer(), activeTeamId: ids[0] ?? candidates[0]?.id ?? null })
  }
  function shuffle() { save(shuffleTeamIds(candidates.map((team) => team.id))) }
  function reset() {
    save([])
  }
  return <section className={admin ? 'view reference-feature-admin' : 'reference-feature-public'}>
    {admin && <div className="admin-toolbar"><button className="ghost" onClick={reset}>Reset order</button><p>Click a team name to choose whose turn it is. Shuffle Order shuffles the play order.</p></div>}
    <section className="reference-stage turn-order-stage" aria-label="Turn Order"><img className="reference-art" src="/ui/visual-guide-slide-01.png" alt="" /><h1 className="english-turn-order-title">Turn Order</h1>
      <div className="turn-order-panel"><ol className="turn-order-list">{ordered.map((team, slot) => <li key={team.id} className={`turn-order-item turn-order-item--${slot+1}`} aria-current={timer.activeTeamId === team.id ? 'step' : undefined}><span className="turn-order-number">{slot + 1}</span><button type="button" aria-pressed={timer.activeTeamId === team.id} disabled={!admin} onClick={() => { if (admin) publishEventTimer({ ...readEventTimer(), activeTeamId: team.id }) }}><TeamPill name={team.name} colour={team.colour} /></button>{timer.activeTeamId === team.id && <span className="turn-order-turn">Your Turn</span>}</li>)}</ol></div>
      <button className="turn-order-shuffle" disabled={!admin || !candidates.length} onClick={shuffle}>Shuffle Order</button>
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
  const ordered = teams.filter((team) => result ? result.teams.some((entry) => entry.teamId === team.id) : team.status === 'active').sort((a,b) => { const names=['merah','biru','kuning','pink','hijau']; return names.indexOf(a.colour ?? '')-names.indexOf(b.colour ?? '') }).slice(0,5)
  return <section className={admin ? 'view reference-feature-admin' : 'reference-feature-public'}>
    <section className="reference-stage giga-stage" aria-label="GigaRisk Attack"><img className="reference-art" src="/ui/visual-guide-slide-08.png" alt="" /><h1 className="english-giga-title">GigaRisk Attack</h1><p className="english-giga-subtitle">Each active team −2 GP</p>
      <div className="giga-challenge">{activeChallenge?.name ?? 'No attack yet'}</div>
      <div className="giga-panel">{ordered.map((team) => {
        const resolved = result?.teams.find((entry) => entry.teamId === team.id)
        const effects = resolved?.effects.map(englishText) ?? []
        const after = resolved?.finalGP
        return <article key={team.id} className={`giga-row${after === 0 ? ' is-out' : ''}${resolved ? ' is-resolved' : ' is-pending'}`} aria-label={`GigaRisk result ${team.name}`}>
          <TeamPill name={team.name} colour={team.colour} />
          {resolved ? <>
            <div className="giga-gp" aria-label={`GP after attack ${team.name}`}><GPMark /><strong>{after}</strong><span>GP</span></div>
            <span className="giga-impact giga-burst" aria-label={`Attack outcome ${team.name}`} title={gigaRiskImpact(resolved)}>{resolved.gigaRisk < 0 ? `−${Math.abs(resolved.gigaRisk)}` : resolved.gigaRisk > 0 ? `+${resolved.gigaRisk}` : '0'}</span>
          </> : <p className="giga-waiting">Waiting for Attack all teams −2 GP</p>}
          {resolved && <div className="giga-effects" aria-label={`Card effects ${team.name}`}>
            {effects.length > 0 && <ul tabIndex={0} aria-label={`Effect list ${team.name}`}>{effects.map((effect, index) => <li key={`${index}-${effect}`} className={`card-effect-outcome ${effect.startsWith('-') ? 'is-negative' : 'is-positive'}`}>{effect}</li>)}</ul>}
          </div>}
        </article>
      })}</div>
    </section>
  </section>
}
