import { saveTheme } from '../services/theme'
import { useTheme } from '../hooks/useTheme'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useDatabase } from '../hooks/useDatabase'
import { PUBLIC_WINDOW_NAME, TIMER_WINDOW_NAME, TURN_ORDER_WINDOW_NAME, publicFeatureForAdmin } from '../services/publicWindow'
import { displayPath, publishPublicDisplay } from '../services/publicDisplay'
import { GAME_CHARACTERS } from '../data/characters'

const ADMIN_NAV = [
  { path: '/admin', label: 'Teams' },
  { path: '/admin/challenges', label: 'Challenges' },
  { path: '/admin/turn-order', label: 'Turn Order' },
  { path: '/admin/scoreboard', label: 'Scoreboard' },
  { path: '/admin/leaderboard', label: 'Leaderboard' },
  { path: '/admin/heart-of-awareness', label: 'Heart of Awareness' },
  { path: '/admin/podium', label: 'Podium' },
  { path: '/admin/gp-transactions', label: 'GP Transactions' },
  { path: '/admin/rewards', label: 'Rewards' },
  { path: '/admin/tactical', label: 'Tactical Phase' },
  { path: '/admin/gigarisk', label: 'Gilgamesh Attack' },
] as const

const ADMIN_GROUPS = [
  { label: 'Event setup', paths: ['/admin', '/admin/challenges', '/admin/turn-order'] },
  { label: 'Results', paths: [ '/admin/scoreboard', '/admin/leaderboard', '/admin/heart-of-awareness', '/admin/podium'] },
  { label: 'Game management', paths: ['/admin/tactical', '/admin/gigarisk', '/admin/rewards', '/admin/gp-transactions'] },
]

export function AdminLayout() {
  const { status, error } = useDatabase()
  const location = useLocation()
  const theme = useTheme()
  useEffect(() => {
    if ([PUBLIC_WINDOW_NAME, TIMER_WINDOW_NAME, TURN_ORDER_WINDOW_NAME].includes(window.name)) window.name = ''
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
              <img className="app__logo" src="/fight-the-dragon-logo.png" alt="Fight the Dragon logo" />
              <div>
                <h1>Fight the Dragon</h1>
                <p className="app__tagline">Challenge and Scoreboard Tracker</p>
              </div>
            </Link>
          </div>
          <div className="app__characters" role="group" aria-label="Meet the Fight the Dragon heroes">
            {GAME_CHARACTERS.map((character) => <figure key={character.id} className={`app__character${character.id === 'spark' ? ' app__character--mascot' : ''}`}>
              <img src={character.image} alt={character.description} />
              <figcaption>{character.name}</figcaption>
            </figure>)}
          </div>
          <button className="ghost theme-switch" aria-label="Dark theme" aria-pressed={theme === 'dark'} onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark'
            saveTheme(next)
          }}>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
          <figure className="app__risk-card">
            <img src="/characters/gilgamesh.png" alt="Gilgamesh, a silver and cobalt dragon with crystal horns" />
            <figcaption>Gilgamesh</figcaption>
          </figure>
        </div>
      </header>
        <nav className="tabs tabs--admin" aria-label="Admin views">
          {ADMIN_GROUPS.map((group) => <div className="admin-nav-group" key={group.label}>
          <p className="admin-nav-group__title">{group.label}</p>
          {ADMIN_NAV.filter((item) => group.paths.includes(item.path)).map((item) => (
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
          </div>)}
        </nav>

      <main className="app__main">
        <Outlet />
      </main>

      <footer className="app__footer">
        <span>Copyright &copy; 2026 <a href="https://www.linkedin.com/in/cendikia-hairy/">Cendikia Hairy</a>. All rights reserved.</span>
        <Link to="/portfolio">Portfolio ↗</Link>
      </footer>
    </div>
  )
}
