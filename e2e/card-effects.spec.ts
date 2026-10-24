import { expect, test } from '@playwright/test'
import initSqlJs from 'sql.js'
import { resolve } from 'node:path'

test('effect animations follow revealed cards and GigaRisk shows final GP only after attack', async ({ page, context }) => {
  const id = '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'
  await page.goto(`/admin/tactical/${id}`)
  await expect(page.getByRole('button', { name: 'Skip Biru', exact: true })).toBeVisible()
  const read = () => page.evaluate(() => new Promise<number[]>((accept, reject) => {
    const request = indexedDB.open('guard-the-heart', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('sqlite', 'readonly'), get = tx.objectStore('sqlite').get('database')
      get.onsuccess = () => accept(Array.from(new Uint8Array(get.result ?? [])))
      get.onerror = () => reject(get.error)
      tx.oncomplete = () => db.close()
    }
  }))
  const SQL = await initSqlJs({ locateFile: (file) => resolve('node_modules/sql.js/dist', file) })
  await expect.poll(async () => (await read()).length).toBeGreaterThan(0)
  const db = new SQL.Database(new Uint8Array(await read()))
  const cards = [
    ['Merah', 'Normal Shield Card #01', 'shield'], ['Biru', 'Rare Protect Card #01', 'protect'],
    ['Kuning', 'Epic Swallow Card #01', 'swallow'], ['Pink', 'Normal Heal Card #01', 'heal'],
  ]
  const teamIds = Object.fromEntries(['Merah', 'Biru', 'Kuning', 'Pink', 'Hijau'].map((name) => [name, String(db.exec(`SELECT id FROM team WHERE name='${name}'`)[0].values[0][0])]))
  for (const [team, name, cardId] of cards) {
    db.run('UPDATE card SET team=?,challenge=? WHERE name=?', [teamIds[team], id, name])
    db.run('INSERT INTO team_card (id,name,type,effect,effect_action,icon,team,challenge_point,createdAt,updatedAt) SELECT ?,name,type,effect,effect_action,icon,team,challenge_point,createdAt,updatedAt FROM card WHERE name=?', [cardId, name])
  }
  const bytes = Array.from(db.export())
  db.close()
  await page.evaluate((bytes) => new Promise<void>((accept, reject) => {
    const request = indexedDB.open('guard-the-heart', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('sqlite', 'readwrite')
      tx.objectStore('sqlite').put(new Uint8Array(bytes), 'database')
      tx.oncomplete = () => { db.close(); accept() }
      tx.onerror = () => reject(tx.error)
    }
  }), bytes)
  await page.reload()
  const projector = await context.newPage()
  await projector.goto(`/gigarisk/${id}`)
  await expect(projector.locator('.giga-waiting')).toHaveCount(5)
  await expect(projector.locator('.giga-gp, .giga-health, .giga-impact')).toHaveCount(0)
  for (const [team, name] of cards) await page.getByRole('button', { name: `Select ${name} for ${team}`, exact: true }).click()
  await page.getByRole('button', { name: 'Assign Rare Protect Card #01 owned by Biru to Hijau', exact: true }).click()
  await page.getByRole('button', { name: 'Skip Hijau', exact: true }).click()
  await expect(projector.locator('.giga-gp')).toHaveCount(0)
  await page.getByRole('button', { name: 'Card Reveal', exact: true }).click()
  await expect(projector.locator('.tactical-stage__log strong')).toHaveText(/^(Protect|Heal|Shield|Swallow)$/)
  const phaseBeforeHover = await projector.evaluate((id) => localStorage.getItem(`guard-the-heart-tactical:${id}`), id)
  const teamGP = (name: string) => projector.locator('.tactical-stage__team').filter({ has: projector.getByRole('heading', { name: `Team ${name}`, exact: true }) }).locator('.tactical-stage__gp')
  for (const [team, , cardId] of cards) {
    await projector.locator(`.tactical-stage__played-card[data-card-id="${cardId}"]`).hover()
    await expect(projector.locator('.tactical-stage__log strong')).toHaveText(cardId[0].toUpperCase() + cardId.slice(1))
    const to = cardId === 'shield' ? '4' : cardId === 'protect' ? '5' : cardId === 'swallow' ? '9' : '7'
    await expect(teamGP(team)).toHaveAttribute('data-gp-to', to)
    await expect(teamGP(team).locator('.tactical-stage__gp-number')).toHaveText(`${to} GP`)
    if (cardId === 'protect') await expect(teamGP('Hijau')).toHaveAttribute('data-gp-to', '5')
    await projector.mouse.move(0, 0)
    await expect(projector.locator('.tactical-stage__gp-change')).toHaveCount(0)
    await expect(teamGP(team).locator('.tactical-stage__gp-number')).toHaveText(cardId === 'heal' ? '7 GP' : '5 GP')
  }
  expect(await projector.evaluate((id) => localStorage.getItem(`guard-the-heart-tactical:${id}`), id)).toBe(phaseBeforeHover)
  for (const [, , effect] of cards) {
    const animation = projector.locator(`.card-effect-animation[data-effect="${effect}"] i`).first()
    await expect(animation).toBeAttached()
    expect(await animation.evaluate((element) => getComputedStyle(element).animationName)).not.toBe('none')
  }
  await projector.setViewportSize({ width: 1280, height: 720 })
  await projector.screenshot({ path: 'test-results/card-effect-animations.png', animations: 'disabled' })
  await projector.emulateMedia({ reducedMotion: 'reduce' })
  await expect(projector.locator('.card-effect-animation i').first()).toHaveCSS('animation-name', 'none')
  await page.getByRole('button', { name: 'Attack all teams −2 GP', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Attack complete', exact: true })).toBeDisabled()
  await projector.locator('.tactical-stage__played-card[data-card-id="heal"]').focus()
  await expect(teamGP('Pink')).toHaveAttribute('data-gp-from', '3')
  await expect(teamGP('Pink')).toHaveAttribute('data-gp-to', '5')
  await expect(teamGP('Pink').locator('.tactical-stage__gp-number')).toHaveText('5 GP')
  await projector.keyboard.press('Escape')
  await expect(projector.locator('.tactical-stage__gp-change')).toHaveCount(0)
  await projector.goto(`/gigarisk/${id}`)
  for (const [name, gp, impact] of [['Merah', '4', '−1'], ['Biru', '5', '0'], ['Kuning', '9', '+4'], ['Pink', '5', '−2'], ['Hijau', '5', '0']]) {
    await expect(projector.getByLabel(`GP after attack ${name}`, { exact: true }).locator('strong')).toHaveText(gp)
    await expect(projector.getByLabel(`Attack outcome ${name}`, { exact: true })).toHaveText(impact)
  }
  await expect(projector.getByLabel('Card effects Pink', { exact: true })).toContainText('+2 Heal')
  await expect(projector.locator('.giga-arrow, .giga-health')).toHaveCount(0)
  await expect(projector.locator('img.gp-shield-icon')).toHaveCount(5)
  await expect(projector.locator('.giga-impact.giga-burst')).toHaveCount(5)
  await expect(projector.getByLabel('Attack outcome Merah', { exact: true })).toHaveAttribute('title', 'Shield · −1 GP')
  // Mixed-width values must not move the icon, number slot or GP label.
  await projector.locator('.giga-gp strong').evaluateAll((numbers) => {
    numbers.forEach((number, index) => { number.textContent = ['5', '9', '10', '4', '100'][index] })
  })
  for (const width of [1280, 1920, 768, 390]) {
    await projector.setViewportSize({ width, height: Math.round(width * 9 / 16) })
    const layout = await projector.locator('.giga-row').evaluateAll((rows) => rows.every((row) => {
      const bounds = row.getBoundingClientRect()
      const cells = [...row.children].map((cell) => cell.getBoundingClientRect())
      return cells.every((cell, index) => cell.left >= bounds.left && cell.right <= bounds.right && cell.top >= bounds.top && cell.bottom <= bounds.bottom && (index === 0 || cell.left >= cells[index - 1].right))
    }))
    expect(layout).toBe(true)
    const positions = await projector.locator('.giga-gp').evaluateAll((totals) => totals.map((total) => [...total.children].map((child) => {
      const bounds = child.getBoundingClientRect()
      return { left: bounds.left, right: bounds.right, width: bounds.width }
    })))
    for (const row of positions) for (const [index, cell] of row.entries()) {
      expect(Math.abs(cell.left - positions[0][index].left)).toBeLessThan(1)
      expect(Math.abs(cell.width - positions[0][index].width)).toBeLessThan(1)
      if (index > 0) expect(cell.left).toBeGreaterThanOrEqual(row[index - 1].right)
    }
  }
  await projector.setViewportSize({ width: 1280, height: 720 })
  await projector.screenshot({ path: 'test-results/gigarisk-final-gp.png' })
  await projector.reload()
  await expect(projector.getByLabel('GP after attack Kuning', { exact: true }).locator('strong')).toHaveText('9')
})
