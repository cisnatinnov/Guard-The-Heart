import { expect, test } from '@playwright/test'
import initSqlJs from 'sql.js'
import { resolve } from 'node:path'

test('corrected Reverse/Thief/Swallow migrations keep their identities and resolve the fixed Swallow gain', async ({ page, context }) => {
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
  for (const [index,[name,cardName]] of [['Merah','Epic Reverse Card #01'],['Biru','Epic Thief Card #01'],['Kuning','Epic Swallow Card #01'],['Pink','Rare Protect Card #01'],['Hijau','Legendary Second Chance Card']].entries()) {
    const teamId=String(db.exec(`SELECT id FROM team WHERE name='${name}'`)[0].values[0][0])
    const entryId=String(db.exec(`SELECT id FROM challenge_point WHERE team='${teamId}'`)[0].values[0][0])
    db.run('UPDATE card SET team=?,challenge=?,challenge_point=? WHERE name=?',[teamId,challengeId,entryId,cardName])
    if (name==='Merah') db.run("UPDATE card SET name='Rare Reverse Card #01',type='Rare' WHERE team=?",[teamId])
    if (name==='Biru') db.run("UPDATE card SET name='Epic Reverse Card #01',effect='Utility',effect_action='Ambil 2 Guard Point (GP) dari setiap tim lawan.' WHERE team=?",[teamId])
    if (name==='Kuning') db.run("UPDATE card SET name='Epic Reflect Card #01',effect_action='Damage Gigarisk yang diterima dikonversi menjadi Guard Point (GP).' WHERE team=?",[teamId])
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
  for (const [name,title] of [['Merah','Epic Reverse'],['Biru','Epic Thief'],['Kuning','Epic Swallow'],['Pink','Rare Protect'],['Pink','Normal Thief']]) {
    await page.getByRole('button',{name:`Select ${title} Card #01 for ${name}`,exact:true}).click()
  }
  await expect(page.getByRole('button',{name:'Select Legendary Second Chance Card for Hijau',exact:true})).toBeDisabled()
  await expect(page.getByRole('button',{name:'Remove Legendary Second Chance Card from Hijau',exact:true})).toHaveCount(0)
  const assign = (card: string, owner: string, target: string, slot = '') => page.getByRole('button', { name: `Assign ${card} Card #01 owned by ${owner} to ${target}${slot}`, exact: true })
  await expect(assign('Rare Protect', 'Pink', 'Pink')).toBeVisible()
  await assign('Rare Protect', 'Pink', 'Merah').click()
  await expect(page.locator('.tactical-targets').filter({ hasText: 'Steal from team' })).toHaveCount(3)
  await expect(page.getByRole('combobox',{name:/^Target /})).toHaveCount(0)
  await page.getByRole('button',{name:'Serang semua tim −2 GP',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('dua tim yang berbeda')
  await assign('Epic Thief', 'Biru', 'Pink', ' · 1').click()
  await expect(assign('Epic Thief', 'Biru', 'Pink', ' · 2')).toBeDisabled()
  await assign('Epic Thief', 'Biru', 'Hijau', ' · 2').click()
  await expect(assign('Normal Thief', 'Pink', 'Hijau')).toBeEnabled()
  await assign('Normal Thief', 'Pink', 'Hijau').click()
  await expect(page.getByRole('heading',{name:'Tim Pink · 6 GP',exact:true})).toBeVisible()
  await page.reload()
  await expect(assign('Epic Thief', 'Biru', 'Pink', ' · 1')).toHaveAttribute('aria-pressed', 'true')
  await expect(assign('Epic Thief', 'Biru', 'Hijau', ' · 2')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button',{name:'Remove Epic Reverse Card #01 from Merah',exact:true})).toBeVisible()
  const projector=await context.newPage()
  await projector.goto(`/gigarisk/${challengeId}`)
  await expect(projector.locator('.giga-row')).toHaveCount(5)
  await expect(projector.locator('.giga-effect-detail span')).toHaveCount(0)
  await expect(projector.locator('.giga-effect-detail')).toHaveCount(0)
  await projector.goto(`/card-reveal/${challengeId}`)
  await expect(projector.locator('.tactical-stage__effects')).toHaveCount(0)
  await page.getByRole('button',{name:'Card Reveal',exact:true}).click()
  await expect(projector.locator('.tactical-stage__selected .card-art').first()).toBeVisible()
  await expect(projector.locator('.tactical-stage__effects')).toHaveCount(0)
  await page.getByRole('button',{name:'Return to Tactical Phase',exact:true}).click()
  await projector.goto(`/tactical/${challengeId}`)
  await page.getByRole('button',{name:'Serang semua tim −2 GP',exact:true}).click()
  await expect(page.getByRole('button',{name:'Serangan selesai',exact:true})).toBeDisabled()
  await expect(projector).toHaveURL(`/card-reveal/${challengeId}`)
  for (const [name,gp] of [['Merah',12],['Biru',8],['Kuning',10],['Pink',4],['Hijau',1]]) {
    const team=projector.getByRole('article',{name,exact:true})
    await expect(team.locator('.tactical-stage__gp')).toContainText(`${gp} GP`)
  }
  await expect(projector.getByRole('article',{name:'Kuning',exact:true}).locator('.tactical-stage__effects')).toContainText('Swallow')
  for (const [name,asset] of [['Merah','Epic_Reverse'],['Biru','Epic_Thief'],['Kuning','Epic_Swallow']]) {
    const art=projector.getByRole('article',{name,exact:true}).locator('.card-art img')
    await expect(art).toHaveAttribute('src',new RegExp(asset))
    await expect.poll(()=>art.evaluate((image)=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  }
  await projector.locator('.tactical-stage').evaluate(async (stage)=>{
    await Promise.all(stage.getAnimations({subtree:true}).filter((animation)=>animation.effect?.getTiming().iterations!==Infinity).map((animation)=>animation.finished.catch(()=>{})))
  })
  await expect(projector.locator('.tactical-stage__log')).not.toContainText(' memilih ')
  await expect(projector.locator('.tactical-stage__log strong')).toHaveText(/^(Reverse|Swallow|Protect|Thief|Second Chance)$/)
  await expect(projector.locator('.tactical-stage__log')).not.toContainText('Guard Point (GP)')
  const banner=projector.locator('.tactical-stage__log')
  const checkSlide=async()=>{
    await expect.poll(async()=>{
      const cardId=await banner.getAttribute('data-card-id')
      return projector.evaluate(({id,cardId})=>{
        const phase=JSON.parse(localStorage.getItem(`guard-the-heart-gigarisk-completed:${id}`)!)
        const result=(phase.resolution ?? phase.strike).teams.find((team:{usedCardIds?:string[]})=>team.usedCardIds?.includes(cardId!))
        const outcomes=result?.cardEffects?.[cardId!]
        const footer=document.querySelector('.tactical-stage__log > span:last-child')?.textContent ?? ''
        return !!outcomes && footer.endsWith(`: ${outcomes.join(' · ')}`)
      },{id:challengeId,cardId})
    }).toBe(true)
  }
  await expect(projector.locator('.tactical-stage__effects .card-effect-outcome')).toHaveCount(6)
  await checkSlide()
  const previous=await banner.getAttribute('data-card-id')
  await expect(banner).not.toHaveAttribute('data-card-id',previous!,{timeout:7000})
  await checkSlide()
  await projector.screenshot({path:'test-results/corrected-card-reveal.png'})
  await expect(projector.getByRole('article',{name:'Hijau',exact:true}).locator('.tactical-stage__effects')).toContainText('Second Chance')
  await expect(projector.getByRole('article',{name:'Hijau',exact:true}).locator('.tactical-stage__selected img')).toHaveAttribute('src',/Legend_Second/)
  const redReveal=projector.getByRole('article',{name:'Merah',exact:true}).locator('.tactical-stage__effects')
  const pinkReveal=projector.getByRole('article',{name:'Pink',exact:true}).locator('.tactical-stage__effects')
  for (const panel of await projector.locator('.tactical-stage__effects').all()) await expect(panel.locator('[title="Serangan GigaRisk"]')).toHaveCount(0)
  await expect(redReveal).toContainText('Reverse')
  await expect(redReveal).not.toContainText('Protect')
  await expect(redReveal).toHaveText('Reverse')
  await expect(redReveal).not.toContainText('Ambil 1 Guard Point')
  await expect(projector.locator('.reveal-effect-detail')).toHaveCount(0)
  await expect(pinkReveal.locator('p')).toHaveText(['Protect','Thief'])
  await expect(pinkReveal).not.toContainText('Dicuri oleh')
  await expect(projector.getByRole('article',{name:'Kuning',exact:true}).locator('.tactical-stage__effects')).not.toContainText('Reverse oleh')
  await page.reload()
  await expect(page.getByRole('button',{name:'Select Legendary Second Chance Card for Hijau',exact:true})).toHaveCount(0)
  await expect(page.locator('.tactical-targets')).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Serangan selesai',exact:true})).toBeDisabled()
  await projector.goto(`/gigarisk/${challengeId}`)
  await expect(projector.getByLabel('Efek kartu Hijau',{exact:true})).toContainText('+1 Second Chance')
  await expect(projector.getByLabel('Efek kartu Merah',{exact:true})).toContainText('+2 Protect')
  await expect(projector.getByLabel('Efek kartu Pink',{exact:true})).toContainText('-2 Dicuri oleh Biru')
  await expect(projector.getByLabel('Efek kartu Biru',{exact:true})).toContainText('-1 Reverse oleh Merah')
  await expect(projector.getByLabel('Efek kartu Hijau',{exact:true})).toContainText('-1 Dicuri oleh Pink')
  await expect(projector.getByLabel('Efek kartu Kuning',{exact:true})).toContainText('+4 Swallow')
  await expect(projector.locator('.giga-row')).toHaveCount(5)
  await expect(projector.locator('.giga-effect-detail, .giga-effects strong')).toHaveCount(0)
  await expect(projector.locator('.giga-effects .is-negative').first()).toHaveCSS('color','rgb(207, 38, 51)')
  await projector.screenshot({path:'test-results/gigarisk-compact-card-effects.png'})
  await projector.goto('/gigarisk')
  await expect(projector.getByLabel('Efek kartu Hijau',{exact:true})).toContainText('+1 Second Chance')
  await projector.reload()
  await expect(projector.getByLabel('Efek kartu Biru',{exact:true})).toContainText('+2 Dicuri dari Pink')
  await page.goto('/admin/gp-transactions')
  await expect(page.getByRole('table')).toContainText('+4 Swallow')
  await expect(page.getByRole('table')).toContainText('Reverse')
  await expect(page.getByRole('table')).toContainText('Dicuri')
  // Existing completed attacks have activity logs but no owner-attributed field.
  await projector.evaluate((id) => {
    for (const prefix of ['guard-the-heart-tactical:','guard-the-heart-gigarisk-completed:']) {
      const key=prefix+id
      const phase=JSON.parse(localStorage.getItem(key)!)
      for (const team of (phase.resolution ?? phase.strike).teams) delete team.usedCardEffects
      localStorage.setItem(key,JSON.stringify(phase))
    }
  },challengeId)
  await projector.reload()
  await expect(projector.getByLabel('Efek kartu Merah',{exact:true})).toContainText('Reverse')
  await expect(projector.getByLabel('Efek kartu Merah',{exact:true})).toContainText('+2 Protect')
  await expect(projector.getByLabel('Efek kartu Pink',{exact:true})).toContainText('-2 Dicuri oleh Biru')
  await expect(projector.getByLabel('Efek kartu Pink',{exact:true})).toContainText('+1 Dicuri dari Hijau')
  await projector.goto(`/card-reveal/${challengeId}`)
  await expect(redReveal).toContainText('Reverse')
  await expect(redReveal).not.toContainText('Protect')
  await expect(projector.getByRole('article',{name:'Merah',exact:true}).locator('.tactical-stage__gp')).toContainText('12 GP')
})
