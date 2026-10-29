export type Theme = 'dark' | 'light'
const KEY = 'guard-the-heart-theme'
export function readTheme(): Theme {
  return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
}
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}
export function initializeTheme(): void {
  applyTheme(readTheme())
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) applyTheme(readTheme())
  })
}
export function saveTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme)
  applyTheme(theme)
}
