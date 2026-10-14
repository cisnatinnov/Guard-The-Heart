import { Link, useLocation, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useDatabase } from '../hooks/useDatabase'
import { PUBLIC_WINDOW_NAME, TIMER_WINDOW_NAME, publicFeatureForAdmin } from '../services/publicWindow'
import { displayPath, publishPublicDisplay } from '../services/publicDisplay'

const ADMIN_NAV = [
  { path: '/admin', label: 'Teams' },
  { path: '/admin/challenges', label: 'Challenges' },
  { path: '/admin/turn-order', label: 'Urutan Main' },
  { path: '/admin/scoreboard', label: 'Scoreboard' },
  { path: '/admin/leaderboard', label: 'Leaderboard' },
  { path: '/admin/podium', label: 'Podium' },
  { path: '/admin/gp-transactions', label: 'Transaksi GP' },
  { path: '/admin/rewards', label: 'Rewards' },
  { path: '/admin/tactical', label: 'Tactical Phase' },
  { path: '/admin/gigarisk', label: 'Serangan GigaRisk' },
  { path: '/admin/timer', label: 'Timer' },
] as const

export function AdminLayout() {
  const { status, error } = useDatabase()
  const location = useLocation()
  useEffect(() => {
    if (window.name === PUBLIC_WINDOW_NAME || window.name === TIMER_WINDOW_NAME) window.name = ''
  }, [])

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

  return (
    <div className="app app--admin">
      <header className="app__header">
        <div className="app__header-top">
          <div className="app__brand">
            <Link to="/admin" className="app__logo-link">
              <img className="app__logo" src="/Logo_Game-5.png" alt="Guard The Heart logo" />
              <div>
                <h1>Guard The Heart</h1>
                <p className="app__tagline">Challenge and Scoreboard Tracker</p>
              </div>
            </Link>
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
        <nav className="tabs tabs--admin" aria-label="Admin views">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.path}
              to={publicFeatureForAdmin(item.path, location.pathname)
                ? displayPath(publicFeatureForAdmin(item.path, location.pathname)!, true)
                : item.path}
              onClick={() => {
                const display = publicFeatureForAdmin(item.path, location.pathname)
                if (display) void publishPublicDisplay(display.stage, display.challengeId).catch(console.error)
              }}
              className={location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path))
                ? 'tab tab--active'
                : 'tab'}
              aria-current={location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path)) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}

        </nav>
      </header>

      <main className="app__main">
        <Outlet />
      </main>

      <footer className="app__footer">
        <span>Copyright &copy; 2026 <a href="https://vedapraxis.com/en">Veda Praxis</a>. All rights reserved.</span>
      </footer>
    </div>
  )
}
