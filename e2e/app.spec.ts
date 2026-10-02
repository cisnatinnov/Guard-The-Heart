import { test, expect } from '@playwright/test'

test.describe('Guard The Heart', () => {
  test('runs the full MVC flow and survives a reload', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (error) => consoleErrors.push(error.message))

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Guard The Heart' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })

    // --- Team view: create ---
    for (const team of ['Sentinels', 'Wardens']) {
      await page.getByRole('textbox', { name: 'New team name' }).fill(team)
      await page.getByRole('button', { name: 'Add team' }).click()
      await expect(page.getByText(team, { exact: true })).toBeVisible({ timeout: 15_000 })
    }

    // --- Challenge view: create ---
    await page.getByRole('button', { name: 'Challenge', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible()
    await page.getByRole('textbox', { name: 'New challenge name' }).fill('Arena One')
    await page.getByRole('button', { name: 'Add challenge' }).click()
    await expect(page.getByText('Arena One')).toBeVisible({ timeout: 15_000 })

    // --- Scoreboard per challenge view: rank derives from score ---
    await page.getByRole('button', { name: 'Scoreboard' }).first().click()
    await expect(page.getByRole('heading', { name: 'Scoreboard per challenge' })).toBeVisible()

    await page.locator('.grid-form select').selectOption({ label: 'Sentinels' })
    await page.locator('.grid-form input[type="number"]').fill('40')
    await page.getByRole('button', { name: 'Add entry' }).click()

    await page.locator('.grid-form select').selectOption({ label: 'Wardens' })
    await page.locator('.grid-form input[type="number"]').fill('120')
    await page.getByRole('button', { name: 'Add entry' }).click()

    const rows = page.locator('tbody tr')
    // Rank 1 goes to the higher score and earns the top-tier rewards.
    await expect(rows.nth(0)).toContainText('Wardens')
    await expect(rows.nth(0)).toContainText('120')
    await expect(rows.nth(0)).toContainText('10')
    await expect(rows.nth(0)).toContainText('3')
    await expect(rows.nth(1)).toContainText('Sentinels')
    await expect(rows.nth(1)).toContainText('2')
    await expect(rows.nth(1)).toContainText('8')
    await expect(rows.nth(1)).toContainText('2')

    // --- Scoreboard total view: aggregated per team ---
    await page.getByRole('button', { name: 'Scoreboard total' }).click()
    await expect(page.getByRole('heading', { name: 'Scoreboard total' })).toBeVisible()

    const totals = page.locator('tbody tr')
    await expect(totals.nth(0)).toContainText('Wardens')
    await expect(totals.nth(0)).toContainText('120')
    await expect(totals.nth(0)).toContainText('10')
    await expect(totals.nth(0)).toContainText('3')
    await expect(totals.nth(1)).toContainText('Sentinels')
    await expect(totals.nth(1)).toContainText('40')
    await expect(totals.nth(1)).toContainText('8')
    // Guard power is no longer a scoreboard column.
    await expect(totals.nth(0)).not.toContainText('GP')

    // --- Team view: guard power accrues from 5 plus the rank rewards ---
    await page.getByRole('button', { name: 'Team', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible()
    // Wardens won (3 GP earned), Sentinels placed second (2 GP earned).
    await expect(page.locator('.card', { hasText: 'Wardens' })).toContainText('GP 8')
    await expect(page.locator('.card', { hasText: 'Sentinels' })).toContainText('GP 7')

    // --- Persistence: reload must restore the SQLite database ---
    await page.waitForTimeout(600) // allow the debounced IndexedDB write
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Sentinels', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Wardens', { exact: true })).toBeVisible({ timeout: 30_000 })

    // Recalculated totals survive the reload too.
    await page.getByRole('button', { name: 'Scoreboard total' }).click()
    await expect(page.locator('tbody tr').nth(0)).toContainText('Wardens', { timeout: 15_000 })
    await expect(page.locator('tbody tr').nth(0)).toContainText('120')

    expect(consoleErrors).toEqual([])
  })

  test('blocks a sixth entry for the same challenge', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })

    for (let i = 0; i < 6; i += 1) {
      await page.getByRole('textbox', { name: 'New team name' }).fill(`Team ${i}`)
      await page.getByRole('button', { name: 'Add team' }).click()
    }

    await page.getByRole('button', { name: 'Challenge', exact: true }).click()
    await page.getByRole('textbox', { name: 'New challenge name' }).fill('Capped Arena')
    await page.getByRole('button', { name: 'Add challenge' }).click()
    await expect(page.getByText('Capped Arena')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Scoreboard' }).first().click()
    await expect(page.getByRole('heading', { name: 'Scoreboard per challenge' })).toBeVisible()

    for (let i = 0; i < 5; i += 1) {
      await page.locator('.grid-form select').selectOption({ label: `Team ${i}` })
      await page.locator('.grid-form input[type="number"]').fill(String((i + 1) * 10))
      await page.getByRole('button', { name: 'Add entry' }).click()
    }
    await expect(page.locator('tbody tr')).toHaveCount(5)

    // The 6th team is still selectable, but submitting is rejected outright.
    await expect(page.locator('.alert--info')).toContainText('maximum of 5 entries')
    await page.locator('.grid-form select').selectOption({ label: 'Team 5' })
    await page.locator('.grid-form input[type="number"]').fill('60')
    await page.getByRole('button', { name: 'Add entry' }).click()
    await expect(page.locator('.alert--error')).toContainText('at most 5 entries')
    await expect(page.locator('tbody tr')).toHaveCount(5)
  })

  test('service worker precaches assets for offline use', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Guard The Heart' })).toBeVisible()

    const registration = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready
      return { scope: reg.scope, active: Boolean(reg.active) }
    })
    expect(registration.active).toBe(true)

    await page.context().setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Guard The Heart' })).toBeVisible({ timeout: 30_000 })
    await page.context().setOffline(false)
  })
})