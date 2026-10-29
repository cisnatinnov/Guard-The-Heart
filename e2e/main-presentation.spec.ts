import { expect, test } from '@playwright/test'

test('main presentation projects all native scenes, persists selection and reuses the public window', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/admin/presentation')
  const popup = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Show presentation ↗', exact: true }).click()
  const projector = await popup
  projector.on('pageerror', (error) => errors.push(error.message))
  await expect(page).toHaveURL(/\/admin\/presentation$/)
  await expect(projector).toHaveURL(/:\d+\/$/)
  await expect(page.getByRole('button', { name: 'Previous slide', exact: true })).toBeDisabled()
  for (const i of [0, 1, 2, 3, 4, 5]) {
    await page.getByLabel('Presentation slide', { exact: true }).selectOption(String(i))
    await expect(projector.locator('.main-presentation-stage')).toHaveAttribute('data-slide', String(i))
    await expect.poll(() => projector.locator('.main-presentation-stage img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
  }
  await expect(page.getByRole('button', { name: 'Next slide', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Next slide', exact: true }).click()
  await expect(projector.getByRole('region', { name: 'Score Board', exact: true })).toBeVisible()
  await expect(projector.locator('.ranking-challenge')).toHaveText('Challenge 1 - Image Decode')
  await expect(page.getByRole('button', { name: 'Next slide', exact: true })).toBeDisabled()
  await page.reload()
  await expect(page.getByLabel('Presentation slide', { exact: true })).toHaveValue('6')
  await projector.reload()
  await expect(projector.getByRole('region', { name: 'Score Board', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Previous slide', exact: true }).click()
  await expect(projector.locator('.main-presentation-stage')).toHaveAttribute('data-slide', '5')
  const controls = page.locator('.presentation-controls__navigation')
  const heights = await controls.locator('button, select').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1)
  await page.locator('.presentation-controls').screenshot({ path: 'test-results/presentation-controls.png' })
  await page.getByRole('heading', { name: 'Main Presentation', exact: true }).click()
  await page.keyboard.press('Home')
  await expect(projector.locator('.main-presentation-stage')).toHaveAttribute('data-slide', '0')
  await page.keyboard.press('ArrowRight')
  await expect(projector.locator('.main-presentation-stage')).toHaveAttribute('data-slide', '1')
  await projector.setViewportSize({ width: 1280, height: 720 })
  await projector.screenshot({ path: 'test-results/main-presentation-public.png' })
  expect(await projector.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const contrast = await page.locator('.main-presentation-thumbnails button > span').first().evaluate(label => {
    const luminance = (color: string) => {
      const values = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = value / 255
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
      })
      return .2126 * values[0] + .7152 * values[1] + .0722 * values[2]
    }
    const foreground = luminance(getComputedStyle(label).color)
    const background = luminance(getComputedStyle(label.closest('button')!).backgroundColor)
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)
  })
  expect(contrast).toBeGreaterThanOrEqual(4.5)
  await page.screenshot({ path: 'test-results/main-presentation-admin-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('link', { name: 'Leaderboard', exact: true }).click()
  await expect(projector).toHaveURL(/\/leaderboard$/)
  await page.goto('/admin/presentation')
  await page.getByRole('button', { name: 'Show presentation ↗', exact: true }).click()
  await expect(projector).toHaveURL(/:\d+\/$/)
  await expect(page.getByLabel('Presentation slide', { exact: true })).toHaveValue('1')
  expect(context.pages()).toHaveLength(2)
  expect(errors).toEqual([])
})

test('invalid saved slide falls back to the opening slide', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('guard-the-heart-main-presentation', '999'))
  await page.goto('/presentation')
  await expect(page).toHaveURL(/:\d+\/$/)
  await expect(page.locator('.fight-opening__logo')).toHaveAttribute('src', '/fight-the-dragon-logo.png')
})

test('Scoreboard is the seventh slide and updates live while the public display stays at home', async ({ page, context }) => {
  await page.goto('/admin/presentation')
  await page.getByRole('button', { name: 'Slide 7: Scoreboard', exact: true }).click()
  const projector = await context.newPage()
  await projector.goto('/')
  const ranking = projector.getByRole('list', { name: 'Challenge ranking', exact: true })
  await expect(projector.locator('.ranking-challenge')).toHaveText('Challenge 1 - Image Decode')
  const challengeId = '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'
  await page.goto(`/admin/scoreboard/${challengeId}`)
  await page.locator('.grid-form select').selectOption({ label: 'Biru' })
  await page.locator('.grid-form input[type="number"]').fill('110')
  await page.getByRole('button', { name: 'Add entry', exact: true }).click()
  await expect(ranking.getByRole('listitem').filter({ hasText: 'Biru' })).toContainText('110')
  await page.locator('.board__row').filter({ hasText: 'Biru' }).getByRole('button', { name: 'Edit Score', exact: true }).click()
  await page.locator('.grid-form input[type="number"]').fill('80')
  await page.getByRole('button', { name: 'Update score', exact: true }).click()
  await expect(ranking.getByRole('listitem').filter({ hasText: 'Biru' })).toContainText('80')
  await expect(projector).toHaveURL(/:\d+\/$/)
  await page.goto('/admin/presentation')
  await expect(page.locator('.ranking-score-item').filter({ hasText: 'Biru' })).toContainText('80')
  await projector.setViewportSize({ width: 1280, height: 720 })
  await projector.screenshot({ path: 'test-results/presentation-scoreboard.png' })
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const preview = await page.locator('.main-presentation-stage').boundingBox()
    const board = await page.locator('.public-ranking').boundingBox()
    expect(Math.abs(preview!.width - board!.width)).toBeLessThan(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.screenshot({ path: 'test-results/presentation-scoreboard-mobile.png', fullPage: true })
  await projector.reload()
  await expect(ranking.getByRole('listitem').filter({ hasText: 'Biru' })).toContainText('80')
})
