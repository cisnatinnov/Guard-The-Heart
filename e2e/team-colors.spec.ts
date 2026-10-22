import { expect, test } from '@playwright/test'

const colors = { merah:'rgb(255, 36, 36)', biru:'rgb(67, 179, 255)', kuning:'rgb(255, 208, 57)', hijau:'rgb(90, 255, 125)', pink:'rgb(255, 21, 133)' }
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
