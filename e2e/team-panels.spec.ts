import { expect, test } from '@playwright/test'
import { challengeOne, seedCards, readDatabase } from './support/cardFixture'
import { expectRewardContentsWithinFrame } from './support/layoutBounds'

test('shared team panels show current GP separately from rewards and leave room for Giliran', async ({ page, context }) => {
  await seedCards(page, challengeOne)
  await page.goto(`/admin/scoreboard/${challengeOne}`)
  await expect.poll(async () => {
    const db = await readDatabase(page)
    const balance = Number(db.exec("SELECT total_gp FROM team WHERE name='Biru'")[0].values[0][0])
    db.close()
    return balance
  }).toBe(8)
  const gp = 8
  const reward = await context.newPage()
  await reward.goto(`/rewards/${challengeOne}`)
  const row = reward.locator('.reward-stage__row[aria-label="Biru"]')
  await expect(row.locator('.team-gp-badge')).toHaveAttribute('aria-label', `Biru: ${gp} GP`)
  await expect(row.locator('.reward-stage__bonus')).toHaveText('Hadiah +3 GP')
  const scoreboard = await context.newPage()
  await scoreboard.goto(`/scoreboard/${challengeOne}`)
  await expect(scoreboard.locator('.team-gp-badge').filter({ hasText: 'Biru' })).toHaveAttribute('aria-label', `Biru: ${gp} GP`)
  await expect(scoreboard.getByText('No entries for this challenge yet.', { exact: true })).toHaveCount(0)
  await page.goto('/admin/timer')
  await page.getByRole('button', { name: 'Biru', exact: true }).click()
  const timer = await context.newPage()
  await timer.goto('/timer')
  await expect(timer.locator('.team-gp-badge').filter({ hasText: 'Biru' })).toHaveAttribute('aria-label', `Biru: ${gp} GP`)
  for (const size of [{width:1366,height:600},{width:768,height:1024},{width:390,height:844}]) {
    await reward.setViewportSize(size)
    await expectRewardContentsWithinFrame(reward)
    await timer.setViewportSize(size)
    const team = (await timer.locator('.event-timer__team[aria-current="step"]').boundingBox())!
    const turn = (await timer.locator('.event-timer__turn').boundingBox())!
    const panel = (await timer.locator('.event-timer__teams').boundingBox())!
    expect(turn.y).toBeGreaterThan(team.y + team.height)
    expect(turn.y + turn.height).toBeLessThan(panel.y + panel.height)
  }
  await reward.setViewportSize({width:1366,height:768})
  await reward.screenshot({path:'test-results/shared-reward-gp.png'})
  await timer.setViewportSize({width:1366,height:768})
  await timer.screenshot({path:'test-results/shared-timer-gp.png'})
})
