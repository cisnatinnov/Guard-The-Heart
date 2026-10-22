import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChallengePointController } from '../controllers/ChallengePointController'
import { useChallenges } from '../hooks/useChallenges'
import { useTeams } from '../hooks/useTeams'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import type { ChallengePointEntry } from '../controllers/ChallengePointController'
import { DB_EVENTS } from '../hooks/useDbEvents'

import { PublicRankingBoard } from './PublicRankingBoard'

const EMPTY_ENTRIES: ChallengePointEntry[] = []

export function ChallengePointPublicView({ challengeName }: { challengeName?: string } = {}) {
  const { teams } = useTeams()
  const { challenges } = useChallenges()
  const params = useParams<{ challengeId?: string }>()
  const [entriesByChallenge, setEntriesByChallenge] = useState<Record<string, ChallengePointEntry[]>>({})
  const [error, setError] = useState<string | null>(null)

  const activeId = challengeName ? challenges.find((challenge) => challenge.name === challengeName)?.id ?? null
    : params.challengeId ?? challenges[0]?.id ?? null
  const entries = activeId ? (entriesByChallenge[activeId] ?? EMPTY_ENTRIES) : EMPTY_ENTRIES
  const activeChallenge = challenges.find((challenge) => challenge.id === activeId)

  const load = useCallback(async (challengeId: string | null) => {
    if (!challengeId) return
    try {
      const rows = await ChallengePointController.listByChallenge(challengeId)
      setEntriesByChallenge((current) => ({ ...current, [challengeId]: rows }))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [])

  useEffect(() => {
    void load(activeId)
  }, [activeId, load])

  // Real-time updates
  useDbEventRefresh([DB_EVENTS.CHALLENGE_POINTS_CHANGED, DB_EVENTS.SCOREBOARD_CHANGED, DB_EVENTS.TEAMS_CHANGED], () => {
    void load(activeId)
  })

  return (
    <section className="view view--public-ranking">
      <PublicRankingBoard
        variant="scoreboard"
        guardPoints={teams.map(team=>({id:team.id,team:team.name,colour:team.colour,guardPower:team.total_gp}))}
        challenge={activeChallenge?.name}
        rows={entries.map((entry) => ({ id: entry.id, rank: entry.rank, team: entry.teamRef?.name ?? '—', colour: entry.teamRef?.colour, points: entry.score }))}
        message={error ?? (challenges.length === 0 ? 'No challenges are available yet.' : undefined)}
      />
    </section>
  )
}
