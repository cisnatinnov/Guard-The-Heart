// Derive square install icons from the Fight the Dragon logo.
// Run with npm run icons (uses the Chromium installed for end-to-end tests).
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public')
const logo = readFileSync(resolve(publicDir, 'fight-the-dragon-logo.png')).toString('base64')
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  for (const [file, size, padding] of [
    ['pwa-192x192.png', 192, 8], ['pwa-512x512.png', 512, 8],
    ['apple-touch-icon.png', 180, 8], ['maskable-512x512.png', 512, 20],
  ]) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<body style="margin:0;box-sizing:border-box;width:100vw;height:100vh;padding:${padding}%;background:#21112e;display:grid;place-items:center"><img alt="Fight the Dragon" style="width:100%;height:100%;object-fit:contain" src="data:image/png;base64,${logo}"></body>`)
    await page.locator('img').evaluate(image => image.decode())
    await page.screenshot({ path: resolve(publicDir, file) })
  }
} finally { await browser.close() }
