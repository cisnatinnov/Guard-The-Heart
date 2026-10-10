import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useDatabase } from '../hooks/useDatabase'

import { TeamView } from './TeamView'
import { ChallengeView } from './ChallengeView'
import { ChallengePointPublicView } from './ChallengePointPublicView'
import { ChallengePointAdminView } from './ChallengePointAdminView'
import { ScoreboardTotalPublicView } from './ScoreboardTotalPublicView'
import { ScoreboardTotalAdminView } from './ScoreboardTotalAdminView'
import { CardRevealPublicView } from './CardRevealPublicView'
import { CardRevealAdminView } from './CardRevealAdminView'
import { GameView } from './challenges/GameView'
import { PublicLayout } from './PublicLayout'
import { AdminLayout } from './AdminLayout'

function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const { status, error } = useDatabase()

  if (status === 'loading') {
    return (
      <div className="app">
        <div className="placeholder">
          <p>Starting local SQLite database…</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="app">
        <div className="placeholder">
          <p className="alert alert--error">Failed to start the database: {error}</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function App() {
  return (
    <BrowserRouter>
      <DatabaseProvider>
        <Routes>
          {/* Public routes */}
          <Route element={<PublicLayout />}>
            <Route path="/scoreboard/:challengeId?" element={<ChallengePointPublicView />} />
            <Route path="/leaderboard" element={<ScoreboardTotalPublicView />} />
            <Route path="/cards" element={<CardRevealPublicView />} />
            <Route path="/play/:gameId/:challengeId?" element={<GameView />} />
          </Route>

          {/* Admin routes */}
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<TeamView />} />
            <Route path="/admin/challenges" element={<ChallengeView />} />
            <Route path="/admin/scoreboard/:challengeId?" element={<ChallengePointAdminView />} />
            <Route path="/admin/leaderboard" element={<ScoreboardTotalAdminView />} />
            <Route path="/admin/cards" element={<CardRevealAdminView />} />
            <Route path="/admin/play/:gameId/:challengeId?" element={<GameView />} />
          </Route>

          {/* Redirect unknown routes to public scoreboard */}
          <Route path="*" element={<Navigate to="/scoreboard" replace />} />
        </Routes>
      </DatabaseProvider>
    </BrowserRouter>
  )
}
