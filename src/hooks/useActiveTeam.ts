import { useEffect, useState } from 'react'
import { readEventTimer, subscribeEventTimer } from '../services/eventTimer'

export function useActiveTeam() {
  const [teamId, setTeamId] = useState(() => readEventTimer().activeTeamId)
  useEffect(() => subscribeEventTimer(() => setTeamId(readEventTimer().activeTeamId)), [])
  return teamId
}
