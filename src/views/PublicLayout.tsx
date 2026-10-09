import { Outlet } from 'react-router-dom'
import { useDatabase } from '../hooks/useDatabase'

export function PublicLayout() {
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

  return (
    <div className="app app--public">
      <main className="app__main">
        <Outlet />
      </main>
    </div>
  )
}