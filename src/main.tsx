import './shims/buffer-polyfill'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './views/App'
import './styles/index.css'

// Auto-updating service worker: a new build is picked up and activated
// without asking the user, and cached static assets keep the app usable offline.
registerSW({ immediate: true })

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root was not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)