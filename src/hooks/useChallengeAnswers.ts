import { useCallback, useEffect, useRef, useState } from 'react'
import { ChallengeAnswer } from '../models'
import { useDbEventRefresh } from './useDbEventRefresh'
import { DB_EVENTS } from './useDbEvents'
import { pendingChallengeTooth } from '../services/challengeAnswers'
import { ChallengePointController } from '../controllers/ChallengePointController'

const EVENTS = [DB_EVENTS.CHALLENGE_POINTS_CHANGED, DB_EVENTS.SCOREBOARD_CHANGED]
export function useChallengeAnswers(challengeId: string) {
  const [recordedIds, setRecordedIds] = useState<string[]>([])
  const [pending, setPending] = useState<ChallengeAnswer | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const request = useRef(0)
  const refresh = useCallback(async () => {
    const version = ++request.current
    const [answer, entries, answers] = await Promise.all([pendingChallengeTooth(challengeId), ChallengePointController.listByChallenge(challengeId), ChallengeAnswer.findAll({ where: { challenge: challengeId } })])
    if (version !== request.current) return
    setRecordedIds(answers.map((entry) => entry.id))
    setPending(answer)
    setScores(Object.fromEntries(entries.map((entry) => [entry.team, entry.score])))
    setLoading(false)
  }, [challengeId])
  useEffect(() => { void refresh() }, [refresh])
  useDbEventRefresh(EVENTS, () => { void refresh() })
  return { pending, scores, refresh, loading, recordedIds }
}
