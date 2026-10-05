import { useState } from 'react'
import { useDatabase } from '../hooks/useDatabase'
import type { ChallengeGameId } from '../services/games'
import { TeamView } from './TeamView'
import { ChallengeView } from './ChallengeView'
import { ChallengeScoreboardView } from './ChallengeScoreboardView'
import { ScoreboardTotalView } from './ScoreboardTotalView'
import { HeartOfAwarenessView } from './HeartOfAwarenessView'
import { CardDrawView } from './CardDrawView'
import { TeamCardView } from './TeamCardView'
import { GameView } from './challenges/GameView'

type Tab =
  | 'teams'
  | 'challenges'
  | 'scoreboard'
  | 'total'
  | 'heart'
  | 'cards'
  | 'team-cards'
  // Reached from a built-in challenge row, never listed as a tab.
  | 'game'

const TABS: { id: Tab; label: string }[] = [
  { id: 'teams', label: 'Team' },
  { id: 'challenges', label: 'Challenge' },
  { id: 'scoreboard', label: 'Scoreboard per challenge' },
  { id: 'total', label: 'Scoreboard total' },
  { id: 'heart', label: 'Heart of awareness' },
  { id: 'cards', label: 'Card Draw' },
]

export function App() {
  const { status, error } = useDatabase()
  const [tab, setTab] = useState<Tab>('teams')
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedGameId, setSelectedGameId] = useState<ChallengeGameId | null>(null)

  function openScoreboard(challengeId: string) {
    setSelectedChallengeId(challengeId)
    setTab('scoreboard')
  }

  function openTeamCards(teamId: string) {
    setSelectedTeamId(teamId)
    setTab('team-cards')
  }

  function playGame(gameId: ChallengeGameId) {
    setSelectedGameId(gameId)
    setTab('game')
  }

  function closeTeamCards() {
    setSelectedTeamId(null)
    setTab('teams')
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-top">
          <div className="app__brand">
            <img className="app__logo" src="/Logo_Game-5.png" alt="Guard The Heart logo" />
            <div>
              <h1>Guard The Heart</h1>
              <p className="app__tagline">Offline-first challenge, game and scoreboard tracker</p>
            </div>
          </div>
          <div className="app__characters" role="group" aria-label="Meet the guardians">
            <figure className="app__character">
              <img src="/gardian-male.png" alt="Male guardian in teal and orange gear" />
              <figcaption>Guardimon Male</figcaption>
            </figure>
            <figure className="app__character app__character--mascot">
              <img src="/gardimon.png" alt="Gardimon, the orange guardian mascot" />
              <figcaption>Guardimon</figcaption>
            </figure>
            <figure className="app__character">
              <img src="/gardian-female.png" alt="Female guardian in teal and orange gear" />
              <figcaption>Guardimon Female</figcaption>
            </figure>
          </div>
          <figure className="app__risk-card">
            <img src="/gigarisk-portrait.jpg" alt="Giga Risk, a black dragon with purple flames" />
            <figcaption>Giga Risk</figcaption>
          </figure>
        </div>
        <nav className="tabs" aria-label="Views">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'tab tab--active' : 'tab'}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app__main">
        {status === 'loading' && (
          <div className="placeholder">
            <p>Starting local SQLite database…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="placeholder">
            <p className="alert alert--error">Failed to start the database: {error}</p>
          </div>
        )}

        {status === 'ready' && (
          <>
            {tab === 'teams' && <TeamView onOpenTeamCards={openTeamCards} />}
            {tab === 'challenges' && (
              <ChallengeView onOpenScoreboard={openScoreboard} onPlayGame={playGame} />
            )}
            {tab === 'scoreboard' && (
              <ChallengeScoreboardView
                selectedChallengeId={selectedChallengeId}
                onSelectChallenge={setSelectedChallengeId}
              />
            )}
            {tab === 'total' && <ScoreboardTotalView />}
            {tab === 'heart' && <HeartOfAwarenessView />}
            {tab === 'cards' && <CardDrawView />}
            {tab === 'team-cards' && selectedTeamId && (
              <TeamCardView
                teamId={selectedTeamId}
                teamName="Team Cards"
                onClose={closeTeamCards}
              />
            )}
            {tab === 'game' && (
              <GameView gameId={selectedGameId} onBackToChallenges={() => setTab('challenges')} />
            )}
          </>
        )}
      </main>

      <footer className="app__footer">
        <span>Data stored locally in SQLite (WASM) and persisted offline.</span>
      </footer>
    </div>
  )
}