import { test, expect } from '@playwright/test'

const challengeId = 'd5e8b317-4c62-49af-8b03-2f7c19a6d5e8'

test('Jaw of Risk is only a toy and synchronizes bites and new teeth to the public view', async ({ page, context }) => {
  await page.goto('/admin/challenges')
  await expect(page.getByText('Challenge 2 - Flipping Card', { exact: true })).toBeVisible()
  const popup = context.waitForEvent('page')
  await page.locator('li').filter({ hasText: 'Challenge 3 - Jaw of Risk' }).getByRole('button', { name: 'Play', exact: true }).click()
  const publicPage = await popup
  await expect(publicPage.getByRole('heading', { name: 'Challenge 3 - Jaw of Risk' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open public view' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Tooth \d+$/ })).toHaveCount(12)
  await expect(page.getByText('Start team run', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('timer')).toHaveCount(0)
  await page.evaluate((id) => {
    const key = `guard-the-heart-crocodile:${id}`
    localStorage.setItem(key, JSON.stringify({ bitingTooth: 0, pressed: [], reopenAt: null }))
    window.dispatchEvent(new Event(key))
  }, challengeId)
  await page.getByRole('button', { name: 'Tooth 2', exact: true }).click()
  await expect(publicPage.getByRole('button', { name: 'Tooth 2', exact: true })).toBeDisabled()
  await page.screenshot({ path: 'test-results/crocodile-admin.png' })
  await page.getByRole('button', { name: 'Tooth 1', exact: true }).click()
  await expect(publicPage.getByRole('status')).toHaveText('CHOMP! Watch your fingers!')
  await expect(page.getByRole('button', { name: 'Tooth 3', exact: true })).toBeDisabled()
  await expect(publicPage.getByRole('status')).toHaveText('Which tooth will bite?')
  await expect(page.getByRole('button', { name: 'Tooth 1', exact: true })).toBeEnabled()
  const nextTooth = await page.evaluate((id) => JSON.parse(localStorage.getItem(`guard-the-heart-crocodile:${id}`)!).bitingTooth as number, challengeId)
  expect(nextTooth).not.toBe(0)
  await publicPage.reload()
  await expect(publicPage.getByRole('button', { name: 'Tooth 2', exact: true })).toBeEnabled()
  await expect(publicPage.getByRole('status')).toBeInViewport({ ratio: 1 })
  await publicPage.screenshot({ path: 'test-results/crocodile-public.png' })
})

test('Play reuses a public view opened separately, including after admin reload', async ({ page, context }) => {
  await page.goto('/admin/challenges')
  const publicPage = await context.newPage()
  await publicPage.goto('/leaderboard')
  await expect(publicPage.locator('.app--public')).toBeVisible()
  await page.reload()
  const pagesBefore = context.pages().length
  await page.locator('li').filter({ hasText: 'Challenge 3 - Jaw of Risk' }).getByRole('button', { name: 'Play', exact: true }).click()
  await expect(publicPage).toHaveURL(`/play/jaws-of-risk/${challengeId}`)
  await expect(publicPage.getByRole('heading', { name: 'Challenge 3 - Jaw of Risk' })).toBeVisible()
  expect(context.pages()).toHaveLength(pagesBefore)
  await page.goto('/admin/challenges')
  await page.locator('li').filter({ hasText: 'Challenge 3 - Jaw of Risk' }).getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByLabel('Crocodile bite toy')).toBeVisible()
  expect(context.pages()).toHaveLength(pagesBefore)
})

test('tooth labels stay centered and unobstructed in admin and public at desktop and phone sizes', async ({ page }) => {
  for (const view of ['admin', 'public']) {
  await page.goto(`${view === 'admin' ? '/admin' : ''}/play/jaws-of-risk/${challengeId}`)
  for (const size of [{ width:1280, height:720 }, { width:390, height:844 }]) {
    await page.setViewportSize(size)
    const separated = await page.locator('.crocodile__tooth').evaluateAll((buttons) => {
      const boxes = buttons.map((button) => button.getBoundingClientRect())
      return boxes.every((box, index) => boxes.slice(index + 1).every((other) =>
        Math.min(box.right, other.right) - Math.max(box.left, other.left) <= 0
        || Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) <= 0))
    })
    expect(separated).toBe(true)
    for (let tooth = 1; tooth <= 12; tooth++) {
      const button = page.getByRole('button', { name:`Tooth ${tooth}`, exact:true })
      await expect(button).toHaveText(String(tooth))
      await button.scrollIntoViewIfNeeded()
      await button.hover()
      await expect(button).toHaveCSS('cursor', 'pointer')
      await expect(button.locator('span')).toHaveCSS('cursor', 'pointer')
      const readable = await button.locator('span').evaluate((label) => {
        const box = label.getBoundingClientRect()
        const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        const button = label.closest('button')!
        const toothBox = button.getBoundingClientRect()
        const text = document.createRange()
        text.selectNodeContents(label)
        const textBox = text.getBoundingClientRect()
        const centered = Math.abs(textBox.x + textBox.width / 2 - toothBox.x - toothBox.width / 2) < 1
          && Math.abs(box.y + box.height / 2 - toothBox.y - toothBox.height / 2) < 1
        return label.contains(top) && centered && getComputedStyle(button).padding === '0px'
          && parseFloat(getComputedStyle(label).fontSize) >= 16
      })
      expect(readable).toBe(true)
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
