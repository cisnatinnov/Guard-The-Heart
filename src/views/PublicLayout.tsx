import { useEffect } from 'react'
import { displayPath, listenForPublicDisplay } from '../services/publicDisplay'
import { refreshDatabaseFromStorage } from '../db/sequelize-provider'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDatabase } from '../hooks/useDatabase'
import { PUBLIC_WINDOW_NAME, TIMER_WINDOW_NAME, registerPublicWindow, restoreAdminFocusAfterPublicLoad, listenForPublicWindowNavigation } from '../services/publicWindow'

export function PublicLayout() {
  const { status, error } = useDatabase()
  const navigate = useNavigate()
  const timer = useLocation().pathname === '/timer'
  useEffect(() => restoreAdminFocusAfterPublicLoad(), [])
  useEffect(() => registerPublicWindow(timer), [timer])
  useEffect(() => listenForPublicWindowNavigation((path) => {
    if ((path === '/timer') === timer) navigate(path)
  }), [navigate, timer])
  useEffect(() => {
    window.name = timer ? TIMER_WINDOW_NAME : PUBLIC_WINDOW_NAME
    let queue = Promise.resolve()
    return listenForPublicDisplay((display) => {
      if ((display.stage === 'timer') !== timer) return
      queue = queue.then(async () => {
        await refreshDatabaseFromStorage()
        navigate(displayPath(display))
      }).catch(console.error)
    })
  }, [navigate, timer])

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
    <div className="app app--public">
      <main className="app__main">
        <Outlet />
      </main>
    </div>
  )
}
