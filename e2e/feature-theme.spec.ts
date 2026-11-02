import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { challengeOne, seedCards } from './support/cardFixture'

for (const width of [1440, 390]) {
  test(`public tactical and reveal share the host theme with real cards at ${width}px`, async ({ page, context }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height: 900 })
    await seedCards(page, challengeOne, [['Biru', 'Normal Heal Card #01']], false, true)
    const blue = page.locator('.tactical-admin__team').filter({ has: page.getByRole('heading', { name: /Team Biru/ }) })
    await blue.getByRole('button', { name: /^Select Normal Heal/ }).click()
    const projector = await context.newPage()
    await projector.setViewportSize({ width, height: 900 })
    const oldArtwork: string[] = []
    projector.on('request', request => {
      if (/\/ui\/tactical-slide|\/cards\/(?!branded\/)/.test(request.url())) oldArtwork.push(request.url())
    })
    for (const reveal of [false, true]) {
      if (reveal) await page.getByRole('button', { name: 'Card Reveal', exact: true }).click()
      await projector.goto(`/${reveal ? 'card-reveal' : 'tactical'}/${challengeOne}`)
      await expect(projector.locator('.tactical-stage__header')).toContainText('Fight the Dragon')
      await expect(projector.getByRole('heading', { name: reveal ? 'Card Reveal' : 'Tactical Phase', exact: true })).toBeVisible()
      await expect(projector.locator('.tactical-stage__art')).toHaveCount(0)
      for (const theme of ['dark', 'light']) {
        const nextButton = page.getByRole('button', { name: 'Dark theme', exact: true })
        if (await page.locator('html').getAttribute('data-theme') !== theme) await nextButton.click()
        await expect(projector.locator('html')).toHaveAttribute('data-theme', theme)
        await expect(projector.locator('.card-art img').first()).toHaveAttribute('src', new RegExp(`/cards/branded/${theme}/`))
        const hostSurface = await blue.evaluate(element => getComputedStyle(element).backgroundColor)
        await expect(projector.locator('.tactical-stage__panel')).toHaveCSS('background-color', hostSurface)
        await expect.poll(() => projector.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
        await projector.screenshot({ path: `.validation.tmp/theme-${reveal ? 'reveal' : 'tactical'}-${theme}-${width}.png` })
      }
    }
    expect(oldArtwork).toEqual([])
  })
}

test('portfolio offers a complete downloadable PDF', async ({ page }) => {
  await page.goto('/portfolio')
  const event = page.waitForEvent('download')
  await page.getByRole('link', { name: /Download portfolio/ }).click()
  const download = await event
  expect(download.suggestedFilename()).toBe('Cendikia-Hairy-Portfolio.pdf')
  const bytes = await readFile((await download.path())!)
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
  expect(bytes.length).toBeGreaterThan(100_000)
})
