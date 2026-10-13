import { test, expect } from '@playwright/test'

for (const [title, game, count] of [['Image Decode', 'emoji-decode', 11], ['Flipping Card', 'word-assembly', 21], ['Jaw of Risk', 'jaws-of-risk', 20]] as const) {
  test(`${title} final answer opens both scoreboards and rewards stay synchronized`, async ({ page, context }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/admin')
    await page.getByRole('textbox', { name: 'New team name' }).fill('Team A')
    await page.getByRole('button', { name: 'Add team', exact: true }).click()
    await expect(page.getByText('Team A', { exact: true })).toBeVisible()
    await page.goto('/admin/challenges')
    await page.locator('.card--locked', { hasText: title }).getByRole('button', { name: 'Play', exact: true }).click()
    if (game === 'emoji-decode' || game === 'word-assembly') await page.clock.install()
    await page.locator('.run-panel__teams').getByRole('checkbox').check()
    const popupPromise = context.waitForEvent('page')
    await page.getByRole('button', { name: 'Start team run (1)' }).click()
    const projector = await popupPromise
    projector.on('pageerror', (error) => errors.push(error.message))
    await expect(projector).toHaveURL(new RegExp(`/play/${game}/`))
    if (game === 'emoji-decode') {
      await page.clock.runFor(5_000)
      await expect(page.locator('.qa-stage__timer')).toContainText('10s')
      await projector.clock.install({ time: await page.evaluate(() => Date.now()) })
      await projector.reload()
      await expect(projector.locator('.qa-stage__timer')).toContainText('10s')
      await expect(projector.locator('.qa-stage__hint')).toHaveText('1 Kata')
      await projector.screenshot({ path: 'test-results/image-decode-public.png' })
    }
    for (let number = 1; number <= count; number++) {
      await expect(page.locator('.run-panel__title')).toContainText(`question ${number} of ${count}`)
      if (game === 'word-assembly') {
        await expect(page.getByRole('combobox', { name: 'Team A answer' })).toHaveCount(0)
        const pair = page.locator(`.tile[data-pair="word-${(number - 1) % 10 + 1}"]`)
        await pair.nth(0).click()
        await pair.nth(1).click()
        await page.clock.runFor(5_000)
        await page.getByRole('button', { name: 'Answer myself', exact: true }).click()
        await expect(projector.getByRole('list', { name: 'Answer choices' })).toBeVisible()
      }
      if (game === 'jaws-of-risk' && number === 1) {
        await expect(projector.getByRole('list', { name: 'Answer choices' })).toBeVisible()
        await projector.screenshot({ path: 'test-results/jaw-of-risk-question.png' })
      }
      if (game === 'word-assembly' && number === 17) await projector.screenshot({ path: 'test-results/flipping-card-long-question.png' })
      if (game === 'emoji-decode' && number === count) {
        await page.clock.runFor(16_000)
      } else {
        const input = page.getByRole('textbox', { name: 'Team A answer' })
        if (game === 'emoji-decode') await input.fill('wrong answer')
        else await page.getByRole('combobox', { name: 'Team A answer' }).selectOption({ index: number % 4 + 1 })
        await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
        if (game === 'word-assembly' && await page.getByText('Answer attempts: 1/2', { exact: true }).isVisible()) {
          await page.getByRole('combobox', { name: 'Team A answer' }).selectOption({ index: number % 4 + 1 })
          await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
        }
      }
    }
    await expect(page).toHaveURL(/\/admin\/scoreboard\//)
    await expect(projector).toHaveURL(/\/scoreboard\//)
    await expect(projector.getByRole('table', { name: 'Challenge ranking' })).toContainText('Team A')
    await page.getByRole('button', { name: 'Claim Rewards', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/rewards\//)
    await expect(projector).toHaveURL(/\/rewards\//)
    await expect(projector.locator('.reward-stage__rows')).toContainText('Team A')
    await page.getByRole('button', { name: 'Rewards', exact: true }).first().click()
    await expect(page).toHaveURL(/\/admin\/cards\//)
    await expect(projector).toHaveURL(/\/cards\//)
    await expect(projector.getByRole('tab', { name: 'Team A', exact: true })).toBeVisible()
    await projector.reload()
    await expect(projector.getByRole('tab', { name: 'Team A', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('Claim Rewards draws once and reveals unique cards for five teams', async ({ page, context }) => {
  await page.goto('/admin')
  for (const name of ['A', 'B', 'C', 'D', 'E']) {
    await page.getByRole('textbox', { name: 'New team name' }).fill(name)
    await page.getByRole('button', { name: 'Add team', exact: true }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
  await page.goto('/admin/challenges')
  await page.locator('.card--locked', { hasText: 'Image Decode' }).getByRole('button', { name: 'Scoreboard', exact: true }).click()
  for (const [index, name] of ['A', 'B', 'C', 'D', 'E'].entries()) {
    await page.locator('.grid-form select').selectOption({ label: name })
    await page.locator('.grid-form input[type="number"]').fill(String(50 - index * 10))
    await page.getByRole('button', { name: 'Add entry' }).click()
    await expect(page.locator('.board__row')).toHaveCount(index + 1)
  }
  const scoreboard = page.url()
  const projector = await context.newPage()
  await projector.goto(scoreboard.replace('/admin/', '/'))
  await expect(projector.getByRole('table', { name: 'Challenge ranking' })).toContainText('A')
  await page.getByRole('button', { name: 'Claim Rewards', exact: true }).click()
  await expect(projector).toHaveURL(/\/rewards\//)
  await page.getByRole('button', { name: 'Rewards', exact: true }).first().click()
  await expect(projector).toHaveURL(/\/cards\//)
  for (const [name, count] of [['A', 3], ['B', 2], ['C', 2], ['D', 1], ['E', 0]] as const) {
    await page.getByRole('tab', { name, exact: true }).click()
    await expect(page.locator('.reward-stage__card')).toHaveCount(count)
    if (count) {
      await page.getByRole('button', { name: 'Buka semua' }).click()
      await expect(page.locator('.reward-stage__card .card-art img')).toHaveCount(count)
      const sources = await page.locator('.reward-stage__card .card-art img').evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src))
      expect(new Set(sources).size).toBe(count)
    }
  }
  await page.goto(scoreboard)
  await page.getByRole('button', { name: 'Claim Rewards', exact: true }).click()
  await page.getByRole('button', { name: 'Rewards', exact: true }).first().click()
  await page.getByRole('tab', { name: 'A', exact: true }).click()
  await expect(page.locator('.reward-stage__card')).toHaveCount(3)
})


test('wrong answers still pass to the next team and early End run cancels both screens', async ({ page, context }) => {
  await page.goto('/admin')
  for (const name of ['Alpha', 'Beta']) {
    await page.getByRole('textbox', { name: 'New team name' }).fill(name)
    await page.getByRole('button', { name: 'Add team', exact: true }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
  await page.goto('/admin/challenges')
  await page.locator('.card--locked', { hasText: 'Image Decode' }).getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('.run-panel__teams').getByRole('checkbox')).toHaveCount(2)
  for (const checkbox of await page.locator('.run-panel__teams').getByRole('checkbox').all()) await checkbox.check()
  const popupPromise = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Start team run (2)' }).click()
  const projector = await popupPromise
  const firstAnswer = page.locator('.run-panel__answers input[type="text"]:enabled')
  const firstName = await firstAnswer.getAttribute('aria-label')
  await firstAnswer.fill('wrong')
  await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
  await expect(page.locator('.run-panel__title')).toContainText('question 1 of 11')
  await expect(page.locator('.run-panel__answers input[type="text"]:enabled')).not.toHaveAttribute('aria-label', firstName!)
  await page.locator('.run-panel__answers input[type="text"]:enabled').fill('wrong')
  await page.getByRole('button', { name: 'Next team answer', exact: true }).click()
  await expect(page.locator('.run-panel__title')).toContainText('question 2 of 11')
  await page.getByRole('button', { name: 'End run', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start team run (2)' })).toBeVisible()
  await expect(projector.getByRole('status').filter({ hasText: 'Menunggu tantangan dimulai' })).toBeVisible()
})
