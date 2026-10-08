import { Link, useLocation, Outlet } from 'react-router-dom'
import { useDatabase } from '../hooks/useDatabase'

const PUBLIC_NAV = [
  { path: '/scoreboard', label: 'Scoreboard' },
  { path: '/leaderboard', label: 'Leaderboard' },
  { path: '/heart', label: 'Heart of Awareness' },
  { path: '/cards', label: 'Card Reveal' },
] as const

export function PublicLayout() {
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

  const isActive = (path: string) => {
    if (path === '/scoreboard') return location.pathname.startsWith('/scoreboard')
    return location.pathname === path
  }

  return (
    <div className="app app--public">
      <header className="app__header">
        <div className="app__header-top">
          <div className="app__brand">
            <Link to="/scoreboard" className="app__logo-link">
              <img className="app__logo" src="/Logo_Game-5.png" alt="Guard The Heart logo" />
              <div>
                <h1>Guard The Heart</h1>
                <p className="app__tagline">Scoreboard tracker</p>
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
        <nav className="tabs tabs--public" aria-label="Public views">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={isActive(item.path) ? 'tab tab--active' : 'tab'}
              aria-current={isActive(item.path) ? 'page' : undefined}
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
        <span>Copyright &copy; 2026 <a href="https://vedapraxis.com/en" target="_blank" rel="noopener noreferrer">Veda Praxis</a>. All rights reserved.</span>
      </footer>
    </div>
  )
}