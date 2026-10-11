import { useEffect } from 'react'
import { displayPath, listenForPublicDisplay } from '../services/publicDisplay'
import { refreshDatabaseFromStorage } from '../db/sequelize-provider'
import { Outlet, useNavigate } from 'react-router-dom'
import { useDatabase } from '../hooks/useDatabase'

export function PublicLayout() {
  const { status, error } = useDatabase()
  const navigate = useNavigate()
  useEffect(() => {
    let queue = Promise.resolve()
    return listenForPublicDisplay((display) => {
      queue = queue.then(async () => {
        await refreshDatabaseFromStorage()
        navigate(displayPath(display))
      }).catch(console.error)
    })
  }, [navigate])

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