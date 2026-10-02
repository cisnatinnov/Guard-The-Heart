import { useState } from 'react'
import { useDatabase } from '../hooks/useDatabase'
import { TeamView } from './TeamView'
import { ChallengeView } from './ChallengeView'
import { ChallengeScoreboardView } from './ChallengeScoreboardView'
import { ScoreboardTotalView } from './ScoreboardTotalView'
import { HeartOfAwarenessView } from './HeartOfAwarenessView'
import { CardDrawView } from './CardDrawView'
import { TeamCardView } from './TeamCardView'

type Tab = 'teams' | 'challenges' | 'scoreboard' | 'total' | 'heart' | 'cards' | 'team-cards'

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

  function openScoreboard(challengeId: string) {
    setSelectedChallengeId(challengeId)
    setTab('scoreboard')
  }

  function openTeamCards(teamId: string) {
    setSelectedTeamId(teamId)
    setTab('team-cards')
  }

  function closeTeamCards() {
    setSelectedTeamId(null)
    setTab('teams')
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            ♥
          </span>
          <div>
            <h1>Guard The Heart</h1>
            <p className="app__tagline">Offline-first challenge & scoreboard tracker</p>
          </div>
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
            {tab === 'challenges' && <ChallengeView onOpenScoreboard={openScoreboard} />}
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
          </>
        )}
      </main>

      <footer className="app__footer">
        <span>Data stored locally in SQLite (WASM) and persisted offline.</span>
      </footer>
    </div>
  )
}