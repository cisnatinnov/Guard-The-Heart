import { expect, test } from '@playwright/test'

const routes = ['/admin','/admin/challenges','/admin/presentation','/admin/turn-order','/admin/scoreboard','/admin/leaderboard','/admin/heart-of-awareness','/admin/podium','/admin/gp-transactions','/admin/rewards','/admin/tactical','/admin/gigarisk','/admin/timer','/admin/play/emoji-decode','/admin/play/word-assembly','/admin/play/jaws-of-risk','/','/turn-order','/scoreboard','/leaderboard','/heart-of-awareness','/podium','/rewards','/tactical','/card-reveal','/gigarisk','/timer','/play/emoji-decode','/play/word-assembly','/play/jaws-of-risk']
for (const theme of ['dark','light']) for (const width of [1440,1024,768,390]) {
  test(`${theme} screens remain within a ${width}px viewport`, async ({ page }) => {
    test.setTimeout(180000)
    await page.setViewportSize({ width, height:width === 390 ? 844 : 800 })
    await page.addInitScript((value) => localStorage.setItem('guard-the-heart-theme',value),theme)
    for (const route of routes) {
      await page.goto(route)
      await expect(page.locator('.app__main'),route).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('data-theme',theme)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),{message:route}).toBe(true)
      if (!route.startsWith('/admin')) {
        const stage = page.locator('.reference-stage,.reference-ranking,.tactical-stage,.reward-stage,.podium-stage,.event-timer-stage,.qa-stage,.decode-stage,.workbook-quiz,.flipping-presentation,.crocodile-stage,.main-presentation-stage').first()
        await expect(stage).toBeVisible()
        const box = (await stage.boundingBox())!
        if (!(width <= 680 && await stage.evaluate(element => element.matches('.workbook-quiz')))) {
          expect(box.y + box.height, route).toBeLessThanOrEqual(page.viewportSize()!.height + 1)
        }
        const quiz = page.locator('.workbook-quiz')
        if (await quiz.count() && !await stage.evaluate(element => element.matches('.workbook-quiz'))) {
          const question = (await quiz.boundingBox())!
          expect(question.x + question.width <= box.x + 1 || question.y + question.height <= box.y + 1, route).toBe(true)
        }
      }
      if (route.includes('turn-order')) {
        const stage = page.getByRole('region',{name:'Turn Order',exact:true})
        await expect(stage.locator('.turn-order-item')).toHaveCount(5)
        const bounds = await stage.boundingBox()
        for (const item of await stage.locator('.turn-order-item').all()) {
          const box = await item.boundingBox()
          expect(box!.x).toBeGreaterThanOrEqual(bounds!.x)
          expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1)
          expect(box!.y + box!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1)
        }
        if (route.startsWith('/admin')) {
          const shuffle = await page.getByRole('button',{name:'Shuffle Order',exact:true}).boundingBox()
          expect(shuffle!.y + shuffle!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height)
        }
      }
      await page.screenshot({path:`.validation.tmp/comfort/${theme}-${width}-${route.replaceAll('/','_') || 'home'}.png`,fullPage:route.startsWith('/admin')})
    }
  })
}
