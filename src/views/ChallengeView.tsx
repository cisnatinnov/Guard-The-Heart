import { englishText } from '../services/english'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useChallenges } from '../hooks/useChallenges'
import { CHALLENGE_GAMES } from '../services/games'
import { gameIdForChallengeName } from '../services/challengeSeeds'
import { publishPublicDisplay } from '../services/publicDisplay'

export function ChallengeView() {
  const { challenges, loading, error } = useChallenges()
  const navigate = useNavigate()
  const [playError, setPlayError] = useState<string | null>(null)
  const isAdmin = window.location.pathname.startsWith('/admin')

  const scoreboardBase = isAdmin ? '/admin/scoreboard' : '/scoreboard'
  const playBase = isAdmin ? '/admin/play' : '/play'

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
      {playError && <p className="alert alert--error" role="alert">{playError}</p>}

      {loading && <p className="muted">Loading challenges…</p>}

      {!loading && challenges.length === 0 && (
        <p className="muted">No challenges available.</p>
      )}

      {challenges.length > 0 && (
        <ul className="card-list">
          {challenges.map((challenge) => {
            const gameId = gameIdForChallengeName(challenge.name)
            const game = CHALLENGE_GAMES.find((entry) => entry.id === gameId)
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
                    <button type="button" onClick={() => navigate(`${scoreboardBase}/${challenge.id}`)}>
                      Scoreboard
                    </button>
                    {gameId && (
                      <>
                        <button type="button" onClick={async () => {
                          setPlayError(null)
                          try {
                            if (isAdmin && (gameId === 'word-assembly' || gameId === 'jaws-of-risk')) {
                              await publishPublicDisplay(gameId === 'word-assembly' ? 'flipping-connect' : 'jaws-of-risk', challenge.id)
                            }
                            navigate(`${playBase}/${gameId}/${challenge.id}`)
                          } catch (cause) { setPlayError(englishText(cause instanceof Error ? cause.message : String(cause))) }
                        }}>
                          Play
                        </button>
                        {game?.deckPath && (
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
                {game && <p className="card__note">{game.tagline}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
