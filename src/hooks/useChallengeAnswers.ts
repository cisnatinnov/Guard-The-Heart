import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChallengeAnswer } from '../models'
import { useDbEventRefresh } from './useDbEventRefresh'
import { DB_EVENTS } from './useDbEvents'
import { pendingChallengeTooth } from '../services/challengeAnswers'
import { ChallengePointController } from '../controllers/ChallengePointController'

const EVENTS = [DB_EVENTS.CHALLENGE_POINTS_CHANGED, DB_EVENTS.SCOREBOARD_CHANGED]
export function useChallengeAnswers(challengeId: string) {
  const [pending, setPending] = useState<ChallengeAnswer | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const request = useRef(0)
  const refresh = useCallback(async () => {
    const version = ++request.current
    const [answer, entries] = await Promise.all([pendingChallengeTooth(challengeId), ChallengePointController.listByChallenge(challengeId)])
    if (version !== request.current) return
    setPending(answer)
    setScores(Object.fromEntries(entries.map((entry) => [entry.team, entry.score])))
    setLoading(false)
  }, [challengeId])
  useEffect(() => { void refresh() }, [refresh])
  useDbEventRefresh(EVENTS, () => { void refresh() })
  return { pending, scores, refresh, loading }
}
