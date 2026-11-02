import './shims/buffer-polyfill'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './views/App'
import './styles/index.css'
import './styles/layout.css'
import './styles/team-colors.css'
import './styles/theme.css'
import './styles/admin.css'
import './styles/appearance.css'
import './styles/comfort.css'
import './styles/summary-boards.css'
import './styles/play-experience.css'
import './styles/branded-cards.css'
import './styles/feature-theme.css'
import { initializeTheme } from './services/theme'
initializeTheme()

// Auto-updating service worker: a new build is picked up and activated
// without asking the user, and cached static assets keep the app usable offline.
if (import.meta.env.PROD) registerSW({ immediate: true })
// Retire preview workers that could serve old screens during development.
// Event data in IndexedDB and localStorage is preserved.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
    if (!registrations.length) return
    await Promise.all(registrations.map(registration => registration.unregister()))
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('workbox-')).map(key => caches.delete(key)))
    if (navigator.serviceWorker.controller) window.location.reload()
  }).catch(console.error)
}

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root was not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
