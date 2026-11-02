import { useSyncExternalStore } from 'react'
import { readTheme } from '../services/theme'

function subscribe(update: () => void) {
  window.addEventListener('guard-the-heart:theme', update)
  window.addEventListener('storage', update)
  return () => { window.removeEventListener('guard-the-heart:theme', update); window.removeEventListener('storage', update) }
}
export function useTheme() {
  return useSyncExternalStore(subscribe, readTheme, () => 'dark' as const)
}
