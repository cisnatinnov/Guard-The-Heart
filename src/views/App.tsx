import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useDatabase } from '../hooks/useDatabase'

import { TeamView } from './TeamView'
import { ChallengeView } from './ChallengeView'
import { ChallengePointPublicView } from './ChallengePointPublicView'
import { ChallengePointAdminView } from './ChallengePointAdminView'
import { ScoreboardTotalPublicView } from './ScoreboardTotalPublicView'
import { ScoreboardTotalAdminView } from './ScoreboardTotalAdminView'
import { RewardClaimPublicView } from './RewardClaimPublicView'
import { GameView } from './challenges/GameView'
import { PublicLayout } from './PublicLayout'
import { AdminLayout } from './AdminLayout'
import { PresentationPublicView } from './PresentationPublicView'
import { PresentationAdminView } from './PresentationAdminView'
import { TacticalPhaseView } from './TacticalPhaseView'
import { TurnOrderView, GigaRiskView } from './ReferenceFeatures'
import { PodiumView } from './PodiumView'
import { GPTransactionsView } from './GPTransactionsView'

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
            <Route path="/" element={<PresentationPublicView />} />
            <Route path="/scoreboard/:challengeId?" element={<ChallengePointPublicView />} />
            <Route path="/leaderboard" element={<ScoreboardTotalPublicView />} />
            <Route path="/podium" element={<PodiumView />} />
            <Route path="/turn-order" element={<TurnOrderView />} />
            <Route path="/gigarisk/:challengeId?" element={<GigaRiskView />} />
            <Route path="/rewards/:challengeId?" element={<RewardClaimPublicView />} />
            <Route path="/tactical/:challengeId?" element={<TacticalPhaseView />} />
            <Route path="/card-reveal/:challengeId?" element={<TacticalPhaseView reveal />} />
            <Route path="/play/:gameId/:challengeId?" element={<GameView />} />
          </Route>

          {/* Admin routes */}
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<TeamView />} />
            <Route path="/admin/presentation" element={<PresentationAdminView />} />
            <Route path="/admin/challenges" element={<ChallengeView />} />
            <Route path="/admin/scoreboard/:challengeId?" element={<ChallengePointAdminView />} />
            <Route path="/admin/leaderboard" element={<ScoreboardTotalAdminView />} />
            <Route path="/admin/podium" element={<PodiumView admin />} />
            <Route path="/admin/gp-transactions" element={<GPTransactionsView />} />
            <Route path="/admin/turn-order" element={<TurnOrderView admin />} />
            <Route path="/admin/gigarisk/:challengeId?" element={<GigaRiskView admin />} />
            <Route path="/admin/rewards/:challengeId?" element={<RewardClaimPublicView admin />} />
            <Route path="/admin/tactical/:challengeId?" element={<TacticalPhaseView admin />} />
            <Route path="/admin/play/:gameId/:challengeId?" element={<GameView />} />
          </Route>

          {/* Redirect unknown routes to public scoreboard */}
          <Route path="*" element={<Navigate to="/scoreboard" replace />} />
        </Routes>
      </DatabaseProvider>
    </BrowserRouter>
  )
}
