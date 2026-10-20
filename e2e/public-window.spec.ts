import { test, expect } from '@playwright/test'

test('public startup returns focus to admin after the browser activates the new window', async ({ page, context }) => {
  await page.goto('/admin')
  let release!: () => void
  const waiting = new Promise<void>((resolve) => { release = resolve })
  await context.route(/\/assets\/.*\.js$/, async (route) => {
    if (route.request().frame().url().endsWith('/leaderboard')) await waiting
    await route.continue()
  })
  const opening = page.waitForEvent('popup')
  await page.getByRole('link', { name: 'Leaderboard', exact: true }).click()
  const projector = await opening
  try {
    await projector.bringToFront()
    await expect.poll(() => projector.evaluate(() => document.hasFocus())).toBe(true)
  } finally { release() }
  await projector.waitForLoadState('load')
  await expect(projector.locator('.public-ranking')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true)
  await expect(page).toHaveURL(/\/admin\/leaderboard$/)
  await context.unrouteAll({ behavior: 'wait' })
})

test('Timer has its own window and stays running while other features change', async ({ page, context }) => {
  await page.goto('/admin')
  const openingTimer = page.waitForEvent('popup')
  await page.getByRole('link', { name: 'Timer', exact: true }).click()
  const timer = await openingTimer
  await expect(timer).toHaveURL(/\/timer$/)
  await page.getByRole('spinbutton', { name: 'Minutes' }).fill('1')
  await page.getByRole('spinbutton', { name: 'Seconds' }).fill('0')
  await page.getByRole('button', { name: 'Set timer', exact: true }).click()
  await page.getByRole('button', { name: 'Start timer', exact: true }).click()

  const openingProjector = page.waitForEvent('popup')
  await page.getByRole('link', { name: 'Leaderboard', exact: true }).click()
  const projector = await openingProjector
  await expect(projector).toHaveURL(/\/leaderboard$/)
  await page.getByRole('link', { name: 'Podium', exact: true }).click()
  await expect(projector).toHaveURL(/\/podium$/)
  await expect(timer).toHaveURL(/\/timer$/)
  await expect(timer.getByRole('timer')).toBeVisible()
  await expect.poll(() => timer.getByRole('timer').textContent()).not.toBe('01:00')

  await page.getByRole('link', { name: 'Timer', exact: true }).click()
  await expect(projector).toHaveURL(/\/podium$/)
  expect(context.pages()).toHaveLength(3)
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true)
  await timer.close()
  const reopening = page.waitForEvent('popup')
  await page.getByRole('link', { name: 'Timer', exact: true }).click()
  const replacement = await reopening
  await expect(replacement).toHaveURL(/\/timer$/)
  await expect(projector).toHaveURL(/\/podium$/)
  expect(context.pages()).toHaveLength(3)
})

test('features open one public window, keep admin active, reuse it and reopen after closing', async ({ page, context }) => {
  await page.goto('/admin')
  const popup = page.waitForEvent('popup')
  await page.getByRole('link', { name: 'Leaderboard', exact: true }).click()
  const projector = await popup
  await expect(projector).toHaveURL(/\/leaderboard$/)
  await expect(page).toHaveURL(/\/admin\/leaderboard$/)
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true)

  const challengeId = '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'
  await page.goto(`/admin/scoreboard/${challengeId}`)
  await page.getByRole('link', { name: 'Tactical Phase', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/tactical/${challengeId}$`))
  await expect(projector).toHaveURL(new RegExp(`/tactical/${challengeId}$`))
  expect(context.pages()).toHaveLength(2)
  await page.goto('/admin')

  for (const [label, path] of [['Scoreboard', 'scoreboard'], ['Podium', 'podium'], ['Urutan Main', 'turn-order'], ['Rewards', 'rewards'], ['Tactical Phase', 'tactical'], ['Serangan GigaRisk', 'gigarisk']]) {
    await page.getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/${path}$`))
    await expect(projector).toHaveURL(new RegExp(`/${path}$`))
    expect(context.pages()).toHaveLength(2)
    await expect(page.getByRole('button', { name: /\(Public\)/ })).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true)
  }

  await page.reload()
  await page.getByRole('link', { name: 'Leaderboard', exact: true }).click()
  await expect(projector).toHaveURL(/\/leaderboard$/)
  expect(context.pages()).toHaveLength(2)
  await projector.close()
  const reopened = page.waitForEvent('popup')
  await page.getByRole('link', { name: 'Podium', exact: true }).click()
  const replacement = await reopened
  await expect(replacement).toHaveURL(/\/podium$/)
  await expect(page).toHaveURL(/\/admin\/podium$/)
  expect(context.pages()).toHaveLength(2)
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true)
})
