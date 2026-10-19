import { test, expect } from '@playwright/test'

test('all GP shield displays use the shared supplied PNG on admin and public screens', async ({ page }) => {
  const routes = [
    ['leaderboard', 10], ['scoreboard', 5], ['rewards', 5], ['tactical', 5],
    ['card-reveal', 5], ['gigarisk', 5], ['heart-of-awareness', 5], ['podium', 3],
  ] as const
  for (const prefix of ['', '/admin']) for (const [route, count] of routes) {
    // Admin tactical controls show GP as text; Card Reveal has no admin route.
    if (prefix && (route === 'card-reveal' || route === 'tactical')) continue
    await page.goto(`${prefix}/${route}`)
    const shields = page.locator('img.gp-shield-icon')
    await expect(shields).toHaveCount(count)
    expect(await shields.evaluateAll((images) => [...new Set(images.map((image) => image.getAttribute('src')))])).toEqual(['/ui/gp-shield.png'])
    await expect.poll(() => shields.evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
    await expect(page.locator('svg text').filter({ hasText: /^GP$/ })).toHaveCount(0)
  }
})
