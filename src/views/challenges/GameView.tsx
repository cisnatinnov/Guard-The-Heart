import { openPublicDisplay } from '../../services/publicWindow'
import { refreshDatabaseFromStorage } from '../../db/sequelize-provider'
import { useEffect, useState } from 'react'
import { ChallengeRunController } from '../../controllers/ChallengeRunController'
import { displayPath, publishPublicDisplay } from '../../services/publicDisplay'
import { useParams, useNavigate } from 'react-router-dom'
import { CHALLENGE_GAMES, type ChallengeGameId } from '../../services/games'
import { useChallenges } from '../../hooks/useChallenges'
import type { ChallengeRun } from '../../services/games/teamRun'
import { publishSharedChallengeRun, useSharedChallengeRun } from '../../services/games/runSync'
import { TeamRunPanel } from './TeamRunPanel'
import { EmojiDecodeView } from './EmojiDecodeView'
import { WordAssemblyView } from './WordAssemblyView'
import { JawsOfRiskView } from './JawsOfRiskView'
import { PublicQuestionView } from './PublicQuestionView'
import { MatchingOnlyView } from './MatchingOnlyView'

function GameScreen({ id, onComplete }: { id: ChallengeGameId; onComplete: () => void }) {
  if (id === 'emoji-decode') return <EmojiDecodeView onComplete={onComplete} />
  if (id === 'word-assembly') return <WordAssemblyView onComplete={onComplete} />
  return null
}

/**
 * The playing screen for one built-in challenge. It is deliberately not a tab:
 * opened from a built-in challenge row. Completed runs open the scoreboard.
 *
 * A team run scores each team's answers straight onto the challenge scoreboard,
 * so while one is running the solo screen is hidden to avoid two scoring paths
 * on screen at once.
 */
export function GameView() {
  const params = useParams<{ gameId?: string; challengeId?: string }>()
  const navigate = useNavigate()
  const [completionError, setCompletionError] = useState<string | null>(null)
  const { challenges } = useChallenges()
  
  const gameId = params.gameId as ChallengeGameId | undefined
  const game = CHALLENGE_GAMES.find((entry) => entry.id === gameId)
  const matchingChallenge = challenges.find((challenge) => challenge.name === game?.title)
  const challengeId = params.challengeId ?? matchingChallenge?.id ?? game?.challengeId ?? ''

  const isAdmin = window.location.pathname.startsWith('/admin')
  const backPath = isAdmin ? '/admin/challenges' : '/challenges'
  const run = useSharedChallengeRun(game?.id ?? 'emoji-decode', challengeId)
  useEffect(() => {
    let cancelled = false
    if (!isAdmin && game?.id !== 'jaws-of-risk' && run && !run.matchingOnly && ChallengeRunController.complete(run)) {
      void refreshDatabaseFromStorage().then(() => {
        if (!cancelled) navigate(`/scoreboard/${encodeURIComponent(challengeId)}`, { replace: true })
      }).catch(console.error)
    }
    return () => { cancelled = true }
  }, [isAdmin, run, challengeId, navigate, game?.id])
  if (!game || !gameId) return null

  if (game.id === 'jaws-of-risk') return <JawsOfRiskView key={challengeId} challengeId={challengeId} />

  if (!isAdmin) return game.id === 'word-assembly'
    ? <MatchingOnlyView challengeId={challengeId} sharedRun={run} canControl={false} />
    : <PublicQuestionView key={`${game.id}:${challengeId}`} gameId={game.id} run={run} />

  const publishRun = async (nextRun: ChallengeRun) => {
    if (!isAdmin) return
    if (!nextRun.matchingOnly && ChallengeRunController.complete(nextRun)) {
      await ChallengeRunController.syncAll(nextRun)
      await publishPublicDisplay('scoreboard', challengeId)
      publishSharedChallengeRun(game.id, challengeId, nextRun)
      navigate(displayPath({ stage: 'scoreboard', challengeId }, true))
    } else publishSharedChallengeRun(game.id, challengeId, nextRun)
  }

  const startSharedRun = (nextRun: ChallengeRun) => {
    if (!isAdmin) return
    publishSharedChallengeRun(game.id, challengeId, nextRun)
    const publicPath = `/play/${game.id}/${challengeId}`
    // Omit popup sizing features so the browser opens a regular tab.
    openPublicDisplay(publicPath, true)
  }

  const completeSolo = () => {
    void publishPublicDisplay('scoreboard', challengeId).then(() => {
      navigate(displayPath({ stage: 'scoreboard', challengeId }, true))
    }).catch((cause: unknown) => setCompletionError(cause instanceof Error ? cause.message : String(cause)))
  }

  const endSharedRun = () => {
    if (isAdmin) publishSharedChallengeRun(game.id, challengeId, null)
  }

  if (game.id === 'word-assembly') return <MatchingOnlyView challengeId={challengeId} sharedRun={run}
    canControl onStart={startSharedRun} onUpdate={publishRun} onEnd={endSharedRun} />

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

          </div>

          {completionError && <p className="alert alert--error">{completionError}</p>}
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
                <GameScreen id={gameId} onComplete={completeSolo} />
              </div>
            </details>
          )}
        </main>
      </div>
    </section>
  )
}
