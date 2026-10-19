import { test, expect } from '@playwright/test'

for (const width of [1280, 768, 390]) {
  test(`public and admin layouts fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 })
    await page.goto('/admin/gp-transactions')
    await expect(page.getByRole('table', { name: 'Transaksi GP' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    for (const route of ['/admin', '/admin/gp-transactions', '/admin/challenges', '/admin/podium', '/admin/heart-of-awareness', '/admin/turn-order', '/admin/gigarisk', '/podium', '/heart-of-awareness', '/turn-order', '/gigarisk', '/admin/scoreboard', '/admin/leaderboard', '/admin/rewards', '/admin/tactical', '/admin/timer', '/timer', '/admin/play/word-assembly', '/admin/play/emoji-decode', '/admin/play/jaws-of-risk', '/', '/scoreboard', '/leaderboard', '/rewards', '/tactical', '/card-reveal', '/play/emoji-decode', '/play/jaws-of-risk', '/play/word-assembly']) {
      await page.goto(route)
      await expect(page.locator('.app__main')).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
      if (route === '/admin/rewards') {
        const toolbar = await page.locator('.admin-toolbar').boundingBox()
        const artwork = await page.locator('.reward-stage').boundingBox()
        expect(toolbar && artwork && toolbar.y + toolbar.height <= artwork.y).toBeTruthy()
      }
      if (route === '/card-reveal') {
        const statuses = page.locator('.tactical-stage__status')
        await expect(statuses).toHaveCount(5)
        expect(await statuses.evaluateAll((labels) => labels.every((label) => label.scrollWidth <= label.clientWidth + 1 && label.scrollHeight <= label.clientHeight + 1))).toBe(true)
      }
      if (!route.startsWith('/admin')) {
        const stage = page.locator('.reward-stage, .tactical-stage, .qa-stage, .flipping-presentation, .public-ranking, .podium-stage, .reference-stage, .event-timer-stage, .crocodile-stage').first()
        await expect(stage).toBeVisible()
        const bounds = await stage.boundingBox()
        expect(bounds?.width).toBeGreaterThan(width * .85)
      }
      await page.screenshot({ path: `test-results/ui-${width}-${route.replaceAll('/', '-') || 'home'}.png`, fullPage: route.startsWith('/admin') })
    }
  })
}
