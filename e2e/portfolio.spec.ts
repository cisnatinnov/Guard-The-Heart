import { expect, test } from '@playwright/test'

for (const theme of ['dark', 'light']) for (const width of [1440, 768, 390]) {
  test(`personal portfolio works in ${theme} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => {
      if (localStorage.getItem('guard-the-heart-theme') === null) localStorage.setItem('guard-the-heart-theme', value)
    }, theme)
    await page.goto('/portfolio')
    await expect(page).toHaveTitle('Cendikia Hairy — Portfolio')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Thoughtful interfaces.')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await expect(page.getByRole('navigation', { name: 'Portfolio navigation' })).toBeVisible()
    for (const label of ['Event console', 'Public display', 'Live scoreboard']) {
      const button = page.getByRole('button', { name: label, exact: true })
      await button.click()
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect.poll(() => page.locator('.portfolio__browser > img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.getByRole('button', { name: 'Event console', exact: true }).click()
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: `.validation.tmp/portfolio-${theme}-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme` }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark')
    await page.getByRole('link', { name: 'Work', exact: true }).click()
    await expect(page).toHaveURL(/#work$/)
    await expect(page.getByRole('link', { name: 'Connect on LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/in/cendikia-hairy/')
  })
}

test('portfolio does not initialize event data or follow public display navigation', async ({ page, context }) => {
  await page.goto('/portfolio')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
  const host = await context.newPage()
  await host.goto('/admin')
  await expect(host.locator('.app__main')).toBeVisible()
  await host.getByRole('button', { name: 'Dark theme', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible()
  await expect(page).toHaveURL(/\/portfolio$/)
  await host.getByRole('link', { name: 'Portfolio ↗', exact: true }).click()
  await expect(host).toHaveURL(/\/portfolio$/)
})
