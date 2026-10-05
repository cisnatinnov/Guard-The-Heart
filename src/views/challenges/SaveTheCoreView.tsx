import { useEffect, useState } from 'react'
import { useTeams } from '../../hooks/useTeams'
import { MAX_ENTRIES_PER_CHALLENGE } from '../../services/rankRules'
import {
  CORE_DIE_SIDES,
  CORE_FINISH_BONUS,
  CORE_GAME_DURATION_SECONDS,
  CORE_PLAYERS,
  CORE_TRACK_LENGTH,
  createCoreGame,
  coreTileCoordinate,
  coreLeaderboard,
  expireCoreGame,
  playCoreTurn,
  playersOnTile,
  revealedBombCount,
  type CorePlayerDefinition,
  type CoreGameState,
  type CoreOutcome,
} from '../../services/games'

type RosterMode = 'guardians' | 'teams'

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function SaveTheCoreView() {
  const { teams, loading: teamsLoading, error: teamsError } = useTeams()
  const [state, setState] = useState<CoreGameState>(() => createCoreGame())
  const [started, setStarted] = useState(false)
  const [rosterMode, setRosterMode] = useState<RosterMode>('guardians')
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [remainingSeconds, setRemainingSeconds] = useState(CORE_GAME_DURATION_SECONDS)
  const [lastOutcome, setLastOutcome] = useState<CoreOutcome | null>(null)
  const [lastMessage, setLastMessage] = useState<string | null>(null)

  const active = state.players[state.turnIndex]
  const leaderboard = coreLeaderboard(state)
  const boardSquares = state.tiles
    .map((tile) => {
      const coordinate = coreTileCoordinate(tile.index)
      return {
        coordinate,
        file: coordinate.charCodeAt(0) - 'a'.charCodeAt(0),
        rank: Number(coordinate.slice(1)),
        tile,
      }
    })
    .sort((a, b) => b.rank - a.rank || a.file - b.file)
  const teamPlayers: CorePlayerDefinition[] = teams
    .filter((team) => selectedTeamIds.includes(team.id))
    .map((team, index) => {
      const appearance = CORE_PLAYERS[index % CORE_PLAYERS.length]
      return { id: team.id, name: team.name, icon: appearance.icon, color: appearance.color }
    })

  useEffect(() => {
    if (!started || state.over) return
    const interval = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [started, state.over])

  useEffect(() => {
    if (!started || remainingSeconds > 0 || state.over) return
    setState(expireCoreGame)
    setLastMessage('Time is up. Final scores are shown below.')
    setLastOutcome(null)
  }, [started, remainingSeconds, state.over])

  function startGame() {
    const players = rosterMode === 'teams' ? teamPlayers : CORE_PLAYERS
    setState(createCoreGame(Math.random, { players }))
    setRemainingSeconds(CORE_GAME_DURATION_SECONDS)
    setLastOutcome(null)
    setLastMessage(null)
    setStarted(true)
  }

  function roll() {
    if (!started || state.over || remainingSeconds === 0) return
    const result = playCoreTurn(state)
    setState(result.state)
    setLastOutcome(result.outcome)
    setLastMessage(result.state.log.at(-1)?.text ?? null)
  }

  function reset() {
    setState(createCoreGame())
    setStarted(false)
    setRemainingSeconds(CORE_GAME_DURATION_SECONDS)
    setLastOutcome(null)
    setLastMessage(null)
  }

  return (
    <div className="game">
      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">Round</span>
          <span className="stat__value">{state.round}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Track</span>
          <span className="stat__value">{CORE_TRACK_LENGTH}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Bombs found</span>
          <span className="stat__value">{revealedBombCount(state)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Core bonus</span>
          <span className="stat__value">{CORE_FINISH_BONUS}</span>
        </div>
        {started && (
          <div className="stat">
            <span className="stat__label">Time remaining</span>
            <span className="stat__value" role="timer" aria-label="Time remaining">
              {formatTime(remainingSeconds)}
            </span>
          </div>
        )}
      </div>

      {!started ? (
        <section className="core-placement" aria-label="Choose players or teams">
          <div>
            <h3 className="core-placement__title">Who is playing?</h3>
            <p className="muted">
              Start with the four built-in Guardians, or select active teams. Each pawn is placed
              randomly on the 24-space path. Select up to {MAX_ENTRIES_PER_CHALLENGE} teams.
              Reach the Core before five minutes are up.
            </p>
          </div>
          <div className="core-placement__players">
            <button
              type="button"
              className={`core-placement__player${rosterMode === 'guardians' ? ' core-placement__player--selected' : ''}`}
              aria-pressed={rosterMode === 'guardians'}
              onClick={() => setRosterMode('guardians')}
            >
              Built-in Guardians
            </button>
            <button
              type="button"
              className={`core-placement__player${rosterMode === 'teams' ? ' core-placement__player--selected' : ''}`}
              aria-pressed={rosterMode === 'teams'}
              onClick={() => setRosterMode('teams')}
            >
              Teams
            </button>
          </div>

          {rosterMode === 'guardians' ? (
            <ul className="core-roster">
              {CORE_PLAYERS.map((player) => (
                <li key={player.id}>
                  <span aria-hidden="true">{player.icon}</span> {player.name}
                </li>
              ))}
            </ul>
          ) : (
            <fieldset className="run-panel__teams">
              <legend>Teams competing</legend>
              {teamsLoading && <p className="muted">Loading teams…</p>}
              {teamsError && <p className="alert alert--error">{teamsError}</p>}
              {!teamsLoading && teams.length === 0 && (
                <p className="muted">Create an active team first, or use the built-in Guardians.</p>
              )}
              {teams.map((team) => (
                <label key={team.id} className="checkbox">
                  <input
                    type="checkbox"
                    checked={selectedTeamIds.includes(team.id)}
                    disabled={
                      !selectedTeamIds.includes(team.id) &&
                      selectedTeamIds.length >= MAX_ENTRIES_PER_CHALLENGE
                    }
                    onChange={() =>
                      setSelectedTeamIds((current) =>
                        current.includes(team.id)
                          ? current.filter((id) => id !== team.id)
                          : [...current, team.id]
                      )
                    }
                  />
                  <span>{team.name}</span>
                </label>
              ))}
            </fieldset>
          )}

          <button
            type="button"
            onClick={startGame}
            disabled={rosterMode === 'teams' && (teamsLoading || teamPlayers.length === 0)}
          >
            Start 5-minute game
          </button>
        </section>
      ) : (
        <>
          <div className="core-turn">
            <span className="core-turn__active">
              <span aria-hidden="true">{active?.icon}</span> {active?.name} to roll
            </span>
            <button type="button" onClick={roll} disabled={state.over || remainingSeconds === 0}>
              Roll the d{CORE_DIE_SIDES}
            </button>
          </div>

          {state.over && (
            <p className={state.endReason === 'core' ? 'alert alert--ok' : 'alert alert--info'}>
              {state.endReason === 'core'
                ? `${state.players.find((player) => player.finished)?.name ?? 'A player'} reached the Core. Final scores are shown below.`
                : 'Time is up. No player reached the Core; final scores are shown below.'}
            </p>
          )}
          {!state.over && lastMessage && (
            <p
              className={
                lastOutcome === 'bomb'
                  ? 'alert alert--error'
                  : lastOutcome === 'core'
                    ? 'alert alert--ok'
                    : 'alert alert--info'
              }
            >
              {lastMessage}
            </p>
          )}

          <div className="core-board" role="grid" aria-label="Chessboard track to the Core">
            {boardSquares.map(({ coordinate, file, rank, tile }) => {
              const occupants = playersOnTile(state, tile.index)
              const isActive = occupants.some((player) => player.id === active?.id)
              const className = [
                'core-square',
                (file + rank) % 2 === 0 ? 'core-square--light' : 'core-square--dark',
                `core-square--${tile.kind}`,
                tile.revealed ? 'core-square--revealed' : '',
                isActive ? 'core-square--active' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <div
                  role="gridcell"
                  key={coordinate}
                  className={className}
                  aria-label={`${coordinate}, ${tile.kind} square, path space ${tile.index + 1}${occupants.length ? `, ${occupants.map((player) => player.name).join(', ')}` : ''}`}
                >
                  <span className="core-square__coordinate">{coordinate}</span>
                  <span className="core-square__mark" aria-hidden="true">
                    {tile.kind === 'bomb'
                      ? tile.revealed
                        ? '💥'
                        : '❓'
                      : tile.kind === 'core'
                        ? '💎'
                        : tile.revealed
                          ? `+${tile.score}`
                          : '·'}
                  </span>
                  <span className="core-square__pieces">
                    {occupants.map((player) => (
                      <span
                        key={player.id}
                        className="core-piece"
                        style={{ background: player.color }}
                        title={player.name}
                      >
                        {player.icon}
                      </span>
                    ))}
                  </span>
                </div>
              )
            })}
          </div>

          <ul className="core-leaderboard" aria-label="Final scores">
            {leaderboard.map((player, index) => (
              <li key={player.id} className="core-leaderboard__row">
                <span className="core-leaderboard__rank">{index + 1}</span>
                <span className="core-leaderboard__name">
                  <span aria-hidden="true">{player.icon}</span> {player.name}
                </span>
                <span className="core-leaderboard__tile">
                  {coreTileCoordinate(player.position)}
                  {player.startPosition !== player.position &&
                    ` · starts ${coreTileCoordinate(player.startPosition)}`}
                </span>
                <span className="core-leaderboard__score">{player.score}</span>
                {player.finished && <span className="badge">Core reached</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="game__toolbar">
        <button type="button" className="ghost" onClick={reset}>
          Rebuild the board
        </button>
      </div>
    </div>
  )
}
