import { submitQuizAnswer } from './support/challengeAnswer'
import { prepareToothPress } from './support/challengeAnswer'
import { expect, test } from '@playwright/test'

const flipping = '7c4a2f96-08db-4e15-b3c7-1d9e5a80f463'
const jaw = 'd5e8b317-4c62-49af-8b03-2f7c19a6d5e8'

test('Flipping Connect stays open after the former deadline and reload', async ({ page }) => {
  await page.goto(`/admin/play/word-assembly/${flipping}`)
  await expect(page.getByRole('checkbox', { name: 'Biru', exact: true })).toBeVisible()
  await page.clock.install()
  await page.getByRole('checkbox', { name: 'Biru', exact: true }).check()
  await page.getByRole('button', { name: 'Start team run (1)' }).click()
  await submitQuizAnswer(page, true)
  await expect(page.locator('.tile').first()).toBeDisabled()
  await page.clock.runFor(30000)
  await expect(page.getByRole('timer')).toHaveCount(0)
  await page.locator('.tile[data-pair="word-1"]').nth(0).click()
  await page.locator('.tile[data-pair="word-1"]').nth(1).click()
  await expect(page.getByLabel('Challenge scores')).toContainText('Biru: 15')
  await page.reload()
  await expect(page.locator('.tile[data-pair="word-2"]').first()).toBeEnabled()
  await expect(page.getByRole('timer')).toHaveCount(0)
})

test('Jaw of Risk admin selects multiple hidden biting teeth that persist across bites and reloads', async ({ page, context }) => {
  await page.goto(`/admin/play/jaws-of-risk/${jaw}`)
  const settings = page.getByRole('group', { name: 'Biting teeth', exact: true })
  await expect(settings).toBeVisible()
  const time = new Date()
  await page.clock.install({ time })
  await page.clock.pauseAt(new Date(time.getTime() + 1000))
  for (const checkbox of await settings.getByRole('checkbox').all()) await checkbox.uncheck()
  await expect(page.getByRole('button', { name: 'Apply biting teeth', exact: true })).toBeDisabled()
  for (const tooth of [2, 5]) await settings.getByRole('checkbox', { name: `Biting tooth ${tooth}`, exact: true }).check()
  await page.getByRole('button', { name: 'Apply biting teeth', exact: true }).click()
  const projector = await context.newPage()
  await projector.goto(`/play/jaws-of-risk/${jaw}`)
  await expect(projector.getByRole('group', { name: 'Biting teeth', exact: true })).toHaveCount(0)
  await prepareToothPress(page)

  await page.getByRole('button', { name: 'Tooth 3', exact: true }).click()
  await expect(projector.locator('.crocodile-stage__status')).toHaveText('Safe! Press the next tooth.')
  await prepareToothPress(page)

  await page.getByRole('button', { name: 'Tooth 2', exact: true }).click()
  await expect(projector.locator('.crocodile-stage__status')).toContainText('CHOMP!')
  await expect(page.getByRole('button', { name: 'Apply biting teeth', exact: true })).toBeDisabled()
  await page.clock.runFor(4440)
  await expect(projector.locator('.crocodile-stage__status')).toHaveText('Which tooth will bite?')
  // The first press after the mouth opens must work, with no extra delay or retry.
  await prepareToothPress(page)

  await page.getByRole('button', { name: 'Tooth 3', exact: true }).click({ timeout: 1000 })
  await expect(projector.locator('.crocodile-stage__status')).toHaveText('Safe! Press the next tooth.')
  await page.reload()
  await expect(settings).toContainText('Current mode: Selected teeth 2, 5')
  for (const tooth of [2, 5]) await expect(settings.getByRole('checkbox', { name: `Biting tooth ${tooth}`, exact: true })).toBeChecked()
  await prepareToothPress(page)

  await page.getByRole('button', { name: 'Tooth 5', exact: true }).click()
  await expect(projector.locator('.crocodile-stage__status')).toContainText('CHOMP!')
  await projector.reload()
  await expect(projector.locator('.crocodile-stage__status')).toContainText('CHOMP!')
  await page.clock.runFor(4440)
  await expect(page.getByRole('button', { name: 'Use random tooth', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Use random tooth', exact: true }).click()
  await expect(settings).toContainText('Current mode: Random tooth')
})
