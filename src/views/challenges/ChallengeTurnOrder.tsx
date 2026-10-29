import { useTeams } from '../../hooks/useTeams'
import { useTurnOrder } from '../../hooks/useTurnOrder'
import { useActiveTeam } from '../../hooks/useActiveTeam'
import { orderTeams, publishTurnOrder, shuffleTeamIds } from '../../services/turnOrder'
import { publishEventTimer, readEventTimer } from '../../services/eventTimer'

export function ChallengeTurnOrder({ teamIds, disabled = false, onShuffle }: { teamIds?: string[]; disabled?: boolean; onShuffle?: (ids: string[]) => void }) {
  const { teams } = useTeams()
  const order = useTurnOrder()
  const active = useActiveTeam()
  const ordered = orderTeams(teams.filter((team) => !teamIds || teamIds.includes(team.id)), order)
  return <section className="challenge-turn-order" aria-label="Challenge turn order">
    <h3>Turn Order</h3>
    <ol>{ordered.map((team, index) => <li key={team.id}><button className="ghost" type="button" disabled={disabled} aria-pressed={active === team.id} onClick={() => publishEventTimer({ ...readEventTimer(), activeTeamId: team.id })}>{index + 1}. {team.name}{active === team.id ? ' · Your turn' : ''}</button></li>)}</ol>
    <button type="button" className="ghost" disabled={disabled || !ordered.length} onClick={() => {
      const ids = shuffleTeamIds(ordered.map((team) => team.id))
      publishTurnOrder(ids)
      publishEventTimer({ ...readEventTimer(), activeTeamId: ids[0] ?? null })
      onShuffle?.(ids)
    }}>Shuffle order</button>
  </section>
}
