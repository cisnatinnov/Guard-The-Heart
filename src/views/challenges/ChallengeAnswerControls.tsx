import { useChallengeAnswers } from '../../hooks/useChallengeAnswers'
import { englishText } from '../../services/english'
import { useRef, useState } from 'react'
import { useTeams } from '../../hooks/useTeams'
import { useActiveTeam } from '../../hooks/useActiveTeam'
import { useTurnOrder } from '../../hooks/useTurnOrder'
import { recordChallengeAnswer } from '../../services/challengeAnswers'
import { orderTeams } from '../../services/turnOrder'
import { publishEventTimer, readEventTimer } from '../../services/eventTimer'
import '../../styles/challenge-answers.css'


export function ChallengeAnswerControls({ challengeId, jaw = false, canControl, state, disabled = false, matching = false, onAnswer }: {
  challengeId: string; jaw?: boolean; canControl: boolean; state: ReturnType<typeof useChallengeAnswers>; disabled?: boolean; matching?: boolean; onAnswer?: (answer: import('../../models').ChallengeAnswer) => Promise<void>
}) {
  const { teams } = useTeams()
  const order = useTurnOrder()
  const activeTeam = useActiveTeam()
  const ordered = orderTeams(teams, order)
  const teamId = teams.some((team) => team.id === activeTeam) ? activeTeam! : ordered[0]?.id ?? ''
  const [opponent, setOpponent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitting = useRef(false)
  const opponents = ordered.filter((team) => team.id !== teamId)
  const validOpponent = opponents.some((team) => team.id === opponent) ? opponent : ''
  async function answer(correct: boolean) {
    if (!canControl || submitting.current || disabled || state.loading || state.pending || !teamId) return
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      const recorded = await recordChallengeAnswer({ id: crypto.randomUUID(), challenge: challengeId, team: teamId, correct, jaw, matching, opponent: validOpponent })
      await onAnswer?.(recorded)
      await state.refresh()
    } catch (cause) { setError(englishText(cause instanceof Error ? cause.message : String(cause))) }
    finally { submitting.current = false; setBusy(false) }
  }
  const name = (id: string | null) => teams.find((team) => team.id === id)?.name ?? 'Team'
  return <section className="challenge-answer-controls" aria-label="Challenge scoring" aria-busy={busy}>
    <div className="challenge-answer-controls__scores" aria-label="Challenge scores">
      {ordered.map((team) => <span key={team.id}>{team.name}: <strong>{state.scores[team.id] ?? 0}</strong></span>)}
    </div>
    {state.pending && <p role="status"><strong>{name(state.pending.pressing_team)}</strong> must press {Math.max(0, 2 - state.pending.press_count)} more {state.pending.press_count === 1 ? 'tooth' : 'teeth'} (minimum 2 per answer). A bite deducts 5 from their challenge score.</p>}
    {canControl && <fieldset disabled={busy || disabled || state.loading || !!state.pending}>
      <legend>Record an answer</legend>
      <label>Answering team<select aria-label="Answering team" value={teamId} onChange={(event) => publishEventTimer({ ...readEventTimer(), activeTeamId: event.target.value })}>
        {ordered.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select></label>
      {jaw && <label>Opponent to press after a right answer<select aria-label="Opponent to press" value={validOpponent} onChange={(event) => setOpponent(event.target.value)}>
        <option value="">Choose opponent</option>{opponents.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select></label>}
      <button type="button" disabled={!teamId || (jaw && !validOpponent)} onClick={() => void answer(true)}>Right Answer (+10)</button>
      <button type="button" disabled={!teamId} onClick={() => void answer(false)}>Wrong Answer (-10)</button>
    </fieldset>}
    {error && <p className="alert alert--error">{error}</p>}
  </section>
}
