import { expect, test } from '@playwright/test'
const CHALLENGE_GAMES = [{ id: 'emoji-decode', challengeId: '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10' }, { id: 'word-assembly', challengeId: '7c4a2f96-08db-4e15-b3c7-1d9e5a80f463' }, { id: 'jaws-of-risk', challengeId: 'd5e8b317-4c62-49af-8b03-2f7c19a6d5e8' }]

for (const [title, game] of [['Image Decode', 'emoji-decode'], ['Jaw of Risk', 'jaws-of-risk']] as const) {
  test(`${title} solo questions expire once at 15 seconds and reset for the next question`, async ({ page }) => {
    await page.goto('/admin/challenges')
    const time = new Date()
    await page.clock.install({ time })
    await page.clock.pauseAt(new Date(time.getTime() + 1_000))
    await page.goto(`/admin/play/${game}/${CHALLENGE_GAMES.find((entry) => entry.id === game)!.challengeId}`)
    await page.getByText('Play solo instead', { exact: true }).click()
    const timer = page.locator('.qa-stage__timer strong')
    const score = page.locator('.stat', { has: page.locator('.stat__label', { hasText: /^Score$/ }) }).locator('.stat__value')
    await expect(timer).toHaveText('15s')
    await page.clock.runFor(14_900)
    await expect(timer).toHaveText('1s')
    await expect(score).toHaveText(game === 'emoji-decode' ? '0/110' : '0')
    await page.clock.runFor(100)
    await expect(timer).toHaveText('0s')
    await expect(score).toHaveText(game === 'emoji-decode' ? '-10/110' : '-10')
    await page.clock.runFor(15_000)
    await expect(score).toHaveText(game === 'emoji-decode' ? '-10/110' : '-10')
    await page.getByRole('button', { name: game === 'emoji-decode' ? 'Next →' : 'Next question →', exact: true }).click()
    await expect(timer).toHaveText('15s')
  })
}

test('Jaw of Risk team questions have a shared 15-second deadline and automatically pass on timeout', async ({ page, context }) => {
  await page.goto('/admin')
  await page.getByRole('textbox', { name: 'New team name' }).fill('Timer Team')
  await page.getByRole('button', { name: 'Add team', exact: true }).click()
  await expect(page.getByText('Timer Team', { exact: true })).toBeVisible()
  await page.goto('/admin/challenges')
  await page.goto(`/admin/play/jaws-of-risk/${CHALLENGE_GAMES[2].challengeId}`)
  const time = new Date()
  await page.clock.install({ time })
  await page.clock.pauseAt(new Date(time.getTime() + 1_000))
  await page.locator('.run-panel__teams').getByRole('checkbox', { name: 'Timer Team', exact: true }).check()
  const popup = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Start team run (1)' }).click()
  const projector = await popup
  await projector.clock.install({ time })
  await projector.clock.pauseAt(new Date(time.getTime() + 1_000))
  await expect(projector.locator('.qa-stage__timer')).toContainText('15s')
  await page.clock.runFor(15_000)
  await expect(page.locator('.run-panel__title')).toContainText('question 2 of 20')
  await expect(page.locator('.run-panel__answers tbody tr td:last-child')).toHaveText('-10')
  await expect(projector.locator('.qa-stage__timer')).toContainText('15s')
})
