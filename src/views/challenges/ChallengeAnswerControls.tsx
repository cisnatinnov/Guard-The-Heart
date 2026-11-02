import { WorkbookQuiz, useWorkbookQuiz } from './WorkbookQuiz'
import { useChallengeAnswers } from '../../hooks/useChallengeAnswers'
import { englishText } from '../../services/english'
import { useEffect, useRef, useState } from 'react'
import { useTeams } from '../../hooks/useTeams'
import { useActiveTeam } from '../../hooks/useActiveTeam'
import { useTurnOrder } from '../../hooks/useTurnOrder'
import { assignChallengeOpponent, recordChallengeAnswer } from '../../services/challengeAnswers'
import { orderTeams } from '../../services/turnOrder'
import { publishEventTimer, readEventTimer } from '../../services/eventTimer'
import '../../styles/challenge-answers.css'

export function ChallengeAnswerControls({ challengeId, jaw = false, canControl, state, disabled = false, matching = false, onAnswer, hideQuiz = false }: {
  challengeId: string; jaw?: boolean; canControl: boolean; state: ReturnType<typeof useChallengeAnswers>; disabled?: boolean; matching?: boolean; hideQuiz?: boolean; onAnswer?: (answer: import('../../models').ChallengeAnswer) => Promise<void>
}) {
  const quiz = useWorkbookQuiz(challengeId, jaw ? 'jaws-of-risk' : 'match-card')
  const { teams } = useTeams({ includeInactive: true })
  const order = useTurnOrder()
  const activeTeam = useActiveTeam()
  const ordered = orderTeams(teams, order)
  const eligible = ordered.filter((team) => team.status === 'active')
  const teamId = eligible.find((team) => team.id === activeTeam)?.id ?? eligible[0]?.id ?? ''
  const answerId = `${challengeId}:${quiz.question?.id}:${teamId}`
  const alreadyAnswered = state.recordedIds.includes(answerId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitting = useRef(false)
  useEffect(() => {
    if (canControl && !state.loading && !state.pending && teamId && teamId !== activeTeam) {
      publishEventTimer({ ...readEventTimer(), activeTeamId: teamId })
    }
  }, [canControl, state.loading, state.pending, teamId, activeTeam])
  async function answer(option: string) {
    if (alreadyAnswered || !canControl || submitting.current || disabled || state.loading || state.pending || !teamId || !quiz.question || ordered.length > 5) return
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      const recorded = await recordChallengeAnswer({ id: answerId, challenge: challengeId, team: teamId, correct: option === quiz.question.answer, jaw, matching, deferMatching: matching })
      quiz.grade()
      await onAnswer?.(recorded)
      await state.refresh()
    } catch (cause) { setError(englishText(cause instanceof Error ? cause.message : String(cause))) }
    finally { submitting.current = false; setBusy(false) }
  }
  async function chooseOpponent(id: string) {
    if (!canControl || busy || !state.pending || state.pending.pressing_team) return
    setBusy(true)
    setError(null)
    try { await assignChallengeOpponent(state.pending.id, id); publishEventTimer({ ...readEventTimer(), activeTeamId: id }); await state.refresh() }
    catch (cause) { setError(englishText(cause instanceof Error ? cause.message : String(cause))) }
    finally { setBusy(false) }
  }
  const name = (id: string | null) => teams.find((team) => team.id === id)?.name ?? 'Team'
  const recorded = state.answers.find((answer) => answer.id === answerId)
  return <>
    {!hideQuiz && <WorkbookQuiz challengeId={challengeId} gameKey={jaw ? 'jaws-of-risk' : 'match-card'} canControl={canControl}
      locked={!!state.pending || busy} teamId={teamId} eliminatedIds={jaw ? state.eliminatedIds : []}
      answerDisabled={disabled || state.loading || alreadyAnswered || !teamId || ordered.length > 5}
      onAnswer={(option) => quiz.selectAnswer(option, teamId)} />}
    {canControl && !hideQuiz && <button type="button" disabled={busy || disabled || alreadyAnswered || !!state.pending || quiz.state.answerSelection?.teamId !== teamId || quiz.state.answerSelection?.questionId !== quiz.question?.id} onClick={() => { const option = quiz.state.answerSelection?.option; if (option) void answer(option) }}>Grade this question</button>}
    <section className="challenge-answer-controls" aria-label="Challenge scoring" aria-busy={busy}>
      <div className="challenge-score-grid" aria-label="Challenge scores">
        {ordered.map((team) => <article key={team.id} className={`challenge-score team-colour--${team.colour ?? 'neutral'}${state.eliminatedIds.includes(team.id) && jaw ? ' is-out' : ''}`} aria-current={team.id === teamId ? 'step' : undefined}>
          <span>{team.name}</span><strong>{state.scores[team.id] ?? 0}</strong><small>{jaw && state.eliminatedIds.includes(team.id) ? 'OUT · deactivated' : team.id === teamId ? 'Your turn' : 'Ready'}</small>
        </article>)}
      </div>
      {ordered.length > 5 && <p className="alert alert--error">A challenge supports up to five active teams. Deactivate extra teams to play.</p>}
      {!ordered.length && <p role="status">Create or activate a team to play.</p>}
      {jaw && !eligible.length && ordered.length > 0 && <p role="status">All teams have been eliminated. Challenge complete.</p>}
      {state.pending && (state.pending.pressing_team ? <p role="status"><strong>{name(state.pending.pressing_team)}</strong> must choose {Math.max(0, 2 - state.pending.press_count)} more {state.pending.press_count === 1 ? 'tooth' : 'teeth'}. A bite deactivates the team.</p>
        : <div className="opponent-choice" role="group" aria-label="Choose opponent"><p role="status">Correct! {name(state.pending.team)} earns +10. Choose an opponent to press the teeth.</p>
          {canControl && eligible.filter((team) => team.id !== state.pending!.team).map((team) => <button type="button" className="ghost" key={team.id} disabled={busy} onClick={() => void chooseOpponent(team.id)}>{team.name}</button>)}
          {eligible.filter((team) => team.id !== state.pending!.team).length === 0 && <p>The last remaining team wins this challenge.</p>}
        </div>)}
      {jaw && eligible.length === 1 && recorded?.correct && !state.pending && <p role="status">{name(teamId)} is the last remaining team and wins this challenge.</p>}
      {canControl && recorded && !state.pending && <p role="status">{recorded.correct ? 'Correct · +10 points.' : 'Incorrect · −10 points.'} Choose the next team or question.</p>}
      {error && <p className="alert alert--error">{error}</p>}
    </section>
  </>
}
