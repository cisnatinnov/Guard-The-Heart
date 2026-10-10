import { useParams, useNavigate } from 'react-router-dom'
import { CHALLENGE_GAMES, type ChallengeGameId } from '../../services/games'
import { useChallenges } from '../../hooks/useChallenges'
import type { ChallengeRun } from '../../services/games/teamRun'
import { publishSharedChallengeRun, useSharedChallengeRun } from '../../services/games/runSync'
import { TeamRunPanel } from './TeamRunPanel'
import { EmojiDecodeView } from './EmojiDecodeView'
import { WordAssemblyView } from './WordAssemblyView'
import { JawsOfRiskView } from './JawsOfRiskView'

function GameScreen({ id }: { id: ChallengeGameId }) {
  if (id === 'emoji-decode') return <EmojiDecodeView />
  if (id === 'word-assembly') return <WordAssemblyView />
  return <JawsOfRiskView />
}

/**
 * The playing screen for one built-in challenge. It is deliberately not a tab:
 * the only way in is a built-in challenge row on the Challenge view, and the
 * back button is the only way out.
 *
 * A team run scores each team's answers straight onto the challenge scoreboard,
 * so while one is running the solo screen is hidden to avoid two scoring paths
 * on screen at once.
 */
export function GameView() {
  const params = useParams<{ gameId?: string; challengeId?: string }>()
  const navigate = useNavigate()
  const { challenges } = useChallenges()
  
  const gameId = params.gameId as ChallengeGameId | undefined
  if (!gameId) return null
  
  const game = CHALLENGE_GAMES.find((entry) => entry.id === gameId)
  if (!game) return null

  const matchingChallenge = challenges.find((challenge) => challenge.name === game.title)
  const challengeId = params.challengeId ?? matchingChallenge?.id ?? game.challengeId

  const isAdmin = window.location.pathname.startsWith('/admin')
  const backPath = isAdmin ? '/admin/challenges' : '/challenges'
  const run = useSharedChallengeRun(game.id, challengeId)

  const publishRun = (nextRun: ChallengeRun | null) => {
    if (isAdmin) publishSharedChallengeRun(game.id, challengeId, nextRun)
  }

  const startSharedRun = (nextRun: ChallengeRun) => {
    if (!isAdmin) return
    publishSharedChallengeRun(game.id, challengeId, nextRun)
    const publicPath = `/play/${game.id}/${challengeId}`
    window.open(publicPath, `guard-the-heart-public-${game.id}-${challengeId}`, 'popup=yes,width=1440,height=920')
  }

  const endSharedRun = () => {
    if (isAdmin) publishSharedChallengeRun(game.id, challengeId, null)
  }

  return (
    <section className={`view view--game view--game-${game.id} ${isAdmin ? 'game-stage--admin' : 'game-stage--public'}`}>
      <div className="game-stage__chrome">
        <header className="game-stage__header">
          <img className="game-stage__logo" src="/Logo_Game-5.png" alt="Guard the Heart" />
          <div className="game-stage__challenge-name">{game.title}</div>
          <div className="game-stage__counter">Challenge</div>
        </header>

        <main className="game-stage__content">
          <header className="view__header game-stage__intro">
            <h2>{game.title}</h2>
            <p className="view__hint">{game.tagline}</p>
          </header>

          <div className="game__toolbar">
            <button type="button" className="ghost" onClick={() => navigate(backPath)}>
              ← All challenges
            </button>
            {game.deckPath && (
              <a className="deck-link" href={game.deckPath} download aria-label={game.deckLabel}>
                ⬇ {game.deckLabel}
              </a>
            )}
            {game.id === 'jaws-of-risk' && (
              <a className="deck-link" href="/ui/Jaw-of-risk.pptx" download>
                ⬇ Jaws of Risk UI reference (PPTX)
              </a>
            )}
          </div>

          <TeamRunPanel
            key={`${game.id}:${challengeId}`}
            gameId={game.id}
            challengeId={challengeId}
            sharedRun={run}
            canControl={isAdmin}
            running={run !== null}
            showSolo={isAdmin}
            onStartRun={startSharedRun}
            onUpdateRun={publishRun}
            onEndRun={endSharedRun}
          />

          {game.rules.length > 0 && (
            <ol className="rule-list">
              {game.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          )}

          {isAdmin && !run && (
            <details className="game-stage__solo">
              <summary>Play solo instead</summary>
              <div className="game-stage__solo-content">
                <GameScreen id={gameId} />
              </div>
            </details>
          )}
        </main>
      </div>
    </section>
  )
}
