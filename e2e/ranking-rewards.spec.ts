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
 await expect(page.getByRole('columnheader',{name:'CP',exact:true})).toBeVisible()
 await expect(page.locator('.ranking-cp')).toHaveText(['10','8','6','4','2'])
 await page.screenshot({path:'test-results/leaderboard-cp.png'})
 for(const [index,name] of ['Merah','Biru','Kuning','Pink','Hijau'].entries()){
  await expect(rows.nth(index)).toContainText(`Tim ${name}`)
  await expect(rows.nth(index).getByAltText(`Rank ${index+1}`)).toBeVisible()
 }
 await page.goto('/podium')
 await expect(page.locator('.podium-winner--1')).toHaveAttribute('aria-label','Rank 1: Merah, 8 GP')
 await expect(page.locator('.podium-winner--2')).toHaveAttribute('aria-label','Rank 2: Biru, 7 GP')
 await expect(page.locator('.podium-winner--3')).toHaveAttribute('aria-label','Rank 3: Kuning, 7 GP')
 await expect(page.locator('.podium-cp')).toHaveText(['10 CP','8 CP','6 CP'])
 await expect(page.locator('.podium-cp--merah')).toHaveText('10 CP')
 await expect(page.locator('.podium-cp--biru')).toHaveText('8 CP')
 await expect(page.locator('.podium-cp--kuning')).toHaveText('6 CP')
 await page.screenshot({path:'test-results/podium-cp.png'})
 await page.reload()
 await expect(page.locator('.podium-winner--2')).toHaveAttribute('aria-label','Rank 2: Biru, 7 GP')
})
