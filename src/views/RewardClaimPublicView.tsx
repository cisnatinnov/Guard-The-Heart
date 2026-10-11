import { displayPath, publishPublicDisplay } from '../services/publicDisplay'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CardController } from '../controllers/CardController'
import { ChallengePointController } from '../controllers/ChallengePointController'
import { useChallenges } from '../hooks/useChallenges'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import { DB_EVENTS } from '../hooks/useDbEvents'
import { CARD_BACK_IMAGE } from '../data/card-pool'
import type { TeamCard } from '../models'
import type { TeamCardReward } from '../services/cardDraw'
import { CardTile } from './CardTile'
import '../styles/rewards.css'

interface RewardTeam extends TeamCardReward { cards: TeamCard[] }
interface RewardState { challengeId: string | null; rows: RewardTeam[]; error: string | null }

export function RewardClaimPublicView({ reveal = false, admin = false }: { reveal?: boolean; admin?: boolean }) {
  const { challenges } = useChallenges()
  const { challengeId } = useParams<{ challengeId?: string }>()
  const navigate = useNavigate()
  const activeId = challengeId ?? challenges[0]?.id ?? null
  const activeChallenge = challenges.find((entry) => entry.id === activeId)
  const [state, setState] = useState<RewardState>({ challengeId: null, rows: [], error: null })
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [revealedCards, setRevealedCards] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
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
      const entryIds = new Map(entries.map((entry) => [entry.team, entry.id]))
      const rows = await Promise.all(rewards.map(async (reward) => ({
        ...reward,
        // Reward ownership is per challenge, rather than the team's collection.
        cards: (await CardController.listTeamCardsPermanent(reward.teamId))
          .filter((card) => card.challenge_point === entryIds.get(reward.teamId)),
      })))
      if (version === request.current) setState({ challengeId: activeId, rows, error: null })
    } catch (cause) {
      if (version === request.current) setState({ challengeId: activeId, rows: [], error: cause instanceof Error ? cause.message : String(cause) })
    }
  }, [activeId])

  useEffect(() => { void load() }, [load])
  useDbEventRefresh([DB_EVENTS.CARDS_CHANGED, DB_EVENTS.CHALLENGE_POINTS_CHANGED, DB_EVENTS.SCOREBOARD_CHANGED, DB_EVENTS.TEAMS_CHANGED], () => { void load() })

  const rows = state.challengeId === activeId ? state.rows : []
  const selected = rows.find((row) => row.teamId === selectedTeamId) ?? rows[0]
  const selectedIndex = selected ? rows.indexOf(selected) : 0
  const status = state.challengeId === activeId && state.error ? state.error
    : activeId && state.challengeId !== activeId ? 'Memuat hadiah…'
    : !activeChallenge ? 'Belum ada tantangan.'
    : rows.length === 0 ? 'Belum ada hasil untuk tantangan ini.' : null

  async function showCards() {
    if (!activeId || busy) return
    setBusy(true)
    setNavigationError(null)
    try {
      await publishPublicDisplay('cards', activeId)
      navigate(displayPath({ stage: 'cards', challengeId: activeId }, true))
    } catch (cause) {
      setNavigationError(cause instanceof Error ? cause.message : String(cause))
    } finally { setBusy(false) }
  }

  function toggleCard(id: string) {
    setRevealedCards((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return <section className={`reward-stage reward-stage--${reveal ? 'reveal' : 'claim'}`} aria-label={reveal ? 'Reveal challenge rewards' : 'Reward Claim'}>
    <img className="reward-stage__art" src={`/ui/rewards/${reveal ? 'reveal' : 'claim'}-reference.png`} alt="" />
    <h1 className="sr-only">{reveal ? 'Reward Claim — Card Reveal' : 'Reward Claim — Cards Earned'}</h1>
    <div className="reward-stage__toolbar">
      <label className="reward-stage__challenge">
        <span className="sr-only">Challenge</span>
        <select aria-label="Challenge" value={activeId ?? ''} onChange={(event) => navigate(`${admin ? '/admin' : ''}/${reveal ? 'cards' : 'rewards'}/${event.target.value}`)}>
          {!challenges.length && <option value="">Challenge</option>}
          {challenges.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>
      {admin && !reveal && <button type="button" disabled={busy || !activeId} onClick={showCards}>Rewards</button>}
      {reveal && <Link to={activeId ? `${admin ? '/admin' : ''}/rewards/${activeId}` : `${admin ? '/admin' : ''}/rewards`}>Jumlah kartu</Link>}
    </div>

    {!reveal ? <ol className="reward-stage__rows" aria-label={`Rewards for ${activeChallenge?.name ?? 'challenge'}`}>
      {Array.from({ length: 5 }, (_, slot) => {
        const row = rows[slot]
        return <li className={`reward-stage__row reward-stage__row--${slot + 1}`} key={row?.teamId ?? slot} style={{ '--slot': slot } as CSSProperties} aria-hidden={!row || undefined}>
          <span className="reward-stage__rank" aria-label={`Rank ${row?.rank ?? slot + 1}`}>
            <span className={row && row.rank === slot + 1 ? 'sr-only' : 'reward-stage__rank-value'}>{row?.rank ?? '—'}</span>
          </span>
          <span className="reward-stage__team" title={row?.teamName}>{row?.teamName ?? '—'}</span>
          <span className="reward-stage__earned">
            <span className="reward-stage__backs" aria-hidden="true">
              {Array.from({ length: row?.cardCount ?? 0 }, (_, card) => <img src={encodeURI(CARD_BACK_IMAGE)} key={card} alt="" />)}
            </span>
            <strong>{row ? `${row.cardCount} Kartu` : '—'}</strong>
          </span>
          <span className="reward-stage__gp" aria-label={row ? `${row.guardPower} GP earned` : undefined}>{row ? `+${row.guardPower}` : '—'}</span>
        </li>
      })}
    </ol> : <>
      <div className="reward-stage__tabs" role="tablist" aria-label="Teams">
        {Array.from({ length: 5 }, (_, slot) => {
          const row = rows[slot]
          return <button key={row?.teamId ?? slot} type="button" role="tab" id={`reward-team-${slot}`} aria-controls="reward-cards" aria-selected={row?.teamId === selected?.teamId && !!row} disabled={!row}
            tabIndex={row?.teamId === selected?.teamId ? 0 : -1}
            className={row?.teamId === selected?.teamId && row ? 'reward-stage__tab reward-stage__tab--active' : 'reward-stage__tab'}
            title={row?.teamName}
            onClick={() => setSelectedTeamId(row?.teamId ?? null)}
            onKeyDown={(event) => {
              if (!rows.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : (slot + (event.key === 'ArrowRight' ? 1 : -1) + rows.length) % rows.length
              setSelectedTeamId(rows[next].teamId)
              document.getElementById(`reward-team-${next}`)?.focus()
            }}>{row?.teamName ?? '—'}</button>
        })}
      </div>
      <div className="reward-stage__cards" id="reward-cards" role="tabpanel" aria-labelledby={`reward-team-${selectedIndex}`} style={{ '--cards': Math.max(1, selected?.cards.length ?? 0) } as CSSProperties}>
        {selected?.cards.length ? selected.cards.map((card, index) => <button type="button" key={card.id} className={`reward-stage__card${revealedCards.has(card.id) ? ' reward-stage__card--revealed' : ''}`} aria-label={`${revealedCards.has(card.id) ? 'Hide' : 'Reveal'} card ${index + 1} for ${selected.teamName ?? 'team'}`} aria-pressed={revealedCards.has(card.id)} onClick={() => toggleCard(card.id)}>
          {revealedCards.has(card.id) ? <CardTile name={card.name} type={card.type} effect={card.effect} effect_action={card.effect_action} icon={card.icon} /> : <img src={encodeURI(CARD_BACK_IMAGE)} alt="Hidden reward card" />}
        </button>) : <p className="reward-stage__empty">{selected ? selected.cardCount === 0 ? 'Tim ini tidak mendapat kartu dari tantangan ini.' : 'Kartu belum dibagikan untuk tantangan ini.' : 'Belum ada kartu untuk ditampilkan.'}</p>}
      </div>
      {selected && <div className="reward-stage__reveal-actions">
        <span>{selected.cards.length} / {selected.cardCount} kartu</span>
        {!!selected.cards.length && <button type="button" onClick={() => setRevealedCards((current) => new Set([...current, ...selected.cards.map((card) => card.id)]))}>Buka semua</button>}
      </div>}
    </>}
    {navigationError && <p className="reward-stage__status" role="alert">{navigationError}</p>}
    {status && <p className="reward-stage__status" role="status">{status}</p>}
    {!reveal && admin ? <button className="reward-stage__next" type="button" disabled={busy || !activeId} onClick={showCards} aria-label="Rewards" /> : !reveal ? <Link className="reward-stage__next" to={activeId ? `/cards/${activeId}` : '/cards'} aria-label="Reveal earned cards" />
      : <button className="reward-stage__next" type="button" disabled={rows.length < 2} aria-label="Next team" onClick={() => setSelectedTeamId(rows[(selectedIndex + 1) % rows.length].teamId)} />}
  </section>
}
