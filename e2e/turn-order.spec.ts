import { expect, test } from '@playwright/test'

test('Acak Giliran moves team names while numbered slots stay fixed and sync to the public display', async ({page,context}) => {
  await page.goto('/admin/turn-order')
  const rows = page.locator('.turn-order-item')
  await expect(rows).toHaveCount(5)
  const original = await rows.locator('button').allTextContents()
  await expect(rows.locator('.turn-order-number')).toHaveText(['1','2','3','4','5'])
  const projector = await context.newPage()
  await projector.goto('/turn-order')
  await expect(projector.locator('.turn-order-item')).toHaveCount(5)
  await page.evaluate(()=>{Math.random=()=>0})
  await page.getByRole('button',{name:'Acak Giliran',exact:true}).click()
  const shuffled = [...original.slice(1),original[0]]
  await expect(rows.locator('button')).toHaveText(shuffled)
  await expect(rows.locator('.turn-order-number')).toHaveText(['1','2','3','4','5'])
  await expect(projector.locator('.turn-order-item button')).toHaveText(shuffled)
  await page.reload()
  await expect(rows.locator('button')).toHaveText(shuffled)
  await page.getByRole('button',{name:'Reset order',exact:true}).click()
  await expect(rows.locator('button')).toHaveText(original)
  await expect(rows.locator('.turn-order-number')).toHaveText(['1','2','3','4','5'])
})
