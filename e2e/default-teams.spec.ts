import { test, expect } from '@playwright/test'

test('default teams allow renaming, protect deletion and keep reward colours when ranks change', async ({ page, context }) => {
  await page.goto('/admin')
  for (const name of ['Merah', 'Hijau', 'Biru', 'Kuning', 'Pink']) {
    const team = page.locator('.card', { has: page.locator('.card__title', { hasText: new RegExp(`^${name}$`) }) })
    await expect(team).toBeVisible()
    await expect(team.getByRole('button', { name: 'Deactivate', exact: true })).toBeEnabled()
    await expect(team.getByRole('button', { name: 'Rename', exact: true })).toBeEnabled()
    await expect(team.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled()
  }
  await page.reload()
  await expect(page.locator('.card')).toHaveCount(5)
  await page.goto('/admin/scoreboard/9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10')
  for (const [index, name] of ['Hijau', 'Pink', 'Merah', 'Biru', 'Kuning'].entries()) {
    await page.locator('.grid-form select').selectOption({ label: name })
    await page.locator('.grid-form input[type="number"]').fill(String(50 - index * 10))
    await page.getByRole('button', { name: 'Add entry', exact: true }).click()
    await expect(page.locator('.board__row')).toHaveCount(index + 1)
  }
  await page.getByRole('button', { name: 'Claim Rewards', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/rewards\//)
  const projector = await context.newPage()
  await projector.goto(page.url().replace('/admin/', '/'))
  const names = ['Hijau', 'Pink', 'Merah', 'Biru', 'Kuning']
  const labels: Record<string,string> = { Merah:'rgb(222, 160, 164)', Biru:'rgb(148, 187, 220)', Kuning:'rgb(220, 199, 132)', Hijau:'rgb(153, 197, 172)', Pink:'rgb(213, 165, 191)' }
  for (const surface of [page, projector]) {
    for (const name of names) {
      const row = surface.getByRole('listitem', { name, exact: true })
      await expect(row.locator('.reward-stage__earned')).toHaveCSS('background-color', 'rgb(32, 46, 70)')
      await expect(row.locator('.reward-stage__identity .team-pill')).toHaveText(`${name}`)
      await expect(row.locator('.reward-stage__identity .team-pill')).toHaveCSS('background-color', labels[name])
      await expect.poll(() => row.evaluate((element) => getComputedStyle(element, '::before').backgroundColor)).toBe('rgb(32, 46, 70)')
    }
  }
  await projector.screenshot({ path: 'test-results/rewards-team-colours.png' })
  await page.goto('/admin/scoreboard/9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10')
  await page.locator('.board__row', { hasText: 'Kuning' }).getByRole('button', { name: 'Edit Score' }).click()
  await page.locator('.grid-form input[type="number"]').fill('100')
  await page.getByRole('button', { name: 'Update score', exact: true }).click()
  await page.getByRole('button', { name: 'Claim Rewards', exact: true }).click()
  await expect(page.getByRole('listitem', { name: 'Kuning', exact: true }).locator('.reward-stage__earned')).toHaveCSS('background-color', 'rgb(32, 46, 70)')
  await expect(page.locator('.reward-stage__row').first()).toHaveAttribute('aria-label', 'Kuning')
})
