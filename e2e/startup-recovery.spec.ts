import { expect, test } from '@playwright/test'
import { challengeOne, readDatabase } from './support/cardFixture'

for (const kind of ['resolution', 'strike'] as const) {
  test(`startup preserves ${kind} history with missing team ids on a fresh browser database`, async ({ page }) => {
    const phase = {
      choices: { 'previous-laptop-team': { cards: [], skipped: true } },
      revealed: true,
      [kind]: { resolvedAt: 1, teams: [{ teamId: 'previous-laptop-team', initialGP: 5, finalGP: 3, gigaRisk: -2, effects: [], usedCards: 0 }] },
    }
    await page.addInitScript(({ id, phase }) => {
      localStorage.setItem(`guard-the-heart-tactical:${id}`, JSON.stringify(phase))
      localStorage.setItem(`guard-the-heart-gigarisk-completed:${id}`, JSON.stringify(phase))
    }, { id: challengeOne, phase })
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Teams', exact: true })).toBeVisible()
    await expect(page.getByText(/Failed to start the database/)).toHaveCount(0)
    for (let run = 0; run < 2; run++) {
      const db = await readDatabase(page)
      expect(db.exec('SELECT total_gp FROM team ORDER BY name')[0].values.map((row) => row[0])).toEqual([5, 5, 5, 5, 5])
      expect(db.exec("SELECT COUNT(*) FROM gp_transaction WHERE category='attack'")[0].values[0][0]).toBe(0)
      db.close()
      expect(await page.evaluate((id) => JSON.parse(localStorage.getItem(`guard-the-heart-gigarisk-completed:${id}`)!), challengeOne)).toEqual(phase)
      if (run === 0) {
        await page.reload()
        await expect(page.getByRole('heading', { name: 'Teams', exact: true })).toBeVisible()
      }
    }
  })
}

test('recreated SQLite with retained archives starts safely in two tabs and survives simultaneous reload', async ({ page, context }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Teams', exact: true })).toBeVisible()
  const original = await readDatabase(page)
  const previousIds = original.exec('SELECT id FROM team')[0].values.map((row) => String(row[0]))
  original.close()
  const phase = {
    choices: Object.fromEntries(previousIds.map((id) => [id, { cards: [], skipped: true }])),
    revealed: true,
    resolution: { resolvedAt: 5, teams: previousIds.map((teamId) => ({ teamId, initialGP: 5, finalGP: 3, gigaRisk: -2, effects: [], usedCards: 0 })) },
  }
  await page.evaluate(({ id, phase }) => {
    localStorage.setItem(`guard-the-heart-tactical:${id}`, JSON.stringify(phase))
    localStorage.setItem(`guard-the-heart-gigarisk-completed:${id}`, JSON.stringify(phase))
  }, { id: challengeOne, phase })
  // A same-origin static page can recreate SQLite without running app startup.
  const maintenance = await context.newPage()
  await maintenance.goto('/manifest.webmanifest')
  await page.close()
  await maintenance.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('guard-the-heart')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Test database still has an open connection'))
  }))
  const tabs = await Promise.all([context.newPage(), context.newPage()])
  await Promise.all(tabs.map((tab) => tab.goto('/admin')))
  for (let run = 0; run < 2; run++) {
    for (const tab of tabs) {
      await expect(tab.getByRole('heading', { name: 'Teams', exact: true })).toBeVisible()
      await expect(tab.getByText(/Failed to start the database/)).toHaveCount(0)
      const db = await readDatabase(tab)
      const teams = db.exec('SELECT id,total_gp FROM team')[0].values
      expect(teams).toHaveLength(5)
      expect(teams.every(([id, gp]) => !previousIds.includes(String(id)) && gp === 5)).toBe(true)
      expect(db.exec("SELECT COUNT(*) FROM gp_transaction WHERE category='attack'")[0].values[0][0]).toBe(0)
      db.close()
      expect(await tab.evaluate((id) => JSON.parse(localStorage.getItem(`guard-the-heart-gigarisk-completed:${id}`)!), challengeOne)).toEqual(phase)
    }
    if (run === 0) await Promise.all(tabs.map((tab) => tab.reload()))
  }
})
