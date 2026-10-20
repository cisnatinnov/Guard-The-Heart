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
