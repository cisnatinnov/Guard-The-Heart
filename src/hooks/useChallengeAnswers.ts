import { useCallback, useEffect, useRef, useState } from 'react'
import { Team, ChallengeAnswer } from '../models'
import { useDbEventRefresh } from './useDbEventRefresh'
import { DB_EVENTS } from './useDbEvents'
import { pendingChallengeTooth } from '../services/challengeAnswers'
import { ChallengePointController } from '../controllers/ChallengePointController'

const EVENTS = [DB_EVENTS.CHALLENGE_POINTS_CHANGED, DB_EVENTS.SCOREBOARD_CHANGED, DB_EVENTS.TEAMS_CHANGED]
export function useChallengeAnswers(challengeId: string) {
  const [answers, setAnswers] = useState<ChallengeAnswer[]>([])
  const [recordedIds, setRecordedIds] = useState<string[]>([])
  const [pending, setPending] = useState<ChallengeAnswer | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const request = useRef(0)
  const refresh = useCallback(async () => {
    const version = ++request.current
    const [answer, entries, answers, inactive] = await Promise.all([pendingChallengeTooth(challengeId), ChallengePointController.listByChallenge(challengeId), ChallengeAnswer.findAll({ where: { challenge: challengeId } }), Team.findAll({ where: { status: 'inactive' } })])
    if (version !== request.current) return
    setEliminatedIds(inactive.map((team) => team.id))
    setAnswers(answers)
    setRecordedIds(answers.map((entry) => entry.id))
    setPending(answer)
    setScores(Object.fromEntries(entries.map((entry) => [entry.team, entry.score])))
    setLoading(false)
  }, [challengeId])
  useEffect(() => { void refresh() }, [refresh])
  useDbEventRefresh(EVENTS, () => { void refresh() })
  return { pending, scores, refresh, loading, recordedIds, answers, eliminatedIds }
}
