import { expect, test } from '@playwright/test'

test('Timer and Flipping Connect follow Turn Order live, during a run and after reload', async ({ page, context }) => {
  await page.goto('/admin/turn-order')
  const rows = page.locator('.turn-order-item button')
  await expect(rows).toHaveCount(5)
  const initial = await rows.allTextContents()
  const timerAdmin = await context.newPage()
  await timerAdmin.goto('/admin/timer')
  const timerPublic = await context.newPage()
  await timerPublic.goto('/timer')
  const flipping = await context.newPage()
  await flipping.goto('/admin/play/word-assembly/7c4a2f96-08db-4e15-b3c7-1d9e5a80f463')
  const waiting = await context.newPage()
  await waiting.goto('/play/word-assembly/7c4a2f96-08db-4e15-b3c7-1d9e5a80f463')

  async function expectOrder(names: string[]) {
    for (const screen of [timerAdmin, timerPublic]) await expect(screen.locator('.event-timer__team .team-pill')).toHaveText(names)
    await expect(waiting.locator('.flipping-presentation__teams li:not([aria-hidden]) .flipping-presentation__team-name')).toHaveText(names)
  }
  await expectOrder(initial)
  await page.evaluate(() => { Math.random = () => 0 })
  await page.getByRole('button', { name: 'Shuffle Order', exact: true }).click()
  const shuffled = await rows.allTextContents()
  expect(shuffled).not.toEqual(initial)
  await expectOrder(shuffled)
  for (const screen of [timerAdmin, timerPublic]) await expect(screen.locator('.event-timer__team[aria-current] .team-pill')).toHaveText(shuffled[0])
  await expect(waiting.locator('.flipping-presentation__teams [aria-current] .flipping-presentation__team-name')).toHaveText(shuffled[0])

  const selected = ['Biru', 'Kuning', 'Pink']
  for (const name of selected) await flipping.getByRole('checkbox', { name, exact: true }).check()
  await flipping.getByRole('button', { name: 'Start team run (3)' }).click()
  for (const screen of [flipping, waiting]) await expect(screen.locator('.flipping-presentation__teams li:not([aria-hidden]) .flipping-presentation__team-name')).toHaveText(shuffled.filter((name) => selected.includes(name)))
  await page.getByRole('button', { name: 'Reset order', exact: true }).click()
  for (const screen of [timerAdmin, timerPublic]) await expect(screen.locator('.event-timer__team .team-pill')).toHaveText(initial)
  for (const screen of [flipping, waiting]) {
    await expect(screen.locator('.flipping-presentation__teams li:not([aria-hidden]) .flipping-presentation__team-name')).toHaveText(initial.filter((name) => selected.includes(name)))
    await expect(screen.locator('.flipping-presentation__teams [aria-current] .flipping-presentation__team-name')).toHaveText(initial[0])
    await screen.reload()
    await expect(screen.locator('.flipping-presentation__teams li:not([aria-hidden]) .flipping-presentation__team-name')).toHaveText(initial.filter((name) => selected.includes(name)))
    await expect(screen.locator('.flipping-presentation__teams [aria-current] .flipping-presentation__team-name')).toHaveText(initial[0])
  }
  await timerPublic.reload()
  await expect(timerPublic.locator('.event-timer__team .team-pill')).toHaveText(initial)
})

test('Shuffle Order moves team names while numbered slots stay fixed and sync to the public display', async ({page,context}) => {
  await page.goto('/admin/turn-order')
  const rows = page.locator('.turn-order-item')
  await expect(rows).toHaveCount(5)
  const original = await rows.locator('button').allTextContents()
  await expect(rows.locator('.turn-order-number')).toHaveText(['1','2','3','4','5'])
  const projector = await context.newPage()
  await projector.goto('/turn-order')
  await expect(projector.locator('.turn-order-item')).toHaveCount(5)
  const publicShuffle = projector.getByRole('button', { name: 'Shuffle Order', exact: true })
  await expect(publicShuffle).toBeDisabled()
  await expect(projector.locator('.turn-order-item button:enabled')).toHaveCount(0)
  const saved = await projector.evaluate(() => localStorage.getItem('guard-the-heart-turn-order'))
  // Even a programmatic click on disabled public controls cannot write an order.
  await publicShuffle.evaluate((button: HTMLButtonElement) => button.click())
  await projector.locator('.turn-order-item button').first().evaluate((button: HTMLButtonElement) => button.click())
  expect(await projector.evaluate(() => localStorage.getItem('guard-the-heart-turn-order'))).toBe(saved)
  await page.evaluate(()=>{Math.random=()=>0})
  await page.getByRole('button',{name:'Shuffle Order',exact:true}).click()
  const shuffled = [...original.slice(1),original[0]]
  await expect(rows.locator('button')).toHaveText(shuffled)
  await expect(rows.locator('.turn-order-number')).toHaveText(['1','2','3','4','5'])
  await expect(projector.locator('.turn-order-item button')).toHaveText(shuffled)
  for (const screen of [page, projector]) {
    const first = screen.locator('.turn-order-item').first()
    await expect(first).toHaveAttribute('aria-current', 'step')
    await expect(first.locator('.turn-order-turn')).toHaveText('Your Turn')
    await expect(screen.locator('.turn-order-turn')).toHaveCount(1)
    const name = (await first.getByRole('button').boundingBox())!
    const badge = (await first.locator('.turn-order-turn').boundingBox())!
    expect(badge.x).toBeGreaterThan(name.x + name.width)
  }
  await page.reload()
  await expect(rows.locator('button')).toHaveText(shuffled)
  await rows.last().getByRole('button').click()
  await page.getByRole('button',{name:'Reset order',exact:true}).click()
  await expect(rows.locator('button')).toHaveText(original)
  await expect(rows.locator('.turn-order-number')).toHaveText(['1','2','3','4','5'])
  for (const screen of [page, projector]) {
    const first = screen.locator('.turn-order-item').first()
    await expect(first).toHaveAttribute('aria-current', 'step')
    await expect(first.locator('.turn-order-turn')).toHaveText('Your Turn')
    await expect(screen.locator('.turn-order-turn')).toHaveCount(1)
    const name = (await first.getByRole('button').boundingBox())!
    const badge = (await first.locator('.turn-order-turn').boundingBox())!
    expect(badge.x).toBeGreaterThan(name.x + name.width)
    await screen.reload()
    await expect(first).toHaveAttribute('aria-current', 'step')
  }
})

test('selecting a turn preserves shuffled order and synchronizes Your Turn with Timer', async ({ page, context }) => {
  await page.goto('/admin/turn-order')
  const rows = page.locator('.turn-order-item')
  await expect(rows).toHaveCount(5)
  await page.evaluate(() => { Math.random = () => 0 })
  await page.getByRole('button', { name: 'Shuffle Order', exact: true }).click()
  const order = await rows.locator('button').allTextContents()
  const saved = await page.evaluate(() => localStorage.getItem('guard-the-heart-turn-order'))
  const projector = await context.newPage()
  await projector.goto('/turn-order')
  const timer = await context.newPage()
  await timer.goto('/admin/timer')
  await timer.getByRole('button', { name: 'Start timer', exact: true }).click()
  const timerBefore = await timer.evaluate(() => JSON.parse(localStorage.getItem('guard-the-heart-presentation-timer-v2')!))

  for (const slot of [3, 1, 1]) {
    await rows.nth(slot).getByRole('button').click()
    await expect(rows.locator('button')).toHaveText(order)
    await expect(rows.locator('.turn-order-number')).toHaveText(['1', '2', '3', '4', '5'])
    await expect(page.locator('.turn-order-turn')).toHaveText('Your Turn')
    await expect(rows.nth(slot)).toHaveAttribute('aria-current', 'step')
    await expect(projector.locator('.turn-order-item[aria-current]')).toContainText(order[slot])
    await expect(timer.locator('.event-timer__team[aria-current]')).toContainText(order[slot])
    await expect(timer.locator('.event-timer__turn')).toHaveText('Your Turn')
    expect(await page.evaluate(() => localStorage.getItem('guard-the-heart-turn-order'))).toBe(saved)
    const timerAfter = await timer.evaluate(() => JSON.parse(localStorage.getItem('guard-the-heart-presentation-timer-v2')!))
    expect(timerAfter).toMatchObject({ deadline: timerBefore.deadline, duration: timerBefore.duration, remaining: timerBefore.remaining })
  }

  for (const width of [1280, 390]) {
    await projector.setViewportSize({ width, height: 844 })
    const active = projector.locator('.turn-order-item[aria-current]')
    const team = (await active.getByRole('button').boundingBox())!
    const badge = (await active.locator('.turn-order-turn').boundingBox())!
    const stage = (await projector.locator('.turn-order-stage').boundingBox())!
    expect(badge.x).toBeGreaterThan(team.x + team.width)
    expect(badge.x + badge.width).toBeLessThan(stage.x + stage.width)
    await projector.screenshot({ path: `test-results/turn-order-giliran-${width}.png` })
  }
  await page.reload()
  await expect(rows.locator('button')).toHaveText(order)
  await expect(rows.nth(1)).toHaveAttribute('aria-current', 'step')
  await timer.goto('/timer')
  await expect(timer.locator('.event-timer__team[aria-current]')).toContainText(order[1])
  await expect(timer.locator('.event-timer__turn')).toBeVisible()
  for (const action of ['Shuffle Order', 'Reset order']) {
    await page.getByRole('button', { name: action, exact: true }).click()
    const first = await rows.first().getByRole('button').textContent()
    await expect(rows.first()).toHaveAttribute('aria-current', 'step')
    await expect(timer.locator('.event-timer__team[aria-current]')).toContainText(first!)
    const timerAfter = await timer.evaluate(() => JSON.parse(localStorage.getItem('guard-the-heart-presentation-timer-v2')!))
    expect(timerAfter).toMatchObject({ deadline: timerBefore.deadline, duration: timerBefore.duration, remaining: timerBefore.remaining })
  }
})
