import { expect, test } from '@playwright/test'
const CHALLENGE_GAMES = [{ id: 'emoji-decode', challengeId: '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10' }, { id: 'word-assembly', challengeId: '7c4a2f96-08db-4e15-b3c7-1d9e5a80f463' }, { id: 'jaws-of-risk', challengeId: 'd5e8b317-4c62-49af-8b03-2f7c19a6d5e8' }]

test('Image Decode keeps answers open when the reminder ends', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })

  await page.clock.install()
  await page.getByRole('navigation', { name: 'Admin views' }).getByRole('link', { name: 'Challenges', exact: true }).click()
  const challenge = page.locator('.card--locked').filter({hasText:'Challenge 1 - Image Decode'})
  await expect(challenge).toContainText('Image Decode')
  await challenge.getByRole('button', {name:'Play',exact:true}).click()
  await expect(page).toHaveURL(`/admin/play/emoji-decode/${CHALLENGE_GAMES[0].challengeId}`)

  await expect(page.getByText('Play solo instead', { exact: true })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Kuning', exact: true }).check()
  await page.getByRole('button', { name: 'Start team run (1)', exact: true }).click()
  const answer = page.getByRole('textbox', { name: 'Kuning answer', exact: true })
  await page.clock.runFor(16000)
  await expect(page.locator('.qa-stage__timer strong')).toHaveText('0s')
  await expect(answer).toBeEnabled()
  await expect(page.locator('.run-panel__answers tbody tr td:last-child')).toHaveText('0')
  await answer.fill('not the answer')
  await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
  await expect(page.locator('.run-panel__answers tbody tr td:last-child')).toHaveText('-10')
  await expect(page.locator('.qa-stage__hint')).toContainText('Laporan')
  await answer.fill('SLIK')
  await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
  await expect(page.locator('.run-panel__answers tbody tr td:last-child')).toHaveText('0')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(answer).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/image-decode-mobile.png', fullPage: true })
})

test('a passed Image Decode reminder leaves both scores unchanged', async ({ page, context }) => {
  await page.goto('/admin')
  for (const name of ['Timeout Alpha', 'Timeout Beta']) {
    await page.getByRole('textbox', { name: 'New team name' }).fill(name)
    await page.getByRole('button', { name: 'Add team', exact: true }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
  await page.goto('/admin/challenges')
  await page.goto(`/admin/play/emoji-decode/${CHALLENGE_GAMES[0].challengeId}`)
  const time = new Date()
  await page.clock.install({ time })
  await page.clock.pauseAt(new Date(time.getTime() + 1000))
  for (const name of ['Timeout Alpha', 'Timeout Beta']) await page.locator('.run-panel__teams').getByRole('checkbox', { name, exact: true }).check()
  const popup = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Start team run (2)' }).click()
  await popup
  await page.getByRole('radio', { name: 'Pass to an opponent' }).check()
  await page.getByRole('combobox', { name: 'Opponent team' }).selectOption({ index: 1 })
  await page.clock.runFor(16_000)
  await expect(page.locator('.run-panel__title')).toContainText('question 1 of 10')
  const scores = page.locator('.run-panel__answers tbody tr td:last-child')
  await expect(scores).toHaveText(['0', '0'])
})
