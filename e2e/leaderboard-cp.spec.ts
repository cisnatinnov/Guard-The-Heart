import { test, expect } from '@playwright/test'

test('leaderboard omits CP labels on admin and public views', async ({ page }) => {
  await page.goto('/admin/scoreboard/9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10')
  for (const [team, score] of [['Merah', '100'], ['Biru', '90']]) {
    await page.locator('.grid-form select').selectOption({ label: team })
    await page.locator('.grid-form input[type="number"]').fill(score)
    await page.getByRole('button', { name: 'Add entry', exact: true }).click()
    await expect(page.locator('.board__row').filter({ hasText: team })).toBeVisible()
  }
  for (const route of ['/admin/leaderboard', '/leaderboard']) {
    await page.goto(route)
    await expect(page.locator('.reference-art')).toHaveAttribute('src', '/ui/visual-guide-slide-09.png')
    await expect(page.getByRole('columnheader')).toHaveText(['Rank', 'Nama Tim', 'GP Awal', 'Serangan GigaRisk', 'Efek Kartu', 'GP Akhir', 'Sisa Kartu'])
    await expect(page.locator('.ranking-cp')).toHaveCount(0)
    await expect(page.locator('.ranking-team-name')).not.toContainText(['CP', 'CP', 'CP', 'CP', 'CP'])
  }
  await page.screenshot({ path: 'test-results/leaderboard-cp.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})
