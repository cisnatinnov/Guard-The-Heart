import { test, expect } from '@playwright/test'

test('leaderboard shows earned CP on admin and public views', async ({ page }) => {
  await page.goto('/admin/scoreboard/9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10')
  for (const [team, score] of [['Merah', '100'], ['Biru', '90']]) {
    await page.locator('.grid-form select').selectOption({ label: team })
    await page.locator('.grid-form input[type="number"]').fill(score)
    await page.getByRole('button', { name: 'Add entry', exact: true }).click()
    await expect(page.locator('.board__row').filter({ hasText: team })).toBeVisible()
  }
  for (const route of ['/admin/leaderboard', '/leaderboard']) {
    await page.goto(route)
    await expect(page.getByRole('columnheader', { name: 'CP', exact: true })).toBeVisible()
    await expect(page.locator('.ranking-cp')).toHaveText(['10', '8', '0', '0', '0'])
    const row = page.locator('.ranking-table tbody tr').first()
    const gpSize = await row.locator('td').nth(6).locator('strong').evaluate((element) => getComputedStyle(element).fontSize)
    await expect(row.locator('.ranking-cp strong')).toHaveCSS('font-size', gpSize)
  }
  await page.screenshot({ path: 'test-results/leaderboard-cp.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})
