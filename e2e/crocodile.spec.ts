import { test, expect } from '@playwright/test'

const challengeId = 'd5e8b317-4c62-49af-8b03-2f7c19a6d5e8'

test('Jaw of Risk is only a toy and synchronizes bites and new teeth to the public view', async ({ page, context }) => {
  await page.goto('/admin/challenges')
  await expect(page.getByText('Challenge 2 - Flipping Connect', { exact: true })).toBeVisible()
  const popup = context.waitForEvent('page')
  await page.locator('li').filter({ hasText: 'Challenge 3 - Jaw of Risk' }).getByRole('button', { name: 'Play', exact: true }).click()
  const publicPage = await popup
  await expect(publicPage.getByLabel('Crocodile bite toy')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open public view' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Tooth \d+$/ })).toHaveCount(14)
  await expect(page.getByText('Start team run', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('timer')).toHaveCount(0)
  await expect(publicPage.getByRole('img', { name:'GigaRisk head' })).toBeVisible()
  await expect(publicPage.getByRole('img', { name:'GigaRisk head' })).toHaveAttribute('src', '/ui/jaw-of-risk/CH-3_Background-Polos.png')
  await page.evaluate((id) => {
    const key = `guard-the-heart-crocodile:${id}`
    localStorage.setItem(key, JSON.stringify({ bitingTooth: 0, pressed: [], reopenAt: null }))
    window.dispatchEvent(new Event(key))
  }, challengeId)
  await page.getByRole('button', { name: 'Tooth 2', exact: true }).click()
  await expect(publicPage.getByRole('button', { name: 'Tooth 2', exact: true })).toBeDisabled()
  await expect(publicPage.getByRole('button', { name: 'Tooth 2', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: 'test-results/crocodile-admin.png' })
  await page.getByRole('button', { name: 'Tooth 1', exact: true }).click()
  await expect(publicPage.getByRole('status')).toHaveText('CHOMP! Watch your fingers!')
  await expect(page.getByRole('button', { name: 'Tooth 3', exact: true })).toBeDisabled()
  await expect(publicPage.locator('.crocodile__bite')).toHaveAttribute('src', /gigarisk-bite\.webp#/)
  await expect(publicPage.getByRole('status')).toHaveText('CHOMP! Watch your fingers!')
  await expect(publicPage.getByRole('status')).toHaveText('Which tooth will bite?', { timeout: 8000 })
  await expect(page.getByRole('button', { name: 'Tooth 1', exact: true })).toBeEnabled()
  const nextTooth = await page.evaluate((id) => JSON.parse(localStorage.getItem(`guard-the-heart-crocodile:${id}`)!).bitingTooth as number, challengeId)
  expect(nextTooth).not.toBe(0)
  await publicPage.reload()
  await expect(publicPage.getByRole('button', { name: 'Tooth 2', exact: true })).toBeDisabled()
  await expect(publicPage.getByRole('status')).toBeInViewport({ ratio: 1 })
  await publicPage.screenshot({ path: 'test-results/crocodile-public.png' })
})

test('Play reuses a public view opened separately, including after admin reload', async ({ page, context }) => {
  await page.goto('/admin/challenges')
  const publicPage = await context.newPage()
  await publicPage.goto('/leaderboard')
  await expect(publicPage.locator('.app--public')).toBeVisible()
  await page.getByRole('link', { name:'Leaderboard', exact:true }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('guard-the-heart-public-display') ?? '')).toContain('"stage":"leaderboard"')
  await page.goto('/admin/challenges')
  await page.reload()
  const pagesBefore = context.pages().length
  await page.locator('li').filter({ hasText: 'Challenge 3 - Jaw of Risk' }).getByRole('button', { name: 'Play', exact: true }).click()
  await expect(publicPage).toHaveURL(`/play/jaws-of-risk/${challengeId}`)
  await expect(publicPage.getByLabel('Crocodile bite toy')).toBeVisible()
  expect(context.pages()).toHaveLength(pagesBefore)
  await publicPage.reload()
  await expect(publicPage.getByLabel('Crocodile bite toy')).toBeVisible()
  await page.goto('/admin/challenges')
  await page.locator('li').filter({ hasText: 'Challenge 3 - Jaw of Risk' }).getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByLabel('Crocodile bite toy')).toBeVisible()
  expect(context.pages()).toHaveLength(pagesBefore)
})

test('reference teeth align with the dragon and remain usable at desktop and phone sizes', async ({ page }) => {
  for (const view of ['admin', 'public']) {
    await page.goto(`${view === 'admin' ? '/admin' : ''}/play/jaws-of-risk/${challengeId}`)
    for (const size of [{ width:1280, height:720 }, { width:390, height:844 }]) {
      await page.setViewportSize(size)
      const stage = page.getByLabel('Crocodile bite toy')
      await expect(stage).toBeVisible()
      await expect(stage.getByRole('heading')).toHaveCount(0)
      await expect(stage.locator('img[src="/Logo_Game-5.png"]')).toHaveCount(0)
      if (view === 'public') await expect(stage.locator('.crocodile-stage__instruction')).toHaveText('Watch closely. The dragon may bite')
      const stageBox = (await stage.boundingBox())!
      expect(stageBox.width / stageBox.height).toBeCloseTo(16 / 9, 1)
      for (let tooth = 1; tooth <= 14; tooth++) {
        const button = page.getByRole('button', { name:`Tooth ${tooth}`, exact:true })
        await expect(button).toBeVisible()
        await button.hover()
        await expect(button).toHaveCSS('cursor', view === 'admin' ? 'none' : 'default')
        if (view === 'public') await expect(button).toBeDisabled()
        const box = (await button.boundingBox())!
        expect(box.x).toBeGreaterThan(stageBox.x)
        expect(box.y + box.height).toBeLessThan(stageBox.y + stageBox.height)
        expect(await button.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
        })).toBe(true)
      }
      await page.screenshot({ path:`test-results/crocodile-labels-${view}-${size.width}.png`, fullPage:true })
    }
  }
})

test('tactical and reveal challenge labels sit inside the top-right of the public stage', async ({ page }) => {
  for (const stage of ['tactical', 'card-reveal']) {
    await page.goto(`/${stage}/${challengeId}`)
    const label = page.getByLabel('Current challenge')
    await expect(label).toHaveText('Challenge 3 - Jaw of Risk')
    const box = (await label.boundingBox())!
    const stageBox = (await page.locator('.tactical-stage').boundingBox())!
    expect(box.x).toBeGreaterThan(stageBox.x + stageBox.width * .5)
    expect(box.y + box.height).toBeLessThan(stageBox.y + stageBox.height * .2)
    expect(box.x + box.width).toBeLessThan(stageBox.x + stageBox.width)
    await page.screenshot({ path: `test-results/${stage}-challenge-label.png` })
  }
})

test('supplied hand cursors and sounds respond to pointer and keyboard presses', async ({ page, context }) => {
  const publicPage = await context.newPage()
  await publicPage.goto(`/play/jaws-of-risk/${challengeId}`)
  await page.goto(`/admin/play/jaws-of-risk/${challengeId}`)
  await page.evaluate((id) => {
    const key = `guard-the-heart-crocodile:${id}`
    localStorage.setItem(key, JSON.stringify({ bitingTooth: 6, pressed: [], reopenAt: null }))
    window.dispatchEvent(new Event(key))
    const played: string[] = []
    Object.assign(window, { playedSounds: played })
    HTMLMediaElement.prototype.play = function () { played.push(this.getAttribute('data-sound') ?? ''); return Promise.resolve() }
  }, challengeId)
  await page.getByRole('button', { name: 'Tooth 1', exact: true }).hover()
  await expect(page.locator('.crocodile__hand')).toHaveAttribute('src', /Tangan - Pencet Gigi Kiri\.png$/)
  await page.getByRole('button', { name: 'Tooth 1', exact: true }).click()
  await expect(publicPage.locator('.crocodile__hand')).toHaveAttribute('src', /Tangan - Pencet Gigi Kiri\.png$/)
  await expect(publicPage.locator('.crocodile__hand')).toHaveCount(0)
  await page.getByRole('button', { name: 'Tooth 14', exact: true }).hover()
  await expect(page.locator('.crocodile__hand')).toHaveAttribute('src', /Tangan - Pencet Gigi Kanan\.png$/)
  await page.getByRole('button', { name: 'Tooth 14', exact: true }).press('Enter')
  await expect(publicPage.locator('.crocodile__hand')).toHaveAttribute('src', /Tangan - Pencet Gigi Kanan\.png$/)
  await page.getByRole('button', { name: 'Tooth 7', exact: true }).click()
  await expect(page.locator('.crocodile__bite')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { playedSounds: string[] }).playedSounds)).toEqual(expect.arrayContaining(['hover', 'click', 'safe', 'bite']))
  await page.screenshot({ path:'test-results/jaw-bite-hand.png' })
  await expect(page.getByRole('status')).toHaveText('Which tooth will bite?', { timeout:8000 })
  await expect(page.locator('.crocodile__bite')).toHaveCount(0)
})

test('public teeth cannot change the round and mirror admin hover at different screen sizes', async ({ page, context }) => {
  await page.goto(`/admin/play/jaws-of-risk/${challengeId}`)
  await page.setViewportSize({ width:1280, height:720 })
  const projector = await context.newPage({ viewport:{ width:960, height:540 } })
  await projector.goto(`/play/jaws-of-risk/${challengeId}`)
  const snapshot = () => projector.evaluate((id) => localStorage.getItem(`guard-the-heart-crocodile:${id}`), challengeId)
  await expect.poll(snapshot).not.toBeNull()
  const before = await snapshot()
  const publicTooth = projector.getByRole('button', { name:'Tooth 1', exact:true })
  await expect(publicTooth).toBeDisabled()
  const box = (await publicTooth.boundingBox())!
  await projector.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await publicTooth.dispatchEvent('click')
  await publicTooth.dispatchEvent('keydown', { key:'Enter' })
  expect(await snapshot()).toBe(before)
  await expect(projector.locator('.crocodile__hand')).toHaveCount(0)
  for (const tooth of [1, 14]) {
    await page.getByRole('button', { name:`Tooth ${tooth}`, exact:true }).hover()
    await expect(projector.locator('.crocodile__hand')).toHaveAttribute('src', tooth === 1 ? /Gigi Kiri\.png$/ : /Gigi Kanan\.png$/)
    await expect(projector.getByRole('button', { name:`Tooth ${tooth}`, exact:true })).toHaveClass(/is-hovered/)
    const position = await page.locator('.crocodile__hand').getAttribute('style')
    await expect(projector.locator('.crocodile__hand')).toHaveAttribute('style', position!)
    await page.mouse.move(10, 10)
    await expect(projector.locator('.crocodile__hand')).toHaveCount(0)
    await expect(projector.locator('.is-hovered')).toHaveCount(0)
  }
  // A display opened while the admin is already hovering requests its current hand.
  await page.getByRole('button', { name:'Tooth 2', exact:true }).hover()
  await projector.reload()
  await expect(projector.locator('.crocodile__hand')).toHaveAttribute('src', /Gigi Kiri\.png$/)
  await page.goto('/admin/challenges')
  await expect(projector.locator('.crocodile__hand')).toHaveCount(0)
})

test('hover synchronization falls back to storage events and clears on admin blur', async ({ page, context }) => {
  await context.addInitScript(() => { Reflect.deleteProperty(window, 'BroadcastChannel') })
  await page.goto(`/admin/play/jaws-of-risk/${challengeId}`)
  const projector = await context.newPage()
  await projector.goto(`/play/jaws-of-risk/${challengeId}`)
  await page.getByRole('button', { name:'Tooth 14', exact:true }).hover()
  await expect(projector.locator('.crocodile__hand')).toHaveAttribute('src', /Gigi Kanan\.png$/)
  await expect(projector.getByRole('button', { name:'Tooth 14', exact:true })).toHaveClass(/is-hovered/)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(projector.locator('.crocodile__hand')).toHaveCount(0)
  await expect(projector.locator('.is-hovered')).toHaveCount(0)
})


test('a second bite responds immediately and its optimized animation works offline', async ({ page, context }) => {
  await page.goto(`/admin/play/jaws-of-risk/${challengeId}`)
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect(page.getByRole('group', { name: 'Biting teeth', exact: true })).toBeVisible()
  const time = new Date()
  await page.clock.install({ time })
  await page.clock.pauseAt(new Date(time.getTime() + 1000))
  const settings = page.getByRole('group', { name: 'Biting teeth', exact: true })
  for (const checkbox of await settings.getByRole('checkbox').all()) await checkbox.uncheck()
  await settings.getByRole('checkbox', { name: 'Biting tooth 1', exact: true }).check()
  await page.getByRole('button', { name: 'Apply biting teeth', exact: true }).click()
  const projector = await context.newPage()
  await projector.goto(`/play/jaws-of-risk/${challengeId}`)
  await context.setOffline(true)
  await projector.reload()
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: 'Tooth 1', exact: true }).click({ timeout: 1000 })
    for (const screen of [page, projector]) {
      await expect(screen.getByRole('status')).toContainText('CHOMP!')
      await expect(screen.locator('.crocodile__bite')).toHaveAttribute('src', /gigarisk-bite\.webp#/)
      await expect.poll(() => screen.locator('.crocodile__bite').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1280)
    }
    await page.clock.runFor(4440)
    for (const screen of [page, projector]) await expect(screen.getByRole('status')).toHaveText('Which tooth will bite?')
  }
})
