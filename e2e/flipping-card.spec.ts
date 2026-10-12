import { test, expect } from '@playwright/test'
import reference from '../src/data/reference-question-bank.json' with { type: 'json' }

test('roulette matching turns, timer, given questions and two attempts synchronize with the projector', async ({ page, context }) => {
  await page.goto('/admin')
  for (const name of ['Alpha', 'Beta', 'Gamma']) {
    await page.getByRole('textbox', { name: 'New team name' }).fill(name)
    await page.getByRole('button', { name: 'Add team', exact: true }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
  await page.goto('/admin/challenges')
  await page.locator('.card--locked', { hasText: 'Flipping Card' }).getByRole('button', { name: 'Play', exact: true }).click()
  const time = new Date()
  await page.clock.install({ time })
  await page.clock.pauseAt(time)
  for (const checkbox of await page.locator('.run-panel__teams').getByRole('checkbox').all()) await checkbox.check()
  const popupPromise = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Start team run (3)' }).click()
  const projector = await popupPromise
  await projector.clock.install({ time })
  await projector.clock.pauseAt(time)
  const order = await page.getByRole('list', { name: 'Roulette turn order' }).locator('li').allTextContents()
  expect([...order].sort()).toEqual(['Alpha', 'Beta', 'Gamma'])
  const active = page.getByRole('list', { name: 'Roulette turn order' }).locator('[aria-current]')
  await expect(active).toHaveText(order[0])
  await expect(page.getByRole('timer', { name: 'Matching time remaining' })).toHaveText('20s')
  await expect(projector.getByRole('timer')).toContainText('20s')
  await expect(projector.getByRole('list', { name: 'Answer choices' })).toHaveCount(0)
  await projector.screenshot({ path: 'test-results/flipping-card-matching.png' })

  // A mismatch flips back and hands the matching board to the next roulette team.
  await page.locator('.tile[data-pair="word-1"]').first().click()
  await page.locator('.tile[data-pair="word-2"]').first().click()
  await page.clock.runFor(1000)
  await expect(active).toHaveText(order[1])
  await expect(projector.getByRole('list', { name: 'Roulette turn order' }).locator('[aria-current]')).toHaveText(order[1])
  await expect(page.locator('.tile--revealed')).toHaveCount(0)
  await expect(page.locator('.run-panel__title')).toContainText('question 1 of 21')

  // Twenty seconds expires the matching turn, without revealing or skipping a question.
  await page.locator('.tile[data-pair="word-3"]').first().click()
  await page.clock.runFor(20000)
  await expect(active).toHaveText(order[2])
  await expect(page.locator('.tile--revealed')).toHaveCount(0)
  await expect(page.getByRole('timer', { name: 'Matching time remaining' })).toHaveText('20s')

  await page.locator('.tile[data-pair="word-1"]').nth(0).click()
  await page.locator('.tile[data-pair="word-1"]').nth(1).click()
  await expect(page.getByRole('button', { name: 'Answer myself', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: `${order[2]} answer` })).toHaveCount(0)
  await expect(projector.getByRole('list', { name: 'Answer choices' })).toBeVisible()
  const boxes = await projector.getByRole('list', { name: 'Answer choices' }).locator('li').evaluateAll((items) =>
    items.map((item) => { const rect = item.getBoundingClientRect(); return { x: rect.x, y: rect.y } }))
  expect(boxes[0].x).toBe(boxes[1].x)
  expect(boxes[2].x).toBe(boxes[3].x)
  expect(boxes[2].x).toBeGreaterThan(boxes[0].x)
  expect(boxes[1].y).toBeGreaterThan(boxes[0].y)
  await projector.screenshot({ path: 'test-results/flipping-card-question.png' })

  // Giving is committed before the recipient answers, and survives a projector reload.
  await page.getByRole('combobox', { name: 'Opponent team' }).selectOption({ label: order[0] })
  await page.getByRole('button', { name: 'Give question', exact: true }).click()
  const answer = page.getByRole('combobox', { name: `${order[0]} answer` })
  await expect(answer).toBeEnabled()
  await projector.reload()
  await expect(projector.locator('.qa-stage__heading')).toContainText(order[0])
  await answer.selectOption(reference.matchCard[0].options.find((option) => option !== reference.matchCard[0].answer)!)
  await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
  await expect(page.getByText('Answer attempts: 1/2', { exact: true })).toBeVisible()
  await expect(answer).toBeEnabled()
  await answer.selectOption(reference.matchCard[0].answer)
  await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
  await expect(page.locator('.run-panel__title')).toContainText('question 2 of 21')
  await expect(active).toHaveText(order[0])
  await expect(projector.getByRole('list', { name: 'Answer choices' })).toHaveCount(0)
  await page.getByRole('button', { name: 'End run', exact: true }).click()
  await expect(projector.getByText('Menunggu tantangan dimulai…')).toBeVisible()
})


test('five teams answer the same unlocked question, including the giver, before returning to matching', async ({ page, context }) => {
  await page.goto('/admin')
  for (const name of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']) {
    await page.getByRole('textbox', { name: 'New team name' }).fill(name)
    await page.getByRole('button', { name: 'Add team', exact: true }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
  await page.goto('/admin/challenges')
  await page.locator('.card--locked', { hasText: 'Flipping Card' }).getByRole('button', { name: 'Play', exact: true }).click()
  const time = new Date()
  await page.clock.install({ time })
  await page.clock.pauseAt(time)
  for (const checkbox of await page.locator('.run-panel__teams').getByRole('checkbox').all()) await checkbox.check()
  const popupPromise = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Start team run (5)' }).click()
  const projector = await popupPromise
  const order = await page.getByRole('list', { name: 'Roulette turn order' }).locator('li').allTextContents()
  await page.locator('.tile[data-pair="word-1"]').nth(0).click()
  await page.locator('.tile[data-pair="word-1"]').nth(1).click()
  await page.getByRole('combobox', { name: 'Opponent team' }).selectOption({ label: order[1] })
  await page.getByRole('button', { name: 'Give question', exact: true }).click()
  const wrong = reference.matchCard[0].options.find((option) => option !== reference.matchCard[0].answer)!
  for (const name of [...order.slice(1), order[0]]) {
    await expect(page.locator('.run-panel__title')).toContainText('question 1 of 21')
    await expect(projector.getByRole('list', { name: 'Answer choices' })).toBeVisible()
    const answer = page.getByRole('combobox', { name: `${name} answer` })
    await expect(answer).toBeEnabled()
    for (let attempt = 0; attempt < 2; attempt++) {
      await answer.selectOption(wrong)
      await page.getByRole('button', { name: /^(Grade this question|Next team answer)$/ }).click()
    }
  }
  await expect(page.locator('.run-panel__title')).toContainText('question 2 of 21')
  await expect(projector.getByRole('list', { name: 'Answer choices' })).toHaveCount(0)
  await page.locator('.tile[data-pair="word-2"]').nth(0).click()
  await page.locator('.tile[data-pair="word-2"]').nth(1).click()
  await page.getByRole('button', { name: 'Answer myself', exact: true }).click()
  await page.getByRole('combobox', { name: `${order[1]} answer` }).selectOption(reference.matchCard[1].answer)
  await page.getByRole('button', { name: /^(Grade this question|Next team answer)$/ }).click()
  await expect(page.locator('.run-panel__title')).toContainText('question 3 of 21')
  await expect(page.getByRole('timer', { name: 'Matching time remaining' })).toHaveText('20s')
  await expect(projector.getByRole('list', { name: 'Answer choices' })).toHaveCount(0)
})
