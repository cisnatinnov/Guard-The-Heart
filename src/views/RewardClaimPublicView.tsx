import { GPShield } from './GPShield'
import { publishPublicDisplay } from '../services/publicDisplay'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CardController } from '../controllers/CardController'
import { ChallengePointController } from '../controllers/ChallengePointController'
import { useChallenges } from '../hooks/useChallenges'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import { DB_EVENTS } from '../hooks/useDbEvents'
import { BlindReward, type TeamCard } from '../models'
import { blindRewardId, chooseRankFiveReward, ensureRankFiveRewards, FALSE_HOPE_IMAGE, type BlindOption } from '../services/blindRewards'
import { CARD_BACK_IMAGE } from '../data/card-pool'
import type { TeamCardReward } from '../services/cardDraw'
import { CardTile } from './CardTile'
import { RewardRankBadge } from './RewardRankBadge'
import { teamColour } from '../services/defaultTeams'
import '../styles/rewards.css'

interface RewardTeam extends TeamCardReward { cards: TeamCard[]; blind:BlindReward|null }
interface RewardState { challengeId: string | null; rows: RewardTeam[]; error: string | null }
const POINTER_KEY = 'guard-the-heart-reward-pointer'
interface RewardPointer { challengeId: string; teamId: string; optionId: string }

export function RewardClaimPublicView({ admin = false }: { admin?: boolean }) {
  const { challenges } = useChallenges()
  const { challengeId } = useParams<{ challengeId?: string }>()
  const navigate = useNavigate()
  const activeId = challengeId ?? challenges[0]?.id ?? null
  const activeChallenge = challenges.find((entry) => entry.id === activeId)
  const [state, setState] = useState<RewardState>({ challengeId: null, rows: [], error: null })
  const [navigationError, setNavigationError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pointer, setPointer] = useState<RewardPointer | null>(null)
  const request = useRef(0)

  useEffect(() => {
    if (admin) return
    const receive = (event: StorageEvent) => {
      if (event.key !== POINTER_KEY) return
      try {
        const value = event.newValue ? JSON.parse(event.newValue) as RewardPointer | null : null
        setPointer(value?.challengeId === activeId ? value : null)
      } catch { setPointer(null) }
    }
    window.addEventListener('storage', receive)
    return () => window.removeEventListener('storage', receive)
  }, [activeId, admin])

  useEffect(() => {
    if (!admin) return
    return () => { localStorage.removeItem(POINTER_KEY) }
  }, [activeId, admin])

  function highlight(teamId: string, optionId: string | null) {
    if (!admin || !activeId) return
    if (optionId) localStorage.setItem(POINTER_KEY, JSON.stringify({ challengeId: activeId, teamId, optionId }))
    else localStorage.removeItem(POINTER_KEY)
  }

  const load = useCallback(async () => {
    const version = ++request.current
    if (!activeId) return
    try {
      try { await ensureRankFiveRewards(activeId) }
      catch (cause) { setNavigationError(cause instanceof Error ? cause.message : String(cause)) }
      const [rewards, entries] = await Promise.all([
        CardController.getEligibleTeamsForChallenge(activeId),
        ChallengePointController.listByChallenge(activeId),
      ])
      const drawn = await CardController.isChallengeCardsDrawn(activeId)
      const entryIds = new Map(entries.map((entry) => [entry.team, entry.id]))
      const earnedRows = await Promise.all(rewards.map(async (reward) => ({
        ...reward,
        blind:await BlindReward.findByPk(blindRewardId(activeId,reward.teamId)),
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
      <div className="admin-toolbar">{challengeControl}<button disabled={!activeId} onClick={() => { if (activeId) void publishPublicDisplay('tactical', activeId).then(() => navigate(`/admin/tactical/${activeId}`)).catch((cause: unknown) => setNavigationError(cause instanceof Error ? cause.message : String(cause))) }}>Tactical Phase</button></div>
    </>}
    <section className="reward-stage reward-stage--earned" aria-label="Reward Claim">
    <img className="reward-stage__art" src="/ui/rewards/slide-02-reference.png" alt="" />
    <h1 className="sr-only">Reward Claim — Earned Cards</h1>
    {!admin && <div className="reward-stage__toolbar"><span className="reward-stage__challenge-name">{activeChallenge?.name ?? 'Reward Claim'}</span></div>}
    <ol className="reward-stage__rows" aria-label={`Rewards for ${activeChallenge?.name ?? 'challenge'}`}>
      {Array.from({ length: 5 }, (_, slot) => {
        const row = rows[slot]
        return <li className={`reward-stage__row reward-stage__row--${slot + 1} reward-stage__row--${teamColour(row?.teamName ?? '') ?? 'neutral'}`} key={row?.teamId ?? slot}
          style={{ '--slot': slot } as CSSProperties} aria-label={row?.teamName ?? 'Empty reward row'} aria-hidden={!row || undefined}>
          <RewardRankBadge rank={row?.rank ?? slot + 1} />
          <span className="reward-stage__team" title={row?.teamName}>{row?.teamName ?? '—'}</span>
          <div className="reward-stage__earned" aria-label={row ? `${row.cardCount} cards earned by ${row.teamName}` : undefined}>
            {row?.blind ? <div className="blind-reward" aria-label={`Rank 5 blind draw ${row.teamName}`}>
              <p>{row.blind.selected ? row.blind.selected === 'zonk' ? 'False Hope · tidak mendapat kartu' : '1 kartu Normal terpilih' : admin ? 'Pilih 1 kartu · Normal atau False Hope' : 'Admin memilih 1 dari 3 kartu'}</p>
              <div>{(JSON.parse(row.blind.options) as BlindOption[]).map((option,index) => {
                const opened = row.blind!.selected === option.id
                const visible = admin || opened
                const pointed = !admin && !row.blind!.selected && pointer?.challengeId === activeId && pointer.teamId === row.teamId && pointer.optionId === option.id
                return <button className={`blind-reward__card${opened ? ' is-open' : ''}${row.blind!.selected ? ' is-locked' : ''}${pointed ? ' is-pointed' : ''}`} key={option.id} disabled={!admin || busy || !!row.blind!.selected}
                  aria-label={visible ? `${admin ? 'Pilih ' : ''}${option.zonk ? 'False Hope — Zonk' : option.name}` : `Kartu tertutup ${index+1} untuk ${row.teamName}`}
                  onMouseEnter={() => highlight(row.teamId, option.id)} onMouseLeave={() => highlight(row.teamId, null)}
                  onFocus={() => highlight(row.teamId, option.id)} onBlur={() => highlight(row.teamId, null)}
                  onClick={async () => {
                    if (!admin || !activeId || busy || row.blind!.selected) return
                    highlight(row.teamId, null)
                    setBusy(true)
                    try {await chooseRankFiveReward(activeId,row.teamId,option.id);setNavigationError(null);await load()}
                    catch (cause) {setNavigationError(cause instanceof Error ? cause.message : String(cause))}
                    finally {setBusy(false)}
                  }}>
                  {visible && !option.zonk ? <CardTile {...option} /> : <img src={visible ? FALSE_HOPE_IMAGE : CARD_BACK_IMAGE} alt={visible ? 'False Hope' : 'Kartu tertutup'} />}
                  {pointed && <svg className="reward-pointer" viewBox="0 0 32 40" role="img" aria-label="Kursor admin · menyorot kartu"><path d="M12 21V7a3 3 0 0 1 6 0v10-2a3 3 0 0 1 5 0v3a3 3 0 0 1 5 1v1a3 3 0 0 1 3 3v5c0 4-2 7-4 9H13c-2-2-3-4-5-6l-5-7a3 3 0 0 1 4-4l5 4Z" fill="white" stroke="#38230d" strokeWidth="2" strokeLinejoin="round" /></svg>}
                </button>
              })}</div>
            </div> : row?.cards.length ? row.cards.map((card) => <div className="reward-stage__card" key={card.id}>
              <CardTile name={card.name} type={card.type} effect={card.effect} effect_action={card.effect_action} icon={card.icon} />
            </div>) : <span className="reward-stage__empty">{row ? row.cardCount === 0 ? '0 Kartu' : 'Kartu belum dibagikan' : '—'}</span>}
          </div>
          <span className="reward-stage__gp" aria-label={row ? `${row.guardPower} GP earned` : undefined}>
            <GPShield className="reward-stage__gp-icon" />
            <span>{row ? `+${row.guardPower} GP` : '—'}</span>
          </span>
        </li>
      })}
    </ol>
    {navigationError && <p className="reward-stage__status" role="alert">{navigationError}</p>}
    {status && <p className="reward-stage__status" role="status">{status}</p>}
  </section></div>
}
