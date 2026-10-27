import { expect, test } from '@playwright/test'

test('new characters load across the header, live slides and podium, including offline', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/admin')
  await expect(page.locator('.app__character figcaption')).toHaveText(['Dragon Warden', 'Spark', 'Storm Ranger'])
  await expect(page.locator('.app__characters img')).toHaveCount(3)
  await expect(page.locator('img[src="/gardimon.png"], img[src="/gardian-male.png"], img[src="/gardian-female.png"]')).toHaveCount(0)
  const projector = await context.newPage()
  await page.goto('/admin/presentation')
  await projector.goto('/')
  for (const index of [0, 2, 4, 5]) {
    await page.getByLabel('Presentation slide', { exact: true }).selectOption(String(index))
    const characters = projector.locator('.main-presentation-stage .game-characters img')
    await expect(characters).toHaveCount(3)
    await expect.poll(() => characters.evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
    await projector.screenshot({ path: `test-results/new-characters-slide-${index + 1}.png` })
  }
  await projector.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    if (!registration.active) throw new Error('The offline service worker is not active')
  })
  await context.setOffline(true)
  await projector.reload()
  await expect(projector.locator('.brand-slide--rules')).toBeVisible()
  await expect.poll(() => projector.locator('.main-presentation-stage .game-characters img').evaluateAll((images) => images.length === 3 && images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true)
  await context.setOffline(false)
  await projector.goto('/podium')
  await expect(projector.locator('.podium-characters img')).toHaveCount(3)
  await expect(projector.locator('.podium-plinth')).toHaveCount(3)
  await projector.screenshot({ path: 'test-results/new-characters-podium.png' })
})
