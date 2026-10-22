import { test, expect } from '@playwright/test'

test('team changes replay preview, both mismatched cards appear briefly and matches stay open on both screens', async ({ page, context }) => {
  await page.goto('/admin')
  for (const name of ['Alpha', 'Beta']) {
    await page.getByRole('textbox', { name: 'New team name' }).fill(name)
    await page.getByRole('button', { name: 'Add team', exact: true }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
  await page.goto('/admin/challenges')
  await expect(page.locator('.card--locked')).toHaveCount(3)
  const popup = context.waitForEvent('page')
  await page.locator('li').filter({ hasText: 'Challenge 2 - Flipping Connect' }).getByRole('button', { name: 'Play', exact: true }).click()
  const projector = await popup
  await expect(projector.locator('.flipping-presentation')).toBeVisible()
  await expect(projector.getByText('Challenge 2 - Flipping Connect', { exact: true })).toHaveCount(0)
  const pagesBefore = context.pages().length
  const time = new Date()
  await page.clock.install({ time })
  await page.clock.pauseAt(new Date(time.getTime() + 1000))
  await projector.clock.install({time})
  await projector.clock.pauseAt(new Date(time.getTime() + 1000))
  for (const name of ['Alpha', 'Beta']) await page.locator('.run-panel__teams').getByRole('checkbox', { name, exact: true }).check()
  await page.getByRole('button', { name: 'Start team run (2)' }).click()
  expect(context.pages()).toHaveLength(pagesBefore)
  for (const screen of [page, projector]) {
    await expect(screen.locator('.tile--revealed')).toHaveCount(20)
    await expect(screen.getByRole('timer', {name:'Cards preview countdown'})).toContainText('5s')
    await expect(screen.locator('.tile--matched')).toHaveCount(0)
    await expect(screen.locator('.flipping-presentation__feedback b')).toHaveText('Cards!')
  }
  await expect(page.locator('.tile').first()).toBeDisabled()
  for (const screen of [page,projector]) {
    for (const viewport of [{width:1366,height:768},{width:768,height:1024},{width:390,height:844}]) {
      await screen.setViewportSize(viewport)
      const stage = (await screen.locator('.flipping-presentation').boundingBox())!
      const teams = (await screen.locator('.flipping-presentation__teams').boundingBox())!
      const turn = (await screen.locator('.flipping-presentation__turn').boundingBox())!
      const preview = (await screen.getByRole('timer',{name:'Cards preview countdown'}).boundingBox())!
      expect(teams.y).toBeLessThan(stage.y + stage.height * .065)
      expect(preview.y).toBeGreaterThanOrEqual(stage.y)
      expect(preview.y + preview.height).toBeLessThan(teams.y)
      expect(turn.y - teams.y - teams.height).toBeGreaterThan(stage.width * .005)
      expect(turn.y + turn.height).toBeLessThan(stage.y + stage.height * .18)
      const feedback = (await screen.locator('.flipping-presentation__feedback').boundingBox())!
      const firstCard = (await screen.locator('.tile').first().boundingBox())!
      expect(feedback.x).toBeGreaterThanOrEqual(stage.x)
      expect(feedback.x + feedback.width).toBeLessThan(firstCard.x)
      await expect(screen.locator('.flipping-presentation__feedback')).toHaveCSS('pointer-events', 'none')
      const panels = await screen.locator('.flipping-presentation__teams li').evaluateAll((items) => items.map((item) => { const box=item.getBoundingClientRect();return {left:box.left,right:box.right} }))
      for (let index=1;index<panels.length;index++) expect(panels[index].left-panels[index-1].right).toBeGreaterThan(stage.width * .008)
    }
    await screen.setViewportSize({width:1280,height:720})
  }
  await projector.screenshot({path:'test-results/flipping-initial-preview.png'})
  await page.clock.runFor(1000)
  await page.reload()
  await projector.reload()
  for (const screen of [page, projector]) {
    await expect(screen.getByRole('timer', {name:'Cards preview countdown'})).toContainText('4s')
    await expect(screen.locator('.tile--revealed')).toHaveCount(20)
  }
  await page.clock.runFor(3999)
  await expect(page.locator('.tile--revealed')).toHaveCount(20)
  await page.clock.runFor(1)
  for (const screen of [page, projector]) {
    await expect(screen.locator('.tile--revealed')).toHaveCount(0)
    await expect(screen.getByRole('timer', {name:'Cards preview countdown'})).toHaveCount(0)
  }
  await expect(page.locator('.tile').first()).toBeEnabled()

  await expect(projector.locator('.flipping-presentation__art')).toHaveAttribute('src', '/ui/flipping-slide-03-reference.png')
  const stage = await projector.locator('.flipping-presentation').boundingBox()
  const firstCard = await projector.locator('.tile').first().boundingBox()
  expect(stage).not.toBeNull()
  expect(firstCard).not.toBeNull()
  expect(Math.abs(firstCard!.x - stage!.x - stage!.width * .126)).toBeLessThan(1)
  expect(Math.abs(firstCard!.width - stage!.width * .132)).toBeLessThan(1)
  await expect(projector.locator('.tile').first()).toHaveCSS('background-image', 'none')
  await projector.screenshot({ path: 'test-results/flipping-slide-03.png' })
  const order = await page.getByRole('list', { name: 'Select the active team' }).locator('li:not([aria-hidden]) .flipping-presentation__team-name').allTextContents()
  await expect(page.locator('.flipping-presentation__team-gp')).toHaveText(['5 GP', '5 GP'])
  await expect(projector.locator('.flipping-presentation__team-gp')).toHaveText(['5 GP', '5 GP'])
  const active = page.locator('.flipping-presentation__teams [aria-current]')
  await expect(active).toContainText(order[0]!)
  await expect(page.getByRole('timer')).toHaveCount(0)
  await expect(page.getByText(/Matched pairs:.*s$/)).toHaveCount(0)
  await page.locator('.tile[data-pair="word-1"]').first().click()
  await page.locator('.tile[data-pair="word-2"]').first().click()
  for (const screen of [page, projector]) {
    await expect(screen.locator('.tile--revealed')).toHaveCount(2)
    await expect(screen.locator('.flipping-presentation__feedback b')).toHaveText('Mismatch!')
  }
  await expect(page.locator('.tile').first()).toBeDisabled()
  await page.clock.runFor(599)
  await expect(page.locator('.tile--revealed')).toHaveCount(2)
  await page.clock.runFor(1)
  await expect(page.locator('.tile--revealed')).toHaveCount(0)
  await expect(projector.locator('.tile--revealed')).toHaveCount(0)
  await expect(page.getByRole('timer', {name:'Cards close countdown'})).toHaveCount(0)
  await expect(page.locator('.tile').first()).toBeEnabled()
  await projector.reload()
  await page.reload()
  await expect(page.locator('.tile--revealed')).toHaveCount(0)
  await expect(projector.locator('.tile--revealed')).toHaveCount(0)
  await expect(active).toContainText(order[0]!)
  await page.locator('.flipping-presentation__teams').getByRole('button', { name: order[1]!, exact: true }).click()
  await expect(active).toContainText(order[1]!)
  await expect(projector.locator('.tile--revealed')).toHaveCount(20)
  await expect(page.getByRole('timer', {name:'Cards preview countdown'})).toContainText('5s')
  await expect(page.getByRole('table', { name: 'Matching scores' })).toHaveCount(0)
  await page.clock.runFor(20100)
  await expect(active).toContainText(order[1]!)
  await page.locator('.tile[data-pair="word-1"]').first().click()
  await expect(page.locator('.tile--revealed')).toHaveCount(1)
  await page.locator('.flipping-presentation__teams').getByRole('button', { name: order[0]!, exact: true }).click()
  await expect(active).toContainText(order[0]!)
  await expect(projector.locator('.tile--revealed')).toHaveCount(20)
  await page.clock.runFor(5000)
  await page.locator('.flipping-presentation__teams').getByRole('button', { name: order[0]!, exact: true }).click()
  await expect(active).toContainText(order[0]!)
  for (let pair = 1; pair <= 10; pair++) {
    await page.locator(`.tile[data-pair="word-${pair}"]`).nth(0).click()
    await page.locator(`.tile[data-pair="word-${pair}"]`).nth(1).click()
    if (pair < 10) {
      await expect(projector.locator('.tile--matched')).toHaveCount(pair * 2)
      for (const screen of [page, projector]) await expect(screen.locator('.flipping-presentation__feedback b')).toHaveText('Match!')
      await expect(page.getByRole('list', { name: 'Answer choices' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Answer myself', exact: true })).toHaveCount(0)
      if (pair === 1) {
        await expect(page.getByRole('table', { name: 'Matching scores' })).toHaveCount(0)
        await page.clock.runFor(1200)
        await projector.clock.runFor(1200)
        for (const screen of [page, projector]) await expect(screen.locator('.flipping-presentation__feedback')).toHaveCount(0)
        await page.clock.runFor(4800)
        await expect(projector.locator('.tile--matched')).toHaveCount(2)
        await projector.screenshot({ path: 'test-results/matching-only.png' })
        await projector.reload()
        await expect(projector.locator('.tile--matched')).toHaveCount(2)
        await expect(projector.locator('.flipping-presentation__feedback')).toHaveCount(0)
        const previousLayout = await projector.locator('.tile').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-pair')))
        await page.locator('.flipping-presentation__teams').getByRole('button', { name: order[1]!, exact: true }).click()
        await expect(projector.locator('.tile--revealed')).toHaveCount(20)
        await expect(projector.locator('.tile--matched')).toHaveCount(0)
        const newLayout = await projector.locator('.tile').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-pair')))
        expect(newLayout).not.toEqual(previousLayout)
        await page.clock.runFor(1000)
        await page.reload()
        await projector.reload()
        await expect(projector.getByRole('timer', {name:'Cards preview countdown'})).toContainText('4s')
        expect(await projector.locator('.tile').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-pair')))).toEqual(newLayout)
        await page.clock.runFor(4000)
        for (const screen of [page, projector]) {
          await expect(screen.locator('.tile--revealed')).toHaveCount(0)
          await expect(screen.locator('.tile--matched')).toHaveCount(0)
          await expect(screen.getByRole('timer', {name:'Cards preview countdown'})).toHaveCount(0)
        }
        await page.locator('.tile[data-pair="word-1"]').nth(0).click()
        await page.locator('.tile[data-pair="word-1"]').nth(1).click()
        await expect(projector.locator('.tile--matched')).toHaveCount(2)
      }
    }
  }
  await expect(page.getByText('All pairs matched!', { exact: true })).toBeVisible()
  await expect(projector.getByText('All pairs matched!', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/play\/word-assembly\//)
  await expect(projector).toHaveURL(/\/play\/word-assembly\//)
  await page.locator('.flipping-presentation__teams').getByRole('button', {name:order[0]!,exact:true}).click()
  for (const screen of [page,projector]) {
    await expect(screen.locator('.tile--revealed')).toHaveCount(20)
    await expect(screen.locator('.tile--matched')).toHaveCount(0)
    await expect(screen.getByText('All pairs matched!',{exact:true})).toHaveCount(0)
  }
  await page.clock.runFor(5000)
  await expect(projector.locator('.tile--revealed')).toHaveCount(0)
  await page.goto('/admin/scoreboard/7c4a2f96-08db-4e15-b3c7-1d9e5a80f463')
  await expect(page.locator('.board__row')).toHaveCount(0)
})

test('Play opens the public board immediately and Flipping Connect only offers team runs', async ({ page, context }) => {
  await page.goto('/admin/challenges')
  const popup = context.waitForEvent('page')
  await page.locator('li').filter({ hasText:'Challenge 2 - Flipping Connect' }).getByRole('button', { name:'Play', exact:true }).click()
  const projector = await popup
  await expect(projector).toHaveURL('/play/word-assembly/7c4a2f96-08db-4e15-b3c7-1d9e5a80f463')
  await expect(projector.locator('.flipping-presentation')).toBeVisible()
  await expect(projector.locator('.tile')).toHaveCount(20)
  await expect(page.getByText('Play solo instead', { exact:true })).toHaveCount(0)
  await expect(page.getByRole('button', { name:'Restart matching' })).toHaveCount(0)
  await expect(page.getByRole('button', { name:'Start team run (0)' })).toBeDisabled()
})

test('public waiting board shows real team GP before a run starts', async ({ page }) => {
  await page.goto('/play/word-assembly/7c4a2f96-08db-4e15-b3c7-1d9e5a80f463')
  await expect(page.locator('.flipping-presentation__team-gp')).toHaveText(Array(5).fill('5 GP'))
  await expect(page.locator('.flipping-presentation__team-name')).toHaveText(['Biru', 'Hijau', 'Kuning', 'Merah', 'Pink'])
  await page.screenshot({ path:'test-results/flipping-waiting-gp.png' })
})

test('team-run GP stays visible, updates live on both screens, and survives deactivation', async ({ page, context }) => {
  const id = '7c4a2f96-08db-4e15-b3c7-1d9e5a80f463'
  await page.goto(`/admin/play/word-assembly/${id}`)
  await page.getByRole('checkbox', { name:'Biru', exact:true }).check()
  const popup = context.waitForEvent('page')
  await page.getByRole('button', { name:'Start team run (1)' }).click()
  const projector = await popup
  await expect(projector.locator('.flipping-presentation__team-gp')).toHaveText('5 GP')
  const manager = await context.newPage()
  await manager.goto('/admin/scoreboard/9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10')
  await manager.locator('.grid-form select').selectOption({ label:'Biru' })
  await manager.locator('.grid-form input[type="number"]').fill('10')
  await manager.getByRole('button', { name:'Add entry', exact:true }).click()
  for (const screen of [page, projector]) {
    const gp = screen.locator('.flipping-presentation__team-gp')
    await expect(gp).toHaveText('8 GP')
    await expect(gp).toBeVisible()
    await gp.scrollIntoViewIfNeeded()
    const readable = await gp.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const team = element.closest('li')!.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && box.top >= team.top && box.bottom <= team.bottom
        && element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
    })
    expect(readable).toBe(true)
  }
  await projector.screenshot({ path:'test-results/flipping-live-gp.png' })
  await manager.goto('/admin')
  const team = manager.locator('.card').filter({ has:manager.locator('.card__title', { hasText:/^Biru$/ }) })
  await team.getByRole('button', { name:'Deactivate', exact:true }).click()
  await expect(team).toHaveCount(0)
  await expect(page.locator('.flipping-presentation__team-name').first()).toHaveText('Biru')
  await expect(page.locator('.flipping-presentation__team-gp')).toHaveText('8 GP')
  await projector.reload()
  await expect(projector.locator('.flipping-presentation__team-gp')).toHaveText('8 GP')
})

test('team start reuses the public window after another feature was displayed', async ({ page, context }) => {
  await page.goto('/admin/leaderboard')
  const popup = context.waitForEvent('page')
  await page.getByRole('link', { name:'Leaderboard', exact:true }).click()
  const projector = await popup
  await expect(projector).toHaveURL('/leaderboard')
  const pagesBefore = context.pages().length
  await page.goto('/admin/challenges')
  await page.locator('li').filter({ hasText:'Challenge 2 - Flipping Connect' }).getByRole('button', { name:'Play', exact:true }).click()
  await expect(projector.locator('.flipping-presentation')).toBeVisible()
  await page.getByRole('checkbox', { name:'Biru', exact:true }).check()
  await projector.goto('/leaderboard')
  await page.getByRole('button', { name:'Start team run (1)' }).click()
  await expect(projector).toHaveURL('/play/word-assembly/7c4a2f96-08db-4e15-b3c7-1d9e5a80f463')
  await expect(projector.locator('.flipping-presentation__team-gp')).toHaveText('5 GP')
  await page.locator('.tile[data-pair="word-1"]').first().click()
  await expect(projector.locator('.tile--revealed')).toHaveCount(1)
  expect(context.pages()).toHaveLength(pagesBefore)
  await projector.reload()
  await expect(projector.locator('.flipping-presentation')).toBeVisible()
  await expect(projector.locator('.tile--revealed')).toHaveCount(1)
  await page.getByRole('button', { name:'End run', exact:true }).click()
  await expect(projector.locator('.flipping-presentation__team-gp')).toHaveCount(5)
  await expect(projector.locator('.tile--revealed')).toHaveCount(0)
})

test('a blocked public popup leaves Play available with a clear error', async ({ page }) => {
  await page.goto('/admin/challenges')
  await page.evaluate(() => { Object.assign(window, { originalOpen:window.open }); window.open = () => null })
  await page.locator('li').filter({ hasText:'Challenge 2 - Flipping Connect' }).getByRole('button', { name:'Play', exact:true }).click()
  await expect(page.getByRole('alert')).toContainText('Allow pop-ups')
  await expect(page).toHaveURL('/admin/challenges')
  await page.evaluate(() => { window.open = (window as unknown as { originalOpen: typeof window.open }).originalOpen })
  const popup = page.waitForEvent('popup')
  await page.locator('li').filter({ hasText:'Challenge 2 - Flipping Connect' }).getByRole('button', { name:'Play', exact:true }).click()
  await expect((await popup).locator('.flipping-presentation')).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/play\/word-assembly\//)
})
