import { useEffect } from 'react'
import { displayPath, listenForPublicDisplay } from '../services/publicDisplay'
import { refreshDatabaseFromStorage } from '../db/sequelize-provider'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDatabase } from '../hooks/useDatabase'
import { publicWindowKind, publicWindowName, registerPublicWindow, restoreAdminFocusAfterPublicLoad, listenForPublicWindowNavigation } from '../services/publicWindow'

export function PublicLayout() {
  const { status, error } = useDatabase()
  const navigate = useNavigate()
  const kind = publicWindowKind(useLocation().pathname)
  useEffect(() => restoreAdminFocusAfterPublicLoad(), [])
  useEffect(() => registerPublicWindow(kind), [kind])
  useEffect(() => listenForPublicWindowNavigation((path) => {
    if (publicWindowKind(path) === kind) navigate(path)
  }), [navigate, kind])
  useEffect(() => {
    window.name = publicWindowName(kind)
    let queue = Promise.resolve()
    return listenForPublicDisplay((display) => {
      if (publicWindowKind(displayPath(display)) !== kind) return
      queue = queue.then(async () => {
        await refreshDatabaseFromStorage()
        navigate(displayPath(display))
      }).catch(console.error)
    })
  }, [navigate, kind])

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
