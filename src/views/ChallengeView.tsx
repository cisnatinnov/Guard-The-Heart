import { useChallenges } from '../hooks/useChallenges'
import {
  CHALLENGE_GAMES,
  isChallengeWorkInProgress,
  type ChallengeGameId,
} from '../services/games'
import { gameIdForChallengeName } from '../services/challengeSeeds'

interface ChallengeViewProps {
  onOpenScoreboard: (challengeId: string) => void
  onPlayGame: (gameId: ChallengeGameId) => void
}

export function ChallengeView({ onOpenScoreboard, onPlayGame }: ChallengeViewProps) {
  const { challenges, loading, error } = useChallenges()

  return (
    <section className="view">
      <header className="view__header">
        <h2>Challenges</h2>
        <p className="view__hint">
          These are the challenges of the game. They cannot be added, renamed or deleted. Play one
          here, then record each team's score on its scoreboard.
        </p>
      </header>

      {error && <p className="alert alert--error">{error}</p>}

      {loading && <p className="muted">Loading challenges…</p>}

      {!loading && challenges.length === 0 && (
        <p className="muted">No challenges available.</p>
      )}

      {challenges.length > 0 && (
        <ul className="card-list">
          {challenges.map((challenge) => {
            const gameId = gameIdForChallengeName(challenge.name)
            const game = CHALLENGE_GAMES.find((entry) => entry.id === gameId)
            const workInProgress = gameId !== null && isChallengeWorkInProgress(gameId)
            return (
              <li
                key={challenge.id}
                data-challenge-id={challenge.id}
                className={gameId ? 'card card--locked' : 'card'}
              >
                <div className="card__body">
                  <span className="card__title">{challenge.name}</span>
                  {gameId && <span className="badge">Built-in</span>}
                  <div className="card__actions">
                    <button type="button" onClick={() => onOpenScoreboard(challenge.id)}>
                      Scoreboard
                    </button>
                    {gameId && (
                      <>
                        <button type="button" onClick={() => onPlayGame(gameId)}>
                          {workInProgress ? 'Work in progress' : 'Play'}
                        </button>
                        {!workInProgress && game?.deckPath && (
                          <a
                            className="deck-link"
                            href={game.deckPath}
                            download
                            aria-label={game.deckLabel}
                          >
                            ⬇ Deck
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {game && (
                  <p className="card__note">
                    {workInProgress ? 'Challenge content is temporarily unavailable.' : game.tagline}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}