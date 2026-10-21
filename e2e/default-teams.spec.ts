import { test, expect } from '@playwright/test'

test('default teams are locked and reward colours follow teams when ranks change', async ({ page, context }) => {
  await page.goto('/admin')
  for (const name of ['Merah', 'Hijau', 'Biru', 'Kuning', 'Pink']) {
    const team = page.locator('.card', { has: page.locator('.card__title', { hasText: new RegExp(`^${name}$`) }) })
    await expect(team).toBeVisible()
    await expect(team.getByRole('button', { name: 'Deactivate', exact: true })).toBeEnabled()
    for (const action of ['Rename', 'Delete']) await expect(team.getByRole('button', { name: action, exact: true })).toBeDisabled()
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
  const colours = { Hijau: 'rgb(208, 239, 192)', Pink: 'rgb(252, 216, 230)', Merah: 'rgb(250, 198, 195)', Biru: 'rgb(209, 226, 230)', Kuning: 'rgb(254, 235, 195)' }
  const labels: Record<string,string> = { Merah:'rgb(255, 36, 36)', Biru:'rgb(67, 179, 255)', Kuning:'rgb(255, 208, 57)', Hijau:'rgb(90, 255, 125)', Pink:'rgb(255, 21, 133)' }
  for (const surface of [page, projector]) {
    for (const [name, colour] of Object.entries(colours)) {
      const row = surface.getByRole('listitem', { name, exact: true })
      await expect(row.locator('.reward-stage__earned')).toHaveCSS('background-color', colour)
      await expect(row.locator('.reward-stage__team')).toHaveText(name)
      await expect(row.locator('.reward-stage__team')).toHaveCSS('background-color', labels[name])
      await expect.poll(() => row.evaluate((element) => getComputedStyle(element, '::before').backgroundColor)).toBe(colour)
    }
  }
  await projector.screenshot({ path: 'test-results/rewards-team-colours.png' })
  await page.goto('/admin/scoreboard/9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10')
  await page.locator('.board__row', { hasText: 'Kuning' }).getByRole('button', { name: 'Edit Score' }).click()
  await page.locator('.grid-form input[type="number"]').fill('100')
  await page.getByRole('button', { name: 'Update score', exact: true }).click()
  await page.getByRole('button', { name: 'Claim Rewards', exact: true }).click()
  await expect(page.getByRole('listitem', { name: 'Kuning', exact: true }).locator('.reward-stage__earned')).toHaveCSS('background-color', colours.Kuning)
  await expect(page.locator('.reward-stage__row').first()).toHaveAttribute('aria-label', 'Kuning')
})
