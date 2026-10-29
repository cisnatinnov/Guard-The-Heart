import { submitQuizAnswer } from './support/challengeAnswer'
import { expect, test } from '@playwright/test'
import { readDatabase } from './support/cardFixture'

const flipping = '7c4a2f96-08db-4e15-b3c7-1d9e5a80f463'
const jaw = 'd5e8b317-4c62-49af-8b03-2f7c19a6d5e8'

test('public matching clicks synchronize and simultaneous pair clicks score once', async ({ page, context }) => {
  await page.goto(`/admin/play/word-assembly/${flipping}`)
  const publicPage = await context.newPage()
  await publicPage.goto(`/play/word-assembly/${flipping}`)
  const now = new Date()
  for (const screen of [page, publicPage]) {
    await screen.clock.install({ time: now })
    await screen.clock.pauseAt(new Date(now.getTime() + 1000))
  }
  await page.getByRole('combobox', { name: 'Answering team', exact: true }).selectOption({ label: 'Kuning' })
  await submitQuizAnswer(page, true)
  await expect(publicPage.locator('.tile')).toHaveCount(20)
  await expect(publicPage.locator('.tile').first()).toBeDisabled()
  await expect(publicPage.getByRole('button', { name: 'Submit answer', exact: true })).toHaveCount(0)
  for (const screen of [page, publicPage]) await screen.clock.runFor(5000)
  const pair = '.tile[data-pair="word-1"]'
  await publicPage.locator(pair).first().click()
  await expect(page.locator('.tile--revealed')).toHaveCount(1)
  await Promise.all([
    page.locator(pair).nth(1).dispatchEvent('click'),
    publicPage.locator(pair).nth(1).dispatchEvent('click'),
  ])
  for (const screen of [page, publicPage]) {
    await expect(screen.locator('.tile--matched')).toHaveCount(2)
    await expect(screen.getByLabel('Challenge scores')).toContainText('Kuning: 15')
  }
  await page.close()
  await publicPage.locator('.tile[data-pair="word-2"]').first().click()
  await publicPage.locator('.tile[data-pair="word-3"]').first().click()
  await expect(publicPage.locator('.tile--revealed:not(.tile--matched)')).toHaveCount(2)
  await publicPage.clock.runFor(600)
  await expect(publicPage.locator('.tile--revealed:not(.tile--matched)')).toHaveCount(0)
  await publicPage.clock.runFor(20000)
  await expect(publicPage.locator('.tile:not(.tile--matched)').first()).toBeEnabled()
})

test('public teeth accept safe presses and concurrent bite clicks deduct only once', async ({ page, context }) => {
  await page.goto(`/admin/play/jaws-of-risk/${jaw}`)
  const settings = page.getByRole('group', { name: 'Biting teeth', exact: true })
  await expect(settings).toBeVisible()
  for (const checkbox of await settings.getByRole('checkbox').all()) await checkbox.uncheck()
  await settings.getByRole('checkbox', { name: 'Biting tooth 1', exact: true }).check()
  await page.getByRole('button', { name: 'Apply biting teeth', exact: true }).click()
  const publicPage = await context.newPage()
  await publicPage.goto(`/play/jaws-of-risk/${jaw}`)
  await expect(publicPage.getByRole('button', { name: 'Tooth 2', exact: true })).toBeDisabled()
  await expect(publicPage.getByRole('group', { name: 'Biting teeth', exact: true })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Answering team', exact: true }).selectOption({ label: 'Kuning' })
  await submitQuizAnswer(page, false)
  await publicPage.getByRole('button', { name: 'Tooth 2', exact: true }).click()
  await expect(page.locator('.challenge-answer-controls [role="status"]')).toContainText('1 more tooth')
  await publicPage.getByRole('button', { name: 'Tooth 3', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Team answer', exact: true })).toBeEnabled()
  await submitQuizAnswer(page, false)
  for (const screen of [page, publicPage]) await expect(screen.getByRole('button', { name: 'Tooth 1', exact: true })).toBeEnabled()
  await Promise.all([page, publicPage].map((screen) => screen.getByRole('button', { name: 'Tooth 1', exact: true }).dispatchEvent('click')))
  for (const screen of [page, publicPage]) {
    await expect(screen.locator('.crocodile-stage__status')).toContainText('CHOMP!')
    await expect(screen.getByLabel('Challenge scores')).toContainText('Kuning: -25')
    await expect(screen.locator('.crocodile__snap')).toHaveCount(1)
  }
  const database = await readDatabase(page)
  expect(database.exec('SELECT press_count FROM challenge_answer ORDER BY createdAt')[0].values).toEqual([[2], [1]])
  database.close()
  await publicPage.screenshot({ path: 'test-results/gilgamesh-jaw-public-bite.png' })
})
