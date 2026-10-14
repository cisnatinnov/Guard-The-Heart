import { useCallback, useEffect, useRef, useState } from 'react'
import { CardController } from '../controllers/CardController'
import { TeamController } from '../controllers/TeamController'
import { ChallengePointController } from '../controllers/ChallengePointController'
import type { TeamCard } from '../models'
import { useDbEventRefresh } from './useDbEventRefresh'
import { DB_EVENTS } from './useDbEvents'

export interface TacticalTeam { id: string; name: string; gp: number; cards: TeamCard[] }

export function useTacticalTeams(challengeId: string) {
  const [state, setState] = useState<{ challengeId: string; teams: TacticalTeam[] }>({ challengeId: '', teams: [] })
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  const load = useCallback(async () => {
    const version = ++request.current
    if (!challengeId) return
    try {
      const [all, entries] = await Promise.all([TeamController.list(), ChallengePointController.listByChallenge(challengeId)])
      const participants = new Set(entries.map((entry) => entry.team))
      const entryIds = new Map(entries.map((entry) => [entry.team, entry.id]))
      const ordered = all.filter((team) => !participants.size || participants.has(team.id))
        .sort((a, b) => b.total_gp - a.total_gp || a.name.localeCompare(b.name)).slice(0, 5)
      const rows = await Promise.all(ordered.map(async (team) => ({ id: team.id, name: team.name, gp: team.total_gp,
        cards: (await CardController.listTeamCardsPermanent(team.id, true)).filter((card) =>
          entryIds.has(team.id) && card.challenge_point === entryIds.get(team.id)) })))
      if (version === request.current) { setState({ challengeId, teams: rows }); setError(null) }
    } catch (cause) { if (version === request.current) setError(cause instanceof Error ? cause.message : String(cause)) }
  }, [challengeId])
  useEffect(() => { void load() }, [load])
  useDbEventRefresh([DB_EVENTS.CARDS_CHANGED, DB_EVENTS.TEAMS_CHANGED, DB_EVENTS.CHALLENGE_POINTS_CHANGED], () => { void load() })
  return { teams: state.challengeId === challengeId ? state.teams : [], error, loading: !!challengeId && state.challengeId !== challengeId }
}
