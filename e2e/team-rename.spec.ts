import { expect, test } from '@playwright/test'
import { challengeOne, readDatabase, seedCards } from './support/cardFixture'

const colours = { Merah: 'rgb(255, 36, 36)', Biru: 'rgb(67, 179, 255)', Kuning: 'rgb(255, 208, 57)', Hijau: 'rgb(90, 255, 125)', Pink: 'rgb(255, 21, 133)' }

test('renamed teams keep colours, scores, cards and GP across features, tabs and reloads', async ({ page, context }) => {
  await seedCards(page, challengeOne, [['Biru', 'Normal Heal Card #01']])
  await expect(page.getByRole('button', { name: 'Skip Biru', exact: true })).toBeVisible()
  const before = await readDatabase(page)
  const originalTeams = before.exec('SELECT id,colour,total_gp FROM team ORDER BY id')[0].values
  const originalScores = before.exec('SELECT id,team,score FROM challenge_point ORDER BY id')[0].values
  const originalCards = before.exec('SELECT id,team FROM team_card ORDER BY id')[0].values
  before.close()
  const projector = await context.newPage()
  await projector.goto('/scoreboard')
  await expect(projector.locator('.team-pill--biru').first()).toContainText('Biru')
  await page.goto('/admin')
  for (const [name, colour] of Object.entries(colours)) {
    const card = page.locator('.team-card', { has: page.locator('.card__title', { hasText: new RegExp(`^${name}$`) }) })
    await card.getByRole('button', { name: 'Rename', exact: true }).click()
    await page.getByRole('textbox', { name: `Rename ${name}`, exact: true }).fill(`Guardians ${name}`)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const renamed = page.locator('.team-card', { has: page.locator('.card__title', { hasText: `Guardians ${name}` }) })
    await expect(renamed.locator('.card__title')).toHaveCSS('background-color', colour)
    await expect(renamed.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled()
    await expect(projector.locator(`.team-pill--${name.toLowerCase()}`).first()).toContainText(`Guardians ${name}`)
  }
  // Duplicate and empty names cannot overwrite an existing identity.
  const renamedBlue = page.locator('.team-card', { hasText: 'Guardians Biru' })
  await renamedBlue.getByRole('button', { name: 'Rename', exact: true }).click()
  await page.getByRole('textbox', { name: 'Rename Guardians Biru', exact: true }).fill('Guardians Merah')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.alert--error')).toContainText('already exists')
  await page.getByRole('textbox', { name: 'Rename Guardians Biru', exact: true }).fill('   ')
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  for (let reload = 0; reload < 2; reload++) {
    await page.reload()
    await expect(page.locator('.team-card')).toHaveCount(5)
    const saved = await readDatabase(page)
    expect(saved.exec('SELECT id,colour,total_gp FROM team ORDER BY id')[0].values).toEqual(originalTeams)
    expect(saved.exec('SELECT id,team,score FROM challenge_point ORDER BY id')[0].values).toEqual(originalScores)
    expect(saved.exec('SELECT id,team FROM team_card ORDER BY id')[0].values).toEqual(originalCards)
    saved.close()
  }

  const screens = [
    ['scoreboard', '.team-pill--'], ['leaderboard', '.team-pill--'],
    ['turn-order', '.team-pill--'], ['gigarisk', '.team-pill--'], ['heart-of-awareness', '.team-pill--'],
    ['tactical', '.tactical-colour--'], ['card-reveal', '.tactical-colour--'],
    ['timer', '.event-timer__team.team-colour--'], ['play/word-assembly', '.flipping-presentation__teams .team-colour--'],
    [`rewards/${challengeOne}`, '.team-pill--'],
  ]
  for (const prefix of ['', '/admin']) for (const [route, selector] of screens) {
    if (prefix && ['tactical', 'card-reveal', 'play/word-assembly'].includes(route)) continue
    await page.goto(`${prefix}/${route}`)
    for (const [name, colour] of Object.entries(colours)) {
      const label = page.locator(`${selector}${name.toLowerCase()}${selector === '.tactical-colour--' ? ' h2' : selector === '.event-timer__team.team-colour--' ? ' .team-pill' : ''}`).first()
      await expect(label, `${prefix}/${route}: ${name}`).toContainText(`Guardians ${name}`)
      await expect(label).toHaveCSS('background-color', colour)
    }
  }
  await page.goto('/admin/timer')
  await page.getByRole('button', { name: 'Guardians Biru', exact: true }).click()
  await projector.goto('/timer')
  await expect(projector.locator('.event-timer__team.is-active .team-pill')).toContainText('Guardians Biru')
  await expect(projector.locator('.event-timer__team.is-active .team-pill')).toHaveCSS('background-color', colours.Biru)
})

test('existing saved games gain permanent colours without losing teams, scores or cards', async ({ page }) => {
  await seedCards(page, challengeOne, [['Biru', 'Normal Heal Card #01']])
  await expect(page.getByRole('button', { name: 'Skip Biru', exact: true })).toBeVisible()
  const db = await readDatabase(page)
  const teams = db.exec('SELECT id,name,total_gp FROM team ORDER BY id')[0].values
  const scores = db.exec('SELECT id,team,score FROM challenge_point ORDER BY id')[0].values
  const cards = db.exec('SELECT id,team FROM team_card ORDER BY id')[0].values
  db.run('ALTER TABLE team DROP COLUMN colour')
  const bytes = Array.from(db.export())
  db.close()
  await page.goto('/manifest.webmanifest')
  await page.evaluate((bytes) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('guard-the-heart', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('sqlite', 'readwrite')
      tx.objectStore('sqlite').put(new Uint8Array(bytes), 'database')
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
  }), bytes)
  await page.goto('/admin')
  await expect(page.locator('.team-card')).toHaveCount(5)
  const migrated = await readDatabase(page)
  expect(migrated.exec('SELECT id,name,total_gp FROM team ORDER BY id')[0].values).toEqual(teams)
  expect(migrated.exec('SELECT id,team,score FROM challenge_point ORDER BY id')[0].values).toEqual(scores)
  expect(migrated.exec('SELECT id,team FROM team_card ORDER BY id')[0].values).toEqual(cards)
  expect(migrated.exec('SELECT name,colour FROM team ORDER BY name')[0].values).toEqual(Object.keys(colours).sort().map((name) => [name, name.toLowerCase()]))
  migrated.close()
})
