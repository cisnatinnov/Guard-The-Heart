import { Link, useLocation, Outlet } from 'react-router-dom'
import { useDatabase } from '../hooks/useDatabase'

const ADMIN_NAV = [
  { path: '/admin', label: 'Teams' },
  { path: '/admin/challenges', label: 'Challenges' },
  { path: '/admin/scoreboard', label: 'Scoreboard' },
  { path: '/admin/leaderboard', label: 'Leaderboard' },
  { path: '/admin/cards', label: 'Card Reveal' },
] as const

export function AdminLayout() {
  const { status, error } = useDatabase()
  const location = useLocation()

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
              to={item.path}
              className={location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path))
                ? 'tab tab--active'
                : 'tab'}
              aria-current={location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path)) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
          <Link to="/" className="tab tab--public-link" title="Switch to Public">
            Public
          </Link>
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