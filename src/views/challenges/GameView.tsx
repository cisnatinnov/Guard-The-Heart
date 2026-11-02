import { refreshDatabaseFromStorage } from '../../db/sequelize-provider'
import { useEffect, useState } from 'react'
import { useChallengeAnswers } from '../../hooks/useChallengeAnswers'
import { ChallengeAnswerControls } from './ChallengeAnswerControls'
import { ChallengeRunController } from '../../controllers/ChallengeRunController'
import { displayPath, publishPublicDisplay } from '../../services/publicDisplay'
import { useParams, useNavigate } from 'react-router-dom'
import { CHALLENGE_GAMES, type ChallengeGameId } from '../../services/games'
import { useChallenges } from '../../hooks/useChallenges'
import type { ChallengeRun } from '../../services/games/teamRun'
import { publishSharedChallengeRun, useSharedChallengeRun } from '../../services/games/runSync'
import { TeamRunPanel } from './TeamRunPanel'
import { publishEventTimer, readEventTimer } from '../../services/eventTimer'
import { teamForQuestion } from '../../services/games/teamRun'
import { JawsOfRiskView } from './JawsOfRiskView'
import { PublicQuestionView } from './PublicQuestionView'
import { MatchingOnlyView } from './MatchingOnlyView'

/**
 * The playing screen for one built-in challenge. It is deliberately not a tab:
 * opened from a built-in challenge row. Completed runs open the scoreboard.
 *
 * A team run scores each team's submitted answers onto the challenge scoreboard.
 */
function PublicQuiz({ challengeId, jaw }: { challengeId: string; jaw: boolean }) {
  const state = useChallengeAnswers(challengeId)
  return <ChallengeAnswerControls challengeId={challengeId} jaw={jaw} canControl={false} state={state} />
}

function PublicChallengeButton({ gameId, challengeId }: { gameId: ChallengeGameId; challengeId: string }) {
  const [error, setError] = useState<string | null>(null)
  return <div className="board-reveal-control"><button type="button" onClick={() => {
    void publishPublicDisplay(gameId === 'emoji-decode' ? 'image-decode' : gameId === 'word-assembly' ? 'flipping-connect' : 'jaws-of-risk', challengeId)
      .then(() => setError(null)).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
  }}>Show public question</button>{error && <p role="alert" className="alert alert--error">{error}</p>}</div>
}

export function GameView({ board }: { board?: 'cards' | 'dragon' }) {
  const params = useParams<{ gameId?: string; challengeId?: string }>()
  const navigate = useNavigate()
  const { challenges } = useChallenges()
  
  const gameId = (board === 'cards' ? 'word-assembly' : board === 'dragon' ? 'jaws-of-risk' : params.gameId) as ChallengeGameId | undefined
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

  if (!isAdmin && !board && (game.id === 'jaws-of-risk' || game.id === 'word-assembly')) {
    return <PublicQuiz challengeId={challengeId} jaw={game.id === 'jaws-of-risk'} />
  }

  if (game.id === 'jaws-of-risk') return <>{isAdmin && <PublicChallengeButton gameId={game.id} challengeId={challengeId} />}<JawsOfRiskView key={challengeId} challengeId={challengeId} /></>

  if (!isAdmin) return game.id === 'word-assembly'
    ? <MatchingOnlyView challengeId={challengeId} sharedRun={run} canControl={false} />
    : <PublicQuestionView key={`${game.id}:${challengeId}`} gameId={game.id} run={run} />

  const publishRun = async (nextRun: ChallengeRun) => {
    if (!isAdmin) return
    const active = teamForQuestion(nextRun)?.team
    if (active) publishEventTimer({ ...readEventTimer(), activeTeamId: active })
    if (!nextRun.matchingOnly && ChallengeRunController.complete(nextRun)) {
      await ChallengeRunController.syncAll(nextRun)
      await publishPublicDisplay('scoreboard', challengeId)
      publishSharedChallengeRun(game.id, challengeId, nextRun)
      navigate(displayPath({ stage: 'scoreboard', challengeId }, true))
    } else publishSharedChallengeRun(game.id, challengeId, nextRun)
  }

  const startSharedRun = (nextRun: ChallengeRun) => {
    if (isAdmin) publishSharedChallengeRun(game.id, challengeId, nextRun)
  }

  const endSharedRun = () => {
    if (isAdmin) publishSharedChallengeRun(game.id, challengeId, null)
  }

  if (game.id === 'word-assembly') return <><PublicChallengeButton gameId={game.id} challengeId={challengeId} /><MatchingOnlyView challengeId={challengeId} sharedRun={run}
    canControl onStart={startSharedRun} onUpdate={publishRun} onEnd={endSharedRun} /></>

  return (
    <section className={`view view--game view--game-${game.id} ${isAdmin ? 'game-stage--admin' : 'game-stage--public'}`}>
      <div className="game-stage__chrome">
        <header className="game-stage__header">
          <img className="game-stage__logo" src="/fight-the-dragon-logo.png" alt="Fight the Dragon" />
          <div className="game-stage__challenge-name">{game.title}</div>
          <div className="game-stage__counter">Challenge</div>
        </header>

        <main className="game-stage__content">
          <header className="view__header game-stage__intro">
            <h2>{game.title}</h2>
            <p className="view__hint">{game.tagline}</p>
          </header>

          <div className="game__toolbar">
            <PublicChallengeButton gameId={game.id} challengeId={challengeId} />
            <button type="button" className="ghost" onClick={() => navigate(backPath)}>
              ← All challenges
            </button>
            {game.deckPath && (
              <a className="deck-link" href={game.deckPath} download aria-label={game.deckLabel}>
                ⬇ {game.deckLabel}
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


        </main>
      </div>
    </section>
  )
}
