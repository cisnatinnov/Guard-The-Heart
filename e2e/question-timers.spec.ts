import { expect, test } from '@playwright/test'
import reference from '../src/data/reference-question-bank.json' with { type: 'json' }

for (const [title, game] of [['Image Decode', 'emoji-decode'], ['Flipping Card', 'word-assembly'], ['Jaw of Risk', 'jaws-of-risk']] as const) {
  test(`${title} solo questions expire once at 15 seconds and reset for the next question`, async ({ page }) => {
    await page.goto('/admin/challenges')
    const time = new Date()
    await page.clock.install({ time })
    await page.clock.pauseAt(new Date(time.getTime() + 1_000))
    await page.locator('.card--locked', { hasText: title }).getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByText('Play solo instead', { exact: true }).click()
    const matchPair = async () => {
      const id = await page.locator('.tile:not(.tile--matched)').first().getAttribute('data-pair')
      await page.locator(`.tile[data-pair="${id}"]`).nth(0).click()
      await page.locator(`.tile[data-pair="${id}"]`).nth(1).click()
    }
    if (game === 'word-assembly') await matchPair()
    const timer = page.locator('.qa-stage__timer strong')
    const score = page.locator('.stat', { has: page.locator('.stat__label', { hasText: /^Score$/ }) }).locator('.stat__value')
    await expect(timer).toHaveText('15s')
    if (game === 'word-assembly') {
      await page.clock.runFor(5_000)
      const wrong = reference.matchCard[0].options.find((option) => option !== reference.matchCard[0].answer)!
      await page.locator('.game-options__choice', { hasText: wrong }).click()
      await page.getByRole('button', { name: 'Answer', exact: true }).click()
      await expect(timer).toHaveText('10s')
      await page.clock.runFor(9_900)
    } else await page.clock.runFor(14_900)
    await expect(timer).toHaveText('1s')
    await expect(score).toHaveText(game === 'emoji-decode' ? '0/110' : '0')
    await page.clock.runFor(100)
    await expect(timer).toHaveText('0s')
    await expect(score).toHaveText(game === 'emoji-decode' ? '-10/110' : '-10')
    await page.clock.runFor(15_000)
    await expect(score).toHaveText(game === 'emoji-decode' ? '-10/110' : '-10')
    if (game === 'word-assembly') {
      await page.getByRole('button', { name: 'Back to cards', exact: true }).click()
      await matchPair()
    } else {
      await page.getByRole('button', { name: game === 'emoji-decode' ? 'Next →' : 'Next question →', exact: true }).click()
    }
    await expect(timer).toHaveText('15s')
  })
}

test('Jaw of Risk team questions have a shared 15-second deadline and automatically pass on timeout', async ({ page, context }) => {
  await page.goto('/admin')
  await page.getByRole('textbox', { name: 'New team name' }).fill('Timer Team')
  await page.getByRole('button', { name: 'Add team', exact: true }).click()
  await expect(page.getByText('Timer Team', { exact: true })).toBeVisible()
  await page.goto('/admin/challenges')
  await page.locator('.card--locked', { hasText: 'Jaw of Risk' }).getByRole('button', { name: 'Play', exact: true }).click()
  const time = new Date()
  await page.clock.install({ time })
  await page.clock.pauseAt(new Date(time.getTime() + 1_000))
  await page.locator('.run-panel__teams').getByRole('checkbox').check()
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
