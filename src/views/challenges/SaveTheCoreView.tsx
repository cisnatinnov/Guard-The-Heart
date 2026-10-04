import { useState } from 'react'
import {
  CORE_DIE_SIDES,
  CORE_FINISH_BONUS,
  CORE_TRACK_LENGTH,
  createCoreGame,
  coreLeaderboard,
  playCoreTurn,
  playersOnTile,
  revealedBombCount,
  type CoreGameState,
  type CoreOutcome,
} from '../../services/games'

export function SaveTheCoreView() {
  const [state, setState] = useState<CoreGameState>(() => createCoreGame())
  const [lastOutcome, setLastOutcome] = useState<CoreOutcome | null>(null)
  const [lastMessage, setLastMessage] = useState<string | null>(null)

  const active = state.players[state.turnIndex]
  const leaderboard = coreLeaderboard(state)

  function roll() {
    const result = playCoreTurn(state)
    setState(result.state)
    setLastOutcome(result.outcome)
    setLastMessage(result.state.log.at(-1)?.text ?? null)
  }

  function reset() {
    setState(createCoreGame())
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
      </div>

      <div className="core-turn">
        <span className="core-turn__active">
          <span aria-hidden="true">{active?.icon}</span> {active?.name} to roll
        </span>
        <button type="button" onClick={roll} disabled={state.over}>
          Roll the d{CORE_DIE_SIDES}
        </button>
      </div>

      {lastMessage && (
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

      <ol className="core-track" aria-label="Track to the Core">
        {state.tiles.map((tile) => {
          const occupants = playersOnTile(state, tile.index)
          const className = [
            'core-tile',
            `core-tile--${tile.kind}`,
            tile.revealed ? 'core-tile--revealed' : '',
            occupants.some((player) => player.id === active?.id) ? 'core-tile--active' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <li key={tile.index} className={className}>
              <span className="core-tile__number">{tile.index + 1}</span>
              <span className="core-tile__mark" aria-hidden="true">
                {tile.kind === 'bomb' ? (tile.revealed ? '💥' : '❓') : tile.kind === 'core' ? '💎' : tile.kind === 'start' ? '🏁' : tile.revealed ? `+${tile.score}` : '·'}
              </span>
              <span className="core-tile__pieces">
                {occupants.map((player) => (
                  <span key={player.id} className="core-piece" style={{ background: player.color }} title={player.name}>
                    {player.icon}
                  </span>
                ))}
              </span>
            </li>
          )
        })}
      </ol>

      <ul className="core-leaderboard">
        {leaderboard.map((player, index) => (
          <li key={player.id} className={player.id === active?.id ? 'core-leaderboard__row core-leaderboard__row--active' : 'core-leaderboard__row'}>
            <span className="core-leaderboard__rank">{index + 1}</span>
            <span className="core-leaderboard__name">
              <span aria-hidden="true">{player.icon}</span> {player.name}
            </span>
            <span className="core-leaderboard__tile">Tile {player.position + 1}</span>
            <span className="core-leaderboard__score">{player.score}</span>
            {player.finished && <span className="badge">Core reached</span>}
          </li>
        ))}
      </ul>

      <div className="game__toolbar">
        <button type="button" className="ghost" onClick={reset}>
          Rebuild the track
        </button>
      </div>
    </div>
  )
}