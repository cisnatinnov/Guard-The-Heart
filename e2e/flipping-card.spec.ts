import { test, expect } from '@playwright/test'

test('matching only rotates without penalties, has no points and completes on both screens', async ({ page, context }) => {
  await page.goto('/admin')
  for (const name of ['Alpha', 'Beta']) {
    await page.getByRole('textbox', { name: 'New team name' }).fill(name)
    await page.getByRole('button', { name: 'Add team', exact: true }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
  await page.goto('/admin/challenges')
  await expect(page.locator('.card--locked')).toHaveCount(1)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const time = new Date()
  await page.clock.install({ time })
  await page.clock.pauseAt(new Date(time.getTime() + 1000))
  for (const name of ['Alpha', 'Beta']) await page.locator('.run-panel__teams').getByRole('checkbox', { name, exact: true }).check()
  const popup = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Start team run (2)' }).click()
  const projector = await popup
  await expect(projector.locator('.flipping-presentation__art')).toHaveAttribute('src', '/ui/flipping-slide-03-reference.png')
  const stage = await projector.locator('.flipping-presentation').boundingBox()
  const firstCard = await projector.locator('.tile').first().boundingBox()
  expect(stage).not.toBeNull()
  expect(firstCard).not.toBeNull()
  expect(Math.abs(firstCard!.x - stage!.x - stage!.width * .126)).toBeLessThan(1)
  expect(Math.abs(firstCard!.width - stage!.width * .132)).toBeLessThan(1)
  await expect(projector.locator('.tile').first()).toHaveCSS('background-image', 'none')
  await projector.screenshot({ path: 'test-results/flipping-slide-03.png' })
  const order = await page.getByRole('list', { name: 'Roulette turn order' }).locator('li:not([aria-hidden])').evaluateAll((items) => items.map((item) => item.childNodes[0].textContent))
  const active = page.locator('.flipping-presentation__teams [aria-current]')
  await expect(active).toContainText(order[0]!)
  await page.locator('.tile[data-pair="word-1"]').first().click()
  await page.locator('.tile[data-pair="word-2"]').first().click()
  await page.clock.runFor(1000)
  await expect(active).toContainText(order[0]!)
  await page.locator('.flipping-presentation__teams').getByRole('button', { name: order[1]!, exact: true }).click()
  await expect(active).toContainText(order[1]!)
  await expect(page.getByRole('table', { name: 'Matching scores' })).toHaveCount(0)
  await page.clock.runFor(20100)
  await expect(active).toContainText(order[1]!)
  await page.locator('.flipping-presentation__teams').getByRole('button', { name: order[0]!, exact: true }).click()
  await expect(active).toContainText(order[0]!)
  for (let pair = 1; pair <= 10; pair++) {
    await page.locator(`.tile[data-pair="word-${pair}"]`).nth(0).click()
    await page.locator(`.tile[data-pair="word-${pair}"]`).nth(1).click()
    if (pair < 10) {
      await expect(projector.locator('.tile--matched')).toHaveCount(pair * 2)
      await expect(page.getByRole('list', { name: 'Answer choices' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Answer myself', exact: true })).toHaveCount(0)
      if (pair === 1) {
        await expect(page.getByRole('table', { name: 'Matching scores' })).toHaveCount(0)
        await projector.screenshot({ path: 'test-results/matching-only.png' })
        await projector.reload()
        await expect(projector.locator('.tile--matched')).toHaveCount(2)
      }
    }
  }
  await expect(page.getByText('All pairs matched!', { exact: true })).toBeVisible()
  await expect(projector.getByText('All pairs matched!', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/play\/word-assembly\//)
  await expect(projector).toHaveURL(/\/play\/word-assembly\//)
  await page.goto('/admin/scoreboard/7c4a2f96-08db-4e15-b3c7-1d9e5a80f463')
  await expect(page.locator('.board__row')).toHaveCount(0)
})

test('solo flipping has only matching cards', async ({ page }) => {
  await page.goto('/admin/challenges')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByText('Play solo instead', { exact: true }).click()
  await page.locator('.tile[data-pair="word-1"]').nth(0).click()
  await page.locator('.tile[data-pair="word-1"]').nth(1).click()
  await expect(page.getByText('Matched pairs: 1/10', { exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Answer choices' })).toHaveCount(0)
})
