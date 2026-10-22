import { expect, test } from '@playwright/test'

test('scoreboard shows all teams alphabetically, then ranks and badges after five recorded scores', async ({ page, context }) => {
  const challengeId = '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'
  const alphabetical = ['Biru', 'Hijau', 'Kuning', 'Merah', 'Pink']
  await page.goto(`/admin/scoreboard/${challengeId}`)
  const projector = await context.newPage()
  await projector.goto(`/scoreboard/${challengeId}`)
  const presentation = await context.newPage()
  await presentation.goto('/admin/presentation')
  await presentation.getByRole('button', { name: 'Slide 7: Scoreboard', exact: true }).click()
  await presentation.goto('/')
  const names = (surface: typeof page) => surface.locator('.ranking-score-list .team-pill > span')
  const badges = (surface: typeof page) => surface.locator('.ranking-score-list .ranking-medal')
  for (const surface of [page, projector, presentation]) {
    await expect(names(surface)).toHaveText(alphabetical)
    await expect(surface.getByLabel('Score not entered', { exact: true })).toHaveCount(5)
    await expect(badges(surface)).toHaveCount(0)
  }
  for (const [index, [team, score]] of [['Merah', '100'], ['Pink', '40'], ['Biru', '80'], ['Hijau', '80']].entries()) {
    await page.locator('.grid-form select').selectOption({ label: team })
    await page.locator('.grid-form input[type="number"]').fill(score)
    await page.getByRole('button', { name: 'Add entry', exact: true }).click()
    for (const surface of [page, projector, presentation]) {
      await expect(surface.getByLabel('Score not entered', { exact: true })).toHaveCount(4 - index)
      await expect(names(surface)).toHaveText(alphabetical)
      await expect(badges(surface)).toHaveCount(0)
    }
  }
  await projector.setViewportSize({ width: 1280, height: 720 })
  await projector.screenshot({ path: 'test-results/scoreboard-alphabetical.png' })
  await page.locator('.grid-form select').selectOption({ label: 'Kuning' })
  await page.locator('.grid-form input[type="number"]').fill('0')
  await page.getByRole('button', { name: 'Add entry', exact: true }).click()
  for (const surface of [page, projector, presentation]) {
    await expect(names(surface)).toHaveText(['Merah', 'Biru', 'Hijau', 'Pink', 'Kuning'])
    await expect(surface.getByLabel('Score not entered', { exact: true })).toHaveCount(0)
    await expect(badges(surface)).toHaveCount(5)
    expect(await badges(surface).evaluateAll((images) => images.map((image) => image.getAttribute('alt')))).toEqual(['Rank 1', 'Rank 2', 'Rank 2', 'Rank 3', 'Rank 4'])
  }
  await projector.screenshot({ path: 'test-results/scoreboard-ranked.png' })
  await projector.reload()
  await expect(names(projector)).toHaveText(['Merah', 'Biru', 'Hijau', 'Pink', 'Kuning'])
  await expect(badges(projector)).toHaveCount(5)
  await page.locator('.board__row').filter({ hasText: 'Kuning' }).getByRole('button', { name: 'Edit Score', exact: true }).click()
  await page.locator('.grid-form input[type="number"]').fill('120')
  await page.getByRole('button', { name: 'Update score', exact: true }).click()
  await expect(names(projector)).toHaveText(['Kuning', 'Merah', 'Biru', 'Hijau', 'Pink'])
  await page.locator('.board__row').filter({ hasText: 'Pink' }).getByRole('button', { name: 'Delete', exact: true }).click()
  for (const surface of [page, projector, presentation]) {
    await expect(names(surface)).toHaveText(alphabetical)
    await expect(badges(surface)).toHaveCount(0)
    await expect(surface.getByLabel('Score not entered', { exact: true })).toHaveCount(1)
  }
})
