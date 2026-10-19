import { expect, test } from '@playwright/test'

test('rarity rolls stay with the right ranked team and survive reload', async ({page}) => {
 await page.addInitScript(() => { Math.random = () => .65 })
 const id='9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'
 await page.goto(`/admin/scoreboard/${id}`)
 for (const [index,name] of ['Merah','Biru','Kuning','Pink','Hijau'].entries()) {
  await page.locator('.grid-form select').selectOption({label:name})
  await page.locator('.grid-form input[type="number"]').fill(String(100-index*10))
  await page.getByRole('button',{name:'Add entry',exact:true}).click()
  await expect(page.locator('.board__row')).toHaveCount(index+1)
 }
 await page.getByRole('button',{name:'Draw Bonus Cards',exact:true}).click()
 await expect(page.getByText('Bonus cards already drawn for this challenge.',{exact:false})).toBeVisible()
 await page.goto(`/rewards/${id}`)
 const rarities = [['Merah','Rare',3],['Biru','Rare',2],['Kuning','Normal',2],['Pink','Normal',1],['Hijau','Normal',0]] as const
 for (const [name,rarity,count] of rarities) {
  const row=page.getByRole('listitem',{name,exact:true})
  await expect(row.locator('.card-art img')).toHaveCount(count)
  for (const image of await row.locator('.card-art img').all()) await expect(image).toHaveAttribute('alt',new RegExp(`^${rarity} `))
 }
 await expect(page.locator('img[alt^="Legendary "]')).toHaveCount(0)
 await page.reload()
 await expect(page.getByRole('listitem',{name:'Merah',exact:true}).locator('.card-art img')).toHaveCount(3)
 await page.screenshot({path:'test-results/weighted-card-rewards.png'})
 await page.goto(`/admin/scoreboard/${id}`)
 await expect(page.getByRole('button',{name:'Draw Bonus Cards',exact:true})).toHaveCount(0)
})
