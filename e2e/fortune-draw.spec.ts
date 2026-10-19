import { expect, test } from '@playwright/test'
import initSqlJs from 'sql.js'
import { resolve } from 'node:path'

test('Fortune Draw keeps its three choices and saves the chosen Rare for another challenge', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const challengeId = '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'
  const SQL = await initSqlJs({ locateFile: (file) => resolve('node_modules/sql.js/dist', file) })
  await page.goto(`/admin/tactical/${challengeId}`)
  await expect(page.getByRole('button', { name:'Skip Biru', exact:true })).toBeVisible()
  const read = () => page.evaluate(() => new Promise<number[]>((accept, reject) => {
    const open = indexedDB.open('guard-the-heart', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('sqlite', 'readonly'), get = tx.objectStore('sqlite').get('database')
      get.onsuccess = () => accept(Array.from(new Uint8Array(get.result ?? [])))
      get.onerror = () => reject(get.error)
      tx.oncomplete = () => db.close()
    }
  }))
  await expect.poll(async () => {
    const bytes = await read()
    if (!bytes.length) return 0
    const db = new SQL.Database(new Uint8Array(bytes))
    const count = Number(db.exec('SELECT COUNT(*) FROM card')[0].values[0][0])
    db.close()
    return count
  }).toBe(86)
  const db = new SQL.Database(new Uint8Array(await read()))
  const teamId = String(db.exec("SELECT id FROM team WHERE name='Biru'")[0].values[0][0])
  db.run("UPDATE card SET team=?,challenge=? WHERE name='Rare Fortune Draw Card #01'", [teamId, challengeId])
  db.run("INSERT INTO team_card (id,name,type,effect,effect_action,icon,team,challenge_point,createdAt,updatedAt) SELECT 'fortune-test',name,type,effect,effect_action,icon,team,challenge_point,createdAt,updatedAt FROM card WHERE name='Rare Fortune Draw Card #01'")
  const bytes = Array.from(db.export())
  db.close()
  await page.evaluate((bytes) => new Promise<void>((accept, reject) => {
    const open = indexedDB.open('guard-the-heart', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('sqlite', 'readwrite')
      tx.objectStore('sqlite').put(new Uint8Array(bytes), 'database')
      tx.oncomplete = () => { db.close(); accept() }
      tx.onerror = () => reject(tx.error)
    }
  }), bytes)
  await page.reload()
  await page.getByRole('button', { name:'Select Rare Fortune Draw Card #01 for Biru', exact:true }).click()
  const offers = page.locator('.fortune-choices button')
  await expect(offers).toHaveCount(3)
  const original = await offers.locator('img').evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src))
  expect(new Set(original).size).toBe(3)
  await page.getByRole('button', { name:'Serang semua tim −2 GP', exact:true }).click()
  await expect(page.getByRole('alert')).toContainText('pilih 1 dari 3')
  const chosen = offers.filter({has:page.locator('img[src*="Rare_Heal"]')})
  await chosen.click()
  await expect(chosen).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(chosen).toHaveAttribute('aria-pressed', 'true')
  expect(await offers.locator('img').evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src))).toEqual(original)
  await page.setViewportSize({ width:1280, height:900 })
  await page.screenshot({ path:'test-results/fortune-draw-admin.png', fullPage:true })
  await page.setViewportSize({ width:390, height:844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path:'test-results/fortune-draw-mobile.png', fullPage:true })
  await page.setViewportSize({ width:1280, height:900 })
  const projector = await context.newPage()
  await projector.goto(`/card-reveal/${challengeId}`)
  await page.getByRole('button', { name:'Serang semua tim −2 GP', exact:true }).click()
  await expect(page.getByRole('button', { name:'Serangan selesai', exact:true })).toBeDisabled()
  await expect(projector.locator('.tactical-stage__log')).toContainText('Fortune Draw: +1 Rare', {timeout:12000})
  const blue = projector.locator('.tactical-stage__team').filter({ hasText:'Tim Biru' })
  await expect(blue.locator('.tactical-stage__effects')).toHaveText('Fortune Draw')
  await expect(blue.locator('.tactical-stage__gp')).toHaveText('GP3 GP')
  const adminBlue = page.locator('.tactical-admin__team').filter({ has:page.getByRole('heading', { name:/Tim Biru/ }) })
  await expect(adminBlue.locator('.tactical-admin__cards img')).toHaveCount(1)
  await page.reload()
  await expect(adminBlue.locator('.tactical-admin__cards img')).toHaveCount(1)
  await projector.goto(`/gigarisk/${challengeId}`)
  await expect(projector.getByLabel('Efek kartu Biru', { exact:true })).toContainText('Fortune Draw: +1 Rare')
  await expect(projector.getByLabel('Efek kartu Biru', { exact:true })).not.toContainText('+3 Heal')
  const nextId = 'd5e8b317-4c62-49af-8b03-2f7c19a6d5e8'
  await page.goto(`/admin/tactical/${nextId}`)
  await adminBlue.locator('.tactical-admin__cards button').click()
  await page.getByRole('button',{name:'Serang semua tim −2 GP',exact:true}).click()
  await expect(page.getByRole('button',{name:'Serangan selesai',exact:true})).toBeDisabled()
  await projector.goto(`/gigarisk/${nextId}`)
  await expect(projector.getByLabel('Efek kartu Biru',{exact:true})).toContainText('+3 Heal')
  await expect(projector.getByLabel('Hasil GigaRisk Biru',{exact:true}).locator('.giga-gp')).toContainText('4')
  expect(errors).toEqual([])
})
