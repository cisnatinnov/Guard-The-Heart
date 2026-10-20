export const PUBLIC_WINDOW_NAME = 'guard-the-heart-projector'
export const TIMER_WINDOW_NAME = 'guard-the-heart-timer'
const windows: Partial<Record<'projector' | 'timer', Window>> = {}
const PRESENCE_PREFIX = 'guard-the-heart-projector:'
const TIMER_PRESENCE_PREFIX = 'guard-the-heart-timer-window:'
const NAVIGATION_KEY = 'guard-the-heart-public-window-navigation'

export function listenForPublicWindowNavigation(accept: (path: string) => void): () => void {
  const receive = (event: StorageEvent) => {
    if (event.key !== NAVIGATION_KEY || !event.newValue) return
    try {
      const { path } = JSON.parse(event.newValue) as { path?: unknown }
      if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/admin')) accept(path)
    } catch { /* Ignore malformed navigation requests. */ }
  }
  window.addEventListener('storage', receive)
  return () => window.removeEventListener('storage', receive)
}

/** Chrome can activate a popup after the opener's immediate focus call. */
export function restoreAdminFocusAfterPublicLoad(): () => void {
  const restore = () => {
    try {
      const admin = window.opener as Window | null
      if (!admin || admin.closed || admin.location.origin !== window.location.origin || !admin.location.pathname.startsWith('/admin')) return
      window.blur()
      admin.focus()
    } catch { /* A display with an unrelated opener does not change focus. */ }
  }
  restore()
  const afterLoad = () => { restore(); delayed = window.setTimeout(restore, 250) }
  let delayed: number | undefined
  if (document.readyState === 'complete') afterLoad()
  else window.addEventListener('load', afterLoad, { once: true })
  return () => {
    window.removeEventListener('load', afterLoad)
    window.clearTimeout(delayed)
  }
}

export function registerPublicWindow(timer = false): () => void {
  const key = (timer ? TIMER_PRESENCE_PREFIX : PRESENCE_PREFIX) + crypto.randomUUID()
  const heartbeat = () => localStorage.setItem(key, String(Date.now()))
  const remove = () => localStorage.removeItem(key)
  heartbeat()
  const interval = window.setInterval(heartbeat, 15_000)
  window.addEventListener('pagehide', remove)
  window.addEventListener('pageshow', heartbeat)
  return () => {
    clearInterval(interval)
    window.removeEventListener('pagehide', remove)
    window.removeEventListener('pageshow', heartbeat)
    remove()
  }
}

function publicWindowExists(timer: boolean): boolean {
  const prefix = timer ? TIMER_PRESENCE_PREFIX : PRESENCE_PREFIX
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (key?.startsWith(prefix) && Date.now() - Number(localStorage.getItem(key)) < 90_000) return true
  }
  return false
}

/** Called during the click gesture so a closed projector can be reopened. */
export function openPublicDisplay(path: string, navigateExisting = false): void {
  if (!path.startsWith('/') || path.startsWith('//')) return
  const timer = path === '/timer'
  const kind = timer ? 'timer' : 'projector'
  let projector = windows[kind]
  if (projector && !projector.closed) {
    if (navigateExisting) projector.location.replace(path)
    return
  }
  if (publicWindowExists(timer)) {
    if (navigateExisting) localStorage.setItem(NAVIGATION_KEY, JSON.stringify({ path, id: crypto.randomUUID() }))
    return
  }
  const opened = window.open(path, timer ? TIMER_WINDOW_NAME : PUBLIC_WINDOW_NAME, 'popup,width=1280,height=720')
  if (!opened) throw new Error('Allow pop-ups to open the public display, then click the feature again.')
  projector = windows[kind] = opened
  projector.blur()
  window.focus()
  window.setTimeout(() => window.focus(), 0)
}

export function publicFeatureForAdmin(path: string, currentPath: string): { stage: import('./publicDisplay').DisplayStage; challengeId: string } | null {
  const stage = path.replace('/admin/', '')
  if (!['scoreboard', 'leaderboard', 'heart-of-awareness', 'podium', 'rewards', 'tactical', 'turn-order', 'gigarisk', 'timer', 'presentation'].includes(stage)) return null
  const challengeId = currentPath.match(/^\/admin\/(?:scoreboard|rewards|tactical|gigarisk)\/([^/]+)/)?.[1]
    ?? currentPath.match(/^\/admin\/play\/[^/]+\/([^/]+)/)?.[1] ?? ''
  return { stage: stage as import('./publicDisplay').DisplayStage, challengeId: decodeURIComponent(challengeId) }
}
