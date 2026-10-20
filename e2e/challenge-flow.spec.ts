import { test, expect } from '@playwright/test'
const CHALLENGE_GAMES = [{ id: 'emoji-decode', challengeId: '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10' }, { id: 'word-assembly', challengeId: '7c4a2f96-08db-4e15-b3c7-1d9e5a80f463' }, { id: 'jaws-of-risk', challengeId: 'd5e8b317-4c62-49af-8b03-2f7c19a6d5e8' }]

for (const [title, game, count] of [['Image Decode', 'emoji-decode', 11]] as const) {
  test(`${title} final answer opens both scoreboards and rewards stay synchronized`, async ({ page, context }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/admin')
    await page.getByRole('textbox', { name: 'New team name' }).fill('Team A')
    await page.getByRole('button', { name: 'Add team', exact: true }).click()
    await expect(page.getByText('Team A', { exact: true })).toBeVisible()
    await page.goto('/admin/challenges')
    await page.goto(`/admin/play/${game}/${CHALLENGE_GAMES.find((entry) => entry.id === game)!.challengeId}`)
    if (game === 'emoji-decode') {
      const time = Date.now()
      await page.clock.install({ time })
      await page.clock.pauseAt(new Date(time + 1000))
    }
    await page.locator('.run-panel__teams').getByRole('checkbox', { name: 'Team A', exact: true }).check()
    const popupPromise = context.waitForEvent('page')
    await page.getByRole('button', { name: 'Start team run (1)' }).click()
    const projector = await popupPromise
    projector.on('pageerror', (error) => errors.push(error.message))
    await expect(projector).toHaveURL(new RegExp(`/play/${game}/`))
    if (game === 'emoji-decode') {
      await page.clock.runFor(5_000)
      await expect(page.locator('.qa-stage__timer')).toContainText('10s')
      const time = await page.evaluate(() => Date.now())
      await projector.clock.install({ time: time - 1000 })
      await projector.clock.pauseAt(new Date(time))
      await projector.reload()
      await expect(projector.locator('.qa-stage__timer')).toContainText('10s')
      await expect(projector.locator('.qa-stage__hint')).toHaveText('1 Kata')
      await projector.screenshot({ path: 'test-results/image-decode-public.png' })
    }
    for (let number = 1; number <= count; number++) {
      await expect(page.locator('.run-panel__title')).toContainText(`question ${number} of ${count}`)
      if (game === 'emoji-decode' && number === count) {
        await page.clock.runFor(16_000)
      } else {
        const input = page.getByRole('textbox', { name: 'Team A answer' })
        if (game === 'emoji-decode') await input.fill('wrong answer')
        else await page.getByRole('combobox', { name: 'Team A answer' }).selectOption({ index: number % 4 + 1 })
        await page.getByRole('button', { name: 'Grade this question', exact: true }).click()

      }
    }
    await expect(page).toHaveURL(/\/admin\/scoreboard\//)
    await expect(projector).toHaveURL(/\/scoreboard\//)
    await expect(projector.getByRole('list', { name: 'Challenge ranking' }).filter({hasText:'Team A'})).toContainText('Team A')
    await page.getByRole('button', { name: 'Claim Rewards', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/rewards\//)
    await expect(projector).toHaveURL(/\/rewards\//)
    await expect(projector.locator('.reward-stage__rows')).toContainText('Team A')
    await expect(page.getByRole('button', { name: 'Rewards', exact: true })).toHaveCount(0)
    await projector.reload()
    await expect(projector.locator('.reward-stage__rows')).toContainText('Team A')
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
  await page.goto(`/admin/scoreboard/${CHALLENGE_GAMES[0].challengeId}`)
  for (const [index, name] of ['A', 'B', 'C', 'D', 'E'].entries()) {
    await page.locator('.grid-form select').selectOption({ label: name })
    await page.locator('.grid-form input[type="number"]').fill(String(50 - index * 10))
    await page.getByRole('button', { name: 'Add entry' }).click()
    await expect(page.locator('.board__row')).toHaveCount(index + 1)
  }
  const scoreboard = page.url()
  const projector = await context.newPage()
  await projector.goto(scoreboard.replace('/admin/', '/'))
  await expect(projector.getByRole('list', { name: 'Challenge ranking' })).toContainText('A')
  await page.getByRole('button', { name: 'Claim Rewards', exact: true }).click()
  await expect(projector).toHaveURL(/\/rewards\//)
  for (const [name, count] of [['A', 3], ['B', 2], ['C', 2], ['D', 1], ['E', 0]] as const) {
    const row = page.getByRole('listitem', { name, exact: true })
    await expect(row.locator('.reward-stage__card')).toHaveCount(count)
    await expect(projector.getByRole('listitem', { name, exact: true }).locator('.reward-stage__card')).toHaveCount(count)
    if (count) {
      const sources = await row.locator('.card-art img').evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src))
      expect(new Set(sources).size).toBe(count)
    }
  }
  const before = await page.locator('.reward-stage__card .card-art img').evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src))
  await projector.screenshot({ path: 'test-results/rewards-slide-02-public.png' })
  await page.screenshot({ path: 'test-results/rewards-slide-02-admin.png', fullPage: true })
  await page.goto(scoreboard)
  await page.getByRole('button', { name: 'Claim Rewards', exact: true }).click()
  await expect(page.getByRole('listitem', { name: 'A', exact: true }).locator('.reward-stage__card')).toHaveCount(3)
  const after = await page.locator('.reward-stage__card .card-art img').evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src))
  expect(after).toEqual(before)
  await expect(page.locator('a[href*="/cards"]')).toHaveCount(0)
  for (const removed of ['/cards', '/cards/example', '/admin/cards', '/admin/cards/example']) {
    await page.goto(removed)
    await expect(page).toHaveURL(/\/scoreboard$/)
  }
})


test('wrong answers still pass to the next team and early End run cancels both screens', async ({ page, context }) => {
  await page.goto('/admin')
  for (const name of ['Alpha', 'Beta']) {
    await page.getByRole('textbox', { name: 'New team name' }).fill(name)
    await page.getByRole('button', { name: 'Add team', exact: true }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
  await page.goto('/admin/challenges')
  await page.goto(`/admin/play/emoji-decode/${CHALLENGE_GAMES[0].challengeId}`)
  await expect(page.locator('.run-panel__teams').getByRole('checkbox')).toHaveCount(7)
  for (const name of ['Alpha', 'Beta']) await page.locator('.run-panel__teams').getByRole('checkbox', { name, exact: true }).check()
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
