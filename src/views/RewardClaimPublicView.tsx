import { publishPublicDisplay } from '../services/publicDisplay'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CardController } from '../controllers/CardController'
import { ChallengePointController } from '../controllers/ChallengePointController'
import { useChallenges } from '../hooks/useChallenges'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import { DB_EVENTS } from '../hooks/useDbEvents'
import type { TeamCard } from '../models'
import type { TeamCardReward } from '../services/cardDraw'
import { CardTile } from './CardTile'
import { RewardRankBadge } from './RewardRankBadge'
import { teamColour } from '../services/defaultTeams'
import '../styles/rewards.css'

interface RewardTeam extends TeamCardReward { cards: TeamCard[] }
interface RewardState { challengeId: string | null; rows: RewardTeam[]; error: string | null }

export function RewardClaimPublicView({ admin = false }: { admin?: boolean }) {
  const { challenges } = useChallenges()
  const { challengeId } = useParams<{ challengeId?: string }>()
  const navigate = useNavigate()
  const activeId = challengeId ?? challenges[0]?.id ?? null
  const activeChallenge = challenges.find((entry) => entry.id === activeId)
  const [state, setState] = useState<RewardState>({ challengeId: null, rows: [], error: null })
  const [navigationError, setNavigationError] = useState<string | null>(null)
  const request = useRef(0)

  const load = useCallback(async () => {
    const version = ++request.current
    if (!activeId) return
    try {
      const [rewards, entries] = await Promise.all([
        CardController.getEligibleTeamsForChallenge(activeId),
        ChallengePointController.listByChallenge(activeId),
      ])
      const drawn = await CardController.isChallengeCardsDrawn(activeId)
      const entryIds = new Map(entries.map((entry) => [entry.team, entry.id]))
      const earnedRows = await Promise.all(rewards.map(async (reward) => ({
        ...reward,
        // Reward ownership is per challenge, rather than the team's collection.
        cards: (await CardController.listTeamCardsPermanent(reward.teamId))
          .filter((card) => card.challenge_point === entryIds.get(reward.teamId)),
      })))
      const rows = earnedRows.map((row) => ({ ...row, cardCount: drawn ? row.cards.length : row.cardCount }))
      if (version === request.current) setState({ challengeId: activeId, rows, error: null })
    } catch (cause) {
      if (version === request.current) setState({ challengeId: activeId, rows: [], error: cause instanceof Error ? cause.message : String(cause) })
    }
  }, [activeId])

  useEffect(() => { void load() }, [load])
  useDbEventRefresh([DB_EVENTS.CARDS_CHANGED, DB_EVENTS.CHALLENGE_POINTS_CHANGED, DB_EVENTS.SCOREBOARD_CHANGED, DB_EVENTS.TEAMS_CHANGED], () => { void load() })

  const rows = state.challengeId === activeId ? state.rows : []
  const status = state.challengeId === activeId && state.error ? state.error
    : activeId && state.challengeId !== activeId ? 'Memuat hadiah…'
    : !activeChallenge ? 'Belum ada tantangan.'
    : rows.length === 0 ? 'Belum ada hasil untuk tantangan ini.' : null

  async function selectChallenge(id: string) {
    setNavigationError(null)
    try {
      if (admin) await publishPublicDisplay('rewards', id)
      navigate(`${admin ? '/admin' : ''}/rewards/${id}`)
    } catch (cause) {
      setNavigationError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  async function showPublicRewards() {
    if (!activeId) return
    window.open(`/rewards/${encodeURIComponent(activeId)}`, '_blank', 'noopener')
    try {
      await publishPublicDisplay('rewards', activeId)
      setNavigationError(null)
    } catch (cause) {
      setNavigationError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const challengeControl = <label className={admin ? 'field' : 'reward-stage__challenge'}>
    <span className={admin ? undefined : 'sr-only'}>Challenge</span>
    <select aria-label="Challenge" value={activeId ?? ''} onChange={(event) => void selectChallenge(event.target.value)}>
      {!challenges.length && <option value="">Challenge</option>}
      {challenges.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select>
  </label>
  return <div className={admin ? 'view reward-admin' : 'reward-public'}>
    {admin && <>
      <header className="view__header"><h2>Reward Claim</h2><p className="view__hint">Cards and Guard Points earned in the selected challenge.</p></header>
      <div className="admin-toolbar">{challengeControl}<button disabled={!activeId} onClick={() => void showPublicRewards()}>Show Rewards (Public)</button><button disabled={!activeId} onClick={() => { if (activeId) void publishPublicDisplay('tactical', activeId).then(() => navigate(`/admin/tactical/${activeId}`)).catch((cause: unknown) => setNavigationError(cause instanceof Error ? cause.message : String(cause))) }}>Tactical Phase</button></div>
    </>}
    <section className="reward-stage reward-stage--earned" aria-label="Reward Claim">
    <img className="reward-stage__art" src="/ui/rewards/slide-02-reference.png" alt="" />
    <h1 className="sr-only">Reward Claim — Earned Cards</h1>
    {!admin && <div className="reward-stage__toolbar">{challengeControl}</div>}
    <ol className="reward-stage__rows" aria-label={`Rewards for ${activeChallenge?.name ?? 'challenge'}`}>
      {Array.from({ length: 5 }, (_, slot) => {
        const row = rows[slot]
        return <li className={`reward-stage__row reward-stage__row--${slot + 1} reward-stage__row--${teamColour(row?.teamName ?? '') ?? 'neutral'}`} key={row?.teamId ?? slot}
          style={{ '--slot': slot } as CSSProperties} aria-label={row?.teamName ?? 'Empty reward row'} aria-hidden={!row || undefined}>
          <RewardRankBadge rank={row?.rank ?? slot + 1} />
          <span className="reward-stage__team" title={row?.teamName}>{row?.teamName ?? '—'}</span>
          <div className="reward-stage__earned" aria-label={row ? `${row.cardCount} cards earned by ${row.teamName}` : undefined}>
            {row?.cards.length ? row.cards.map((card) => <div className="reward-stage__card" key={card.id}>
              <CardTile name={card.name} type={card.type} effect={card.effect} effect_action={card.effect_action} icon={card.icon} />
            </div>) : <span className="reward-stage__empty">{row ? row.cardCount === 0 ? '0 Kartu' : 'Kartu belum dibagikan' : '—'}</span>}
          </div>
          <span className="reward-stage__gp" aria-label={row ? `${row.guardPower} GP earned` : undefined}>
            <svg viewBox="0 0 64 80" className="reward-stage__gp-icon" aria-hidden="true"><path d="M32 3 61 17 57 54 32 77 7 54 3 17Z" fill="#67dbff" stroke="#0c9edc" strokeWidth="2" /><path d="M32 10 54 21 50 50 32 67 14 50 10 21Z" fill="#0759da" stroke="#b9f5ff" strokeWidth="3" /><text x="32" y="46" textAnchor="middle" fill="white" fontFamily="Arial" fontWeight="bold" fontSize="25">GP</text></svg>
            {row ? `+${row.guardPower} GP` : '—'}
          </span>
        </li>
      })}
    </ol>
    {navigationError && <p className="reward-stage__status" role="alert">{navigationError}</p>}
    {status && <p className="reward-stage__status" role="status">{status}</p>}
  </section></div>
}
