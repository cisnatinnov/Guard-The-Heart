import { test, expect } from '@playwright/test'

test('team CRUD, score correction, leaderboard and offline reload still work', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Teams', exact: true })).toBeVisible()
  for (const name of ['Sentinels', 'Wardens']) {
    await page.getByRole('textbox', { name: 'New team name' }).fill(name)
    await page.getByRole('button', { name: 'Add team', exact: true }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
  await page.goto('/admin/challenges')
  await expect(page.locator('.card--locked')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Add challenge' })).toHaveCount(0)
  await page.locator('.card--locked').first().getByRole('button', { name: 'Scoreboard', exact: true }).click()
  for (const [name, score] of [['Sentinels', '40'], ['Wardens', '120']]) {
    await page.locator('.grid-form select').selectOption({ label: name })
    await page.locator('.grid-form input[type="number"]').fill(score)
    await page.getByRole('button', { name: 'Add entry' }).click()
    await expect(page.locator('.board__row', { hasText: name })).toBeVisible()
  }
  await expect(page.locator('.board__row').first()).toContainText('Wardens')
  await page.locator('.board__row', { hasText: 'Sentinels' }).getByRole('button', { name: 'Edit CP' }).click()
  await expect(page.locator('.grid-form select')).toBeDisabled()
  await page.locator('.grid-form input[type="number"]').fill('150')
  await page.getByRole('button', { name: 'Update challenge point' }).click()
  await expect(page.locator('.board__row')).toHaveCount(2)
  await expect(page.locator('.board__row').first()).toContainText('Sentinels')
  await page.goto('/admin/leaderboard')
  await page.getByRole('button', { name: 'Recalculate', exact: true }).click()
  await expect(page.locator('.alert--info')).toContainText('Leaderboard recalculated')
  await page.getByRole('button', { name: 'Save offline copy' }).click()
  await expect(page.locator('.alert--info')).toContainText('Offline copy saved')
  await page.reload()
  await expect(page.locator('.ranking-table tbody tr').first()).toContainText('Sentinels')
  await page.goto('/leaderboard')
  await expect(page.getByRole('table', { name: 'Team leaderboard' }).first()).toContainText('Sentinels')
  await expect(page.getByRole('button', { name: 'Recalculate', exact: true })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Total score', exact: true })).toHaveCount(0)

  await page.goto('/admin')
  const publicTabPromise = page.context().waitForEvent('page')
  await page.getByRole('link', { name: 'Public', exact: true }).click()
  const publicTab = await publicTabPromise
  await expect(page.getByRole('heading', { name: 'Public presentation' })).toBeVisible()
  await expect(publicTab.locator('.main-presentation__slide img')).toHaveAttribute('src', '/ui/main-presentation/slide-01.png')
  for (let slide = 2; slide <= 7; slide += 1) {
    await page.getByRole('button', { name: 'Next →' }).click()
    await expect(page.locator('.presentation-admin__controls span')).toHaveText(`Slide ${slide} of 7`)
    if (slide === 5) await expect(publicTab.getByRole('timer')).toBeVisible()
    if (slide === 6 || slide === 7) {
      await expect(publicTab.locator('.main-presentation__slide img')).toHaveAttribute('src', `/ui/main-presentation/slide-0${slide}.png`)
      await expect.poll(() => publicTab.locator('.main-presentation__slide img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
    }
  }
  await expect(page.getByRole('button', { name: 'Next →' })).toBeDisabled()
})


test('service worker preserves the admin screen offline', async ({ page, context }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Teams', exact: true })).toBeVisible()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Teams', exact: true })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Teams', exact: true })).toBeVisible()
  await context.setOffline(false)
})
