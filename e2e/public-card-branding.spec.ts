import { expect, test } from '@playwright/test'
import { challengeOne, seedCards } from './support/cardFixture'

const matching = '/admin/play/word-assembly/7c4a2f96-08db-4e15-b3c7-1d9e5a80f463'
const jaw = '/admin/play/jaws-of-risk/d5e8b317-4c62-49af-8b03-2f7c19a6d5e8'

for (const route of [matching, jaw]) test(`public options have A–D labels, mirror selections, and hide the timer: ${route}`, async ({ page, context }) => {
  await page.goto(route)
  const publicPage = await context.newPage()
  await publicPage.goto(route.replace('/admin', ''))
  await expect(page.getByRole('timer', { name: 'Turn reminder', exact: true })).toBeVisible()
  await expect(publicPage.getByRole('timer')).toHaveCount(0)
  await expect(publicPage.locator('.quiz-option b')).toHaveText(['A', 'B', 'C', 'D'])
  const option = page.locator('.quiz-option').first()
  const optionText = await option.locator('span').textContent()
  await option.click()
  for (const screen of [page, publicPage]) await expect(screen.locator('.quiz-option.is-selected span')).toHaveText(optionText!)
  await publicPage.reload()
  await expect(publicPage.locator('.quiz-option.is-selected span')).toHaveText(optionText!)
  if (route === matching) {
    await page.getByRole('button', { name: 'Reveal answer', exact: true }).click()
    await expect(publicPage.locator('.quiz-option.is-selected')).toHaveCount(1)
    await page.getByRole('button', { name: 'Next question', exact: true }).click()
    await expect(publicPage.locator('.quiz-option.is-selected')).toHaveCount(0)
  }
})

test('matching card artwork switches themes live on host and public and still awards pairs', async ({ page, context }) => {
  await page.goto(matching)
  const projector = await context.newPage()
  await projector.goto(matching.replace('/admin', ''))
  await expect(page.locator('.flipping-presentation__art')).toHaveCount(0)
  await expect(page.locator('.flipping-presentation__brand')).toContainText('Matching Cards')
  await page.clock.install()
  await page.getByRole('button', { name: /Tolak \(Deny\)/ }).click()
  await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
  await page.getByRole('button', { name: 'Show cards', exact: true }).click()
  await page.clock.runFor(5100)
  for (const screen of [page, projector]) {
    await expect(screen.locator('.tile img').first()).toHaveAttribute('src', '/cards/branded/dark/matching-back.svg')
  }
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click()
  for (const screen of [page, projector]) {
    await expect(screen.locator('.tile img').first()).toHaveAttribute('src', '/cards/branded/light/matching-back.svg')
    await expect.poll(() => screen.locator('.tile img').first().evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  }
  await projector.locator('.tile[data-pair="word-1"]').first().click()
  await projector.locator('.tile[data-pair="word-1"]').nth(1).click()
  await expect(page.locator('.tile--matched')).toHaveCount(2)
  await expect(page.locator('.tile--matched img').first()).toHaveAttribute('src', '/cards/branded/light/matching-1.svg')
  await expect(page.locator('.challenge-score').filter({ hasText: 'Kuning' }).locator('strong')).toHaveText('15')
  await projector.setViewportSize({ width: 1280, height: 720 })
  const board = (await projector.locator('.flipping-presentation').boundingBox())!
  const scores = (await projector.locator('.challenge-answer-controls').boundingBox())!
  const scoreValue = (await projector.locator('.challenge-score strong').first().boundingBox())!
  expect(scoreValue.y + scoreValue.height).toBeLessThanOrEqual(720)
  expect(board.y + board.height).toBeLessThanOrEqual(scores.y + 1)
  for (const tile of await projector.locator('.tile').all()) {
    const box = (await tile.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(scores.y + 1)
  }
  await projector.screenshot({ path: '.validation.tmp/branded-matching-light.png', fullPage: true })
})

test('reward and tactical cards use branded assets and follow live theme changes', async ({ page, context }) => {
  await seedCards(page, challengeOne, [['Biru', 'Normal Heal Card #01']], false, true)
  await expect(page.locator('.card-art img').first()).toHaveAttribute('src', /\/cards\/branded\/dark\//)
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click()
  await expect(page.locator('.card-art img').first()).toHaveAttribute('src', /\/cards\/branded\/light\//)
  await page.goto(`/admin/rewards/${challengeOne}`)
  const projector = await context.newPage()
  await projector.goto(`/rewards/${challengeOne}`)
  for (const screen of [page, projector]) {
    await expect(screen.locator('.reward-stage__title')).toHaveText('Reward Claim')
    await expect(screen.locator('.reward-stage__art')).toHaveCount(0)
    await expect(screen.locator('.card-art img').first()).toHaveAttribute('src', /\/cards\/branded\/light\//)
  }
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click()
  await expect(projector.locator('.card-art img').first()).toHaveAttribute('src', /\/cards\/branded\/dark\//)
  await projector.screenshot({ path: '.validation.tmp/branded-rewards-dark.png', fullPage: true })
})

test('public question and card layouts fit both themes on desktop and phone', async ({ page }) => {
  for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript((value) => localStorage.setItem('guard-the-heart-theme', value), theme)
    for (const route of [matching, jaw, matching.replace('/admin', ''), jaw.replace('/admin', '')]) {
      await page.goto(route)
      await expect(page.locator('.workbook-quiz')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(page.locator('.quiz-option b')).toHaveText(['A', 'B', 'C', 'D'])
      await page.screenshot({ path: `.validation.tmp/cards-${theme}-${width}-${route.replaceAll('/', '_')}.png`, fullPage: true })
    }
  }
})
