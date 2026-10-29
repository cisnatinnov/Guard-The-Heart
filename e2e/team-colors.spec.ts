import { expect, test } from '@playwright/test'

const colors = { merah:'rgb(222, 160, 164)', biru:'rgb(148, 187, 220)', kuning:'rgb(220, 199, 132)', hijau:'rgb(153, 197, 172)', pink:'rgb(213, 165, 191)' }
test('team identity colors match the shared palette on admin and public screens', async ({ page }) => {
  const screens = [
    ['scoreboard', '.team-pill--'], ['leaderboard', '.team-pill--'],
    ['turn-order', '.team-pill--'], ['gigarisk', '.team-pill--'], ['heart-of-awareness', '.team-pill--'],
    ['tactical', '.tactical-colour--'], ['card-reveal', '.tactical-colour--'],
    ['timer', '.event-timer__team.team-colour--'], ['play/word-assembly', '.flipping-presentation__teams .team-colour--'],
  ]
  for (const prefix of ['', '/admin']) for (const [route, selector] of screens) {
    if (prefix && ['tactical', 'card-reveal', 'play/word-assembly'].includes(route)) continue
    await page.goto(`${prefix}/${route}`)
    for (const [name, color] of Object.entries(colors)) {
      const labels = page.locator(`${selector}${name}${selector === '.tactical-colour--' ? ' h2' : selector === '.event-timer__team.team-colour--' ? ' .team-pill' : ''}`)
      await expect(labels.first(), `${prefix}/${route}: ${name}`).toBeVisible()
      expect(await labels.evaluateAll((nodes) => [...new Set(nodes.map((node) => getComputedStyle(node).backgroundColor))])).toEqual([color])
    }
  }
  await page.goto('/admin/timer')
  await page.getByRole('button', { name:'Biru', exact:true }).click()
  await expect(page.locator('.event-timer__team.is-active .team-pill')).toHaveCSS('background-color', colors.biru)
  await page.goto('/timer')
  await expect(page.locator('.event-timer__team.is-active .team-pill')).toHaveCSS('background-color', colors.biru)
})
