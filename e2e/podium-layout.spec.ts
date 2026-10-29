import {expect,test} from '@playwright/test'
for(const theme of ['dark','light']) for(const width of [1440,1024,768,390]) {
 test(`podium remains aligned in ${theme} at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900})
  await page.addInitScript(t=>localStorage.setItem('guard-the-heart-theme',t),theme)
  await page.goto('/admin/podium')
  await expect(page.locator('.podium-rank')).toHaveCount(3)
  for(const [index,amount] of ['999999999999','750000','250000'].entries()) await page.getByRole('spinbutton',{name:`Prize position ${index+1} (Rp)`}).fill(amount)
  const fields=await page.locator('.podium-admin .admin-toolbar input').evaluateAll(items=>items.map(el=>{const b=el.getBoundingClientRect();return {top:b.top,width:b.width}}))
  if(width>=768)expect(new Set(fields.map(f=>Math.round(f.top))).size).toBe(1)
  else expect(new Set(fields.map(f=>Math.round(f.width))).size).toBe(1)
  for(const selector of ['.podium-name','.podium-gp','.podium-prize']) {
   for(const label of await page.locator(selector).all()) {
    const fit=await label.evaluate(el=>{const b=el.getBoundingClientRect();const r=document.createRange();r.selectNodeContents(el);const t=r.getBoundingClientRect();return {fits:t.width<=b.width+1&&t.height<=b.height+1,size:parseFloat(getComputedStyle(el).fontSize)}})
    expect(fit.fits,selector).toBe(true)
    expect(fit.size,selector).toBeGreaterThanOrEqual(selector==='.podium-prize'?12:14)
   }
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`.validation.tmp/podium-polished-${theme}-${width}.png`,fullPage:true})
 })
}
