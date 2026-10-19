import { test, expect } from '@playwright/test'

test('score rewards and GP/CP tie-break agree between leaderboard and podium',async({page})=>{
 const id='9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'
 await page.goto(`/admin/scoreboard/${id}`)
 for(const [index,name] of ['Merah','Biru','Kuning','Pink','Hijau'].entries()){
  await page.locator('.grid-form select').selectOption({label:name})
  await page.locator('.grid-form input[type="number"]').fill(String(100-index*10))
  await page.getByRole('button',{name:'Add entry',exact:true}).click()
  await expect(page.locator('.board__row')).toHaveCount(index+1)
 }
 const last=page.locator('.board__row').filter({hasText:'Hijau'})
 await expect(last).toContainText('60 score · 2 CP · 1 GP')
 const gp=page.getByRole('list',{name:'Current team GP'})
 await expect(gp.getByRole('listitem')).toHaveCount(5)
 await expect(gp.getByRole('listitem',{name:'Merah: 8 GP',exact:true})).toBeVisible()
 await page.goto(`/scoreboard/${id}`)
 await expect(page.getByRole('list',{name:'Current team GP'}).getByRole('listitem',{name:'Merah: 8 GP',exact:true})).toBeVisible()
 await page.screenshot({path:'test-results/scoreboard-gp-footer.png'})
 await page.goto('/leaderboard')
 const rows=page.getByRole('table',{name:'Team leaderboard'}).locator('tbody tr')
 await expect(rows).toHaveCount(5)
 await expect(page.getByRole('columnheader')).toHaveCount(7)
 await expect(page.locator('.ranking-cp')).toHaveCount(0)
 await page.screenshot({path:'test-results/leaderboard-cp.png'})
 for(const [index,name] of ['Merah','Biru','Kuning','Pink','Hijau'].entries()){
  await expect(rows.nth(index)).toContainText(`Tim ${name}`)
  await expect(rows.nth(index).getByAltText(`Rank ${index+1}`)).toBeVisible()
 }
 await page.goto('/podium')
 await expect(page.locator('.podium-winner--1')).toHaveAttribute('aria-label','Rank 1: Merah, 8 GP')
 await expect(page.locator('.podium-winner--2')).toHaveAttribute('aria-label','Rank 2: Biru, 7 GP')
 await expect(page.locator('.podium-winner--3')).toHaveAttribute('aria-label','Rank 3: Kuning, 7 GP')
 for (let slot=1;slot<=3;slot++) {
  await expect(page.locator(`.podium-winner--${slot} .podium-rank`)).toHaveAttribute('src', `/ui/Icon%20rank/Icon-Rank_${slot}.png`)
  await expect(page.locator(`.podium-winner--${slot} .podium-rank`)).toHaveAttribute('alt', `Rank ${slot}`)
 }
 await expect(page.locator('.podium-tied-rank')).toHaveCount(0)
 await page.screenshot({path:'test-results/podium-gp.png'})
 await page.reload()
 await expect(page.locator('.podium-winner--2')).toHaveAttribute('aria-label','Rank 2: Biru, 7 GP')
})

test('tied podium ranks use matching medals and plaques remain proportional on admin and public', async ({ page, context }) => {
 await page.goto('/admin/podium')
 await expect(page.locator('.podium-rank')).toHaveCount(3)
 for (const slot of [1,2,3]) {
  await page.getByRole('spinbutton', { name:`Prize position ${slot} (Rp)` }).fill(String(slot === 1 ? 999999999999 : slot === 2 ? 750000 : 250000))
 }
 const projector = await context.newPage()
 await projector.goto('/podium')
 for (const surface of [page,projector]) {
  await expect(surface.locator('.podium-art')).toHaveAttribute('src','/ui/podium-no-gp.png')
  await expect(surface.locator('.podium-rank')).toHaveCount(3)
  await expect(surface.getByAltText('Rank 1', { exact:true })).toHaveCount(3)
  await expect(surface.locator('.podium-winner--1 .podium-prize')).toHaveText('Rp 999.999.999.999')
  for (const size of [{width:1280,height:900},{width:390,height:844}]) {
   await surface.setViewportSize(size)
   const stage = surface.locator('.podium-stage')
   await stage.scrollIntoViewIfNeeded()
   const stageBox = (await stage.boundingBox())!
   expect(stageBox.width / stageBox.height).toBeCloseTo(16/9,2)
   for (const slot of [1,2,3]) {
    const winner=surface.locator(`.podium-winner--${slot}`)
    const badge=(await winner.locator('.podium-rank').boundingBox())!
    const name=(await winner.locator('.podium-name').boundingBox())!
    expect(badge.y+badge.height).toBeLessThan(name.y)
    for (const selector of ['.podium-gp','.podium-prize']) {
     expect(await winner.locator(selector).evaluate(element=>{
      const box=element.getBoundingClientRect()
      const range=document.createRange();range.selectNodeContents(element)
      const text=range.getBoundingClientRect()
      return text.width <= box.width + 1 && text.height <= box.height + 1
     })).toBe(true)
    }
   }
   expect(await surface.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true)
   await surface.screenshot({path:`test-results/podium-ties-${surface === page ? 'admin' : 'public'}-${size.width}.png`,fullPage:true})
  }
 }
})
