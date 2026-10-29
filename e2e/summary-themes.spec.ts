import { expect, test } from '@playwright/test'
for (const [name,path,panel] of [
  ['Scoreboard','scoreboard','.ranking-score-panel'],
  ['Leaderboard','leaderboard','.ranking-leader-panel'],
  ['Heart of Awareness','heart-of-awareness','.awareness-team'],
  ['Podium','podium','.podium-plinth i'],
] as const) for (const width of [1280,390]) {
  test(`${name} follows the live theme on host and projector at ${width}px`,async({page,context})=>{
    await page.setViewportSize({width,height:844})
    await page.goto(`/admin/${path}`)
    await expect(page.locator('.summary-stage')).toBeVisible()
    const projector=await context.newPage()
    await projector.setViewportSize({width,height:844})
    await projector.goto(`/${path}`)
    for (const theme of ['dark','light'] as const) {
      if (theme==='light') await page.getByRole('button',{name:'Dark theme',exact:true}).click()
      for (const screen of [page,projector]) {
        await expect(screen.locator('html')).toHaveAttribute('data-theme',theme)
        const stage=screen.locator('.summary-stage')
        await expect(stage.locator('.summary-stage__title')).toHaveText(name)
        await expect(stage.locator('.reference-art,.podium-art')).toHaveCount(0)
        await expect(stage).toHaveCSS('background-color',theme==='dark'?'rgb(13, 20, 35)':'rgb(241, 244, 250)')
        await expect(stage.locator(panel).first()).toHaveCSS('background-color',theme==='dark'?'rgb(24, 35, 57)':'rgb(249, 251, 254)')
        expect(await screen.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
        await screen.screenshot({path:`.validation.tmp/summary-${path}-${width}-${theme}-${screen===page?'host':'public'}.png`,fullPage:screen===page})
      }
    }
    await page.getByRole('button',{name:'Dark theme',exact:true}).click()
    for (const screen of [page,projector]) await expect(screen.locator('.summary-stage')).toHaveCSS('background-color','rgb(13, 20, 35)')
    await page.getByRole('button',{name:'Dark theme',exact:true}).click()
    await projector.reload()
    await expect(projector.locator('.summary-stage')).toHaveCSS('background-color','rgb(241, 244, 250)')
  })
}
