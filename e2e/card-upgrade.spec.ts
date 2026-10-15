import { expect, test } from '@playwright/test'
import initSqlJs from 'sql.js'
import { resolve } from 'node:path'

test('corrected Reverse/Thief migrations keep their identities and resolve with double Reflect', async ({ page, context }) => {
  const challengeId = '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'
  const SQL = await initSqlJs({ locateFile:(file)=>resolve('node_modules/sql.js/dist',file) })
  await page.goto(`/admin/scoreboard/${challengeId}`)
  for (const [index,name] of ['Merah','Biru','Kuning','Pink','Hijau'].entries()) {
    await page.locator('.grid-form select').selectOption({label:name})
    await page.locator('.grid-form input[type="number"]').fill(String(50-index*10))
    await page.getByRole('button',{name:'Add entry',exact:true}).click()
    await expect(page.locator('.board__row')).toHaveCount(index+1)
  }
  const readBytes = () => page.evaluate(()=>new Promise<number[]>((accept,reject)=>{
    const open=indexedDB.open('guard-the-heart',1)
    open.onerror=()=>reject(open.error)
    open.onsuccess=()=>{
      const db=open.result, tx=db.transaction('sqlite','readonly'), get=tx.objectStore('sqlite').get('database')
      get.onsuccess=()=>accept(Array.from(new Uint8Array(get.result??[])))
      get.onerror=()=>reject(get.error)
      tx.oncomplete=()=>db.close()
    }
  }))
  await expect.poll(async()=>{
    const bytes=await readBytes()
    if (!bytes.length) return 0
    const db=new SQL.Database(new Uint8Array(bytes))
    const count=Number(db.exec('SELECT COUNT(*) FROM challenge_point')[0].values[0][0])
    db.close()
    return count
  }).toBe(5)
  const db=new SQL.Database(new Uint8Array(await readBytes()))
  for (const [index,[name,cardName]] of [['Merah','Epic Reverse Card #01'],['Biru','Epic Thief Card #01'],['Kuning','Epic Reflect Card #01'],['Pink','Rare Protect Card #01'],['Hijau','Legendary Second Chance Card']].entries()) {
    const teamId=String(db.exec(`SELECT id FROM team WHERE name='${name}'`)[0].values[0][0])
    const entryId=String(db.exec(`SELECT id FROM challenge_point WHERE team='${teamId}'`)[0].values[0][0])
    db.run('UPDATE card SET team=?,challenge=?,challenge_point=? WHERE name=?',[teamId,challengeId,entryId,cardName])
    if (name==='Merah') db.run("UPDATE card SET name='Rare Reverse Card #01',type='Rare' WHERE team=?",[teamId])
    if (name==='Biru') db.run("UPDATE card SET name='Epic Reverse Card #01',effect='Utility',effect_action='Ambil 2 Guard Point (GP) dari setiap tim lawan.' WHERE team=?",[teamId])
    if (name==='Kuning') db.run("UPDATE card SET effect_action='Damage Gigarisk yang diterima dikonversi menjadi Guard Point (GP).' WHERE team=?",[teamId])
    db.run('INSERT INTO team_card (id,name,type,effect,effect_action,icon,team,challenge_point,createdAt,updatedAt) SELECT ?,name,type,effect,effect_action,icon,team,challenge_point,createdAt,updatedAt FROM card WHERE team=?',[`c0000000-0000-4000-8000-00000000000${index}`,teamId])
  }
  const pinkId=String(db.exec("SELECT id FROM team WHERE name='Pink'")[0].values[0][0])
  const pinkEntry=String(db.exec(`SELECT id FROM challenge_point WHERE team='${pinkId}'`)[0].values[0][0])
  db.run('UPDATE card SET team=?,challenge=?,challenge_point=? WHERE name=?',[pinkId,challengeId,pinkEntry,'Normal Thief Card #01'])
  db.run('INSERT INTO team_card (id,name,type,effect,effect_action,icon,team,challenge_point,createdAt,updatedAt) SELECT ?,name,type,effect,effect_action,icon,team,challenge_point,createdAt,updatedAt FROM card WHERE name=?',['c0000000-0000-4000-8000-000000000005','Normal Thief Card #01'])
  const fixture=Array.from(db.export())
  db.close()
  await page.evaluate((bytes)=>new Promise<void>((accept,reject)=>{
    const open=indexedDB.open('guard-the-heart',1)
    open.onerror=()=>reject(open.error)
    open.onsuccess=()=>{
      const db=open.result, tx=db.transaction('sqlite','readwrite')
      tx.objectStore('sqlite').put(new Uint8Array(bytes),'database')
      tx.oncomplete=()=>{db.close();accept()}
      tx.onerror=()=>reject(tx.error)
    }
  }),fixture)
  await page.goto(`/admin/tactical/${challengeId}`)
  for (const [name,title] of [['Merah','Epic Reverse'],['Biru','Epic Thief'],['Kuning','Epic Reflect'],['Pink','Rare Protect'],['Pink','Normal Thief']]) {
    await page.getByRole('button',{name:`Select ${title} Card #01 for ${name}`,exact:true}).click()
  }
  await expect(page.getByRole('button',{name:'Select Legendary Second Chance Card for Hijau',exact:true})).toBeDisabled()
  const protectTarget=page.getByRole('combobox',{name:/^Target Rare Protect/})
  await expect(protectTarget.locator('option').filter({hasText:'Pink'})).toHaveCount(1)
  await protectTarget.selectOption({label:'Merah · 8 GP'})
  const targets=page.getByRole('combobox',{name:/^Target Epic Thief/})
  await expect(targets).toHaveCount(2)
  await expect(page.getByRole('combobox',{name:/^Target Epic Reverse/})).toHaveCount(0)
  await page.getByRole('button',{name:'Serang semua tim −2 GP',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('dua tim yang berbeda')
  await targets.nth(0).selectOption({label:'Pink · 6 GP'})
  await expect(targets.nth(1).locator('option').filter({hasText:'Pink'})).toHaveAttribute('disabled','')
  await targets.nth(1).selectOption({label:'Hijau · 6 GP'})
  await page.getByRole('combobox',{name:/^Target Normal Thief/}).selectOption({label:'Hijau · 6 GP'})
  await page.reload()
  await expect(targets.nth(0).locator('option:checked')).toContainText('Pink')
  await expect(targets.nth(1).locator('option:checked')).toContainText('Hijau')
  await expect(page.getByRole('button',{name:'Remove Epic Reverse Card #01 from Merah',exact:true})).toBeVisible()
  const projector=await context.newPage()
  await projector.goto(`/tactical/${challengeId}`)
  await page.getByRole('button',{name:'Serang semua tim −2 GP',exact:true}).click()
  await expect(page.getByRole('button',{name:'Serangan selesai',exact:true})).toBeDisabled()
  await expect(projector).toHaveURL(`/card-reveal/${challengeId}`)
  for (const [name,gp] of [['Merah',12],['Biru',8],['Kuning',10],['Pink',2],['Hijau',1]]) {
    const team=projector.locator('.tactical-stage__team').filter({hasText:`Tim ${name}`})
    await expect(team.locator('.tactical-stage__gp')).toContainText(`${gp} GP`)
  }
  await expect(projector.locator('.tactical-stage__team').filter({hasText:'Tim Kuning'}).locator('.tactical-stage__effects')).toContainText('+4 Reflect')
  for (const [name,asset] of [['Merah','Epic_Reverse'],['Biru','Epic_Thief'],['Kuning','Epic_Reflect']]) {
    const art=projector.locator('.tactical-stage__team').filter({hasText:`Tim ${name}`}).locator('.card-art img')
    await expect(art).toHaveAttribute('src',new RegExp(asset))
    await expect.poll(()=>art.evaluate((image)=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  }
  await projector.locator('.tactical-stage').evaluate(async (stage)=>{
    await Promise.all(stage.getAnimations({subtree:true}).filter((animation)=>animation.effect?.getTiming().iterations!==Infinity).map((animation)=>animation.finished.catch(()=>{})))
  })
  await projector.screenshot({path:'test-results/corrected-card-reveal.png'})
  await expect(projector.locator('.tactical-stage__team').filter({hasText:'Tim Hijau'}).locator('.tactical-stage__effects')).toContainText('+1 Second Chance')
  await expect(projector.locator('.tactical-stage__team').filter({hasText:'Tim Hijau'}).locator('.tactical-stage__selected img')).toHaveAttribute('src',/Legend_Second/)
  await page.reload()
  await expect(page.locator('.tactical-admin__owned-card').filter({has:page.getByRole('button',{name:'Select Legendary Second Chance Card for Hijau',exact:true})})).toContainText('Used')
  await expect(targets.nth(0)).toBeDisabled()
  await expect(page.getByRole('button',{name:'Serangan selesai',exact:true})).toBeDisabled()
  await page.goto('/admin/gp-transactions')
  await expect(page.getByRole('table')).toContainText('+4 Reflect')
  await expect(page.getByRole('table')).toContainText('Reverse')
  await expect(page.getByRole('table')).toContainText('Dicuri')
})
