import { useState } from 'react'
import { CHALLENGE_GAMES, type ChallengeGameId } from '../../services/games'
import type { ChallengeRun } from '../../services/games/teamRun'
import { TeamRunPanel } from './TeamRunPanel'
import { EmojiDecodeView } from './EmojiDecodeView'
import { GardimonProtocolView } from './GardimonProtocolView'
import { WordAssemblyView } from './WordAssemblyView'
import { IncidentTrailView } from './IncidentTrailView'
import { JawsOfRiskView } from './JawsOfRiskView'
import { SaveTheCoreView } from './SaveTheCoreView'

function GameScreen({ id }: { id: ChallengeGameId }) {
  if (id === 'emoji-decode') return <EmojiDecodeView />
  if (id === 'gardimon-protocol') return <GardimonProtocolView />
  if (id === 'word-assembly') return <WordAssemblyView />
  if (id === 'incident-trail') return <IncidentTrailView />
  if (id === 'jaws-of-risk') return <JawsOfRiskView />
  return <SaveTheCoreView />
}

export interface GameViewProps {
  gameId: ChallengeGameId | null
  onBackToChallenges: () => void
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
export function GameView({ gameId, onBackToChallenges }: GameViewProps) {
  const [run, setRun] = useState<ChallengeRun | null>(null)
  if (!gameId) return null
  const game = CHALLENGE_GAMES.find((entry) => entry.id === gameId)
  if (!game) return null

  return (
    <section className="view">
      <header className="view__header">
        <h2>{game.title}</h2>
        <p className="view__hint">{game.tagline}</p>
      </header>

      <div className="game__toolbar">
        <button type="button" className="ghost" onClick={onBackToChallenges}>
          ← All challenges
        </button>
        {game.deckPath && (
          <a className="deck-link" href={game.deckPath} download aria-label={game.deckLabel}>
            ⬇ {game.deckLabel}
          </a>
        )}
      </div>

      <TeamRunPanel
        key={game.id}
        gameId={game.id}
        challengeId={game.challengeId}
        running={run !== null}
        onStartRun={setRun}
        onUpdateRun={setRun}
        onEndRun={() => setRun(null)}
      />

      <ol className="rule-list">
        {game.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>

      {!run && <GameScreen id={gameId} />}
    </section>
  )
}