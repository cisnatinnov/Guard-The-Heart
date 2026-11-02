import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Capture only a new, isolated browser profile with the default demo teams.
// Start Vite first, then pass its local origin as the optional first argument.
const origin = process.argv[2] ?? 'http://127.0.0.1:5173'
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
  throw new Error('Portfolio previews must be captured from a local application.')
}
const destination = fileURLToPath(new URL('../public/portfolio/', import.meta.url))
await mkdir(destination, { recursive: true })
const browser = await chromium.launch()
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  const page = await context.newPage()
  for (const [route, file] of [['/admin', 'event-console'], ['/', 'public-display'], ['/scoreboard', 'scoreboard']]) {
    await page.goto(new URL(route, origin).href)
    await page.locator('.app__main').waitFor()
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})))
    })
    await page.screenshot({ path: `${destination}${file}.jpg`, type: 'jpeg', quality: 88, animations: 'disabled' })
  }
  await context.close()
} finally {
  await browser.close()
}
console.log('Updated three portfolio previews from isolated demo state.')
