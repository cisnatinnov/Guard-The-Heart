import { expect, type Page } from '@playwright/test'

export async function expectRewardContentsWithinFrame(page: Page) {
  const violations = await page.locator('.reward-stage__row').evaluateAll((rows) => rows.flatMap((row) => {
    const stage = row.closest('.reward-stage')!.getBoundingClientRect()
    const bounds = row.getBoundingClientRect()
    const left = stage.left + stage.width * .048
    const right = stage.left + stage.width * .9575
    return [...row.querySelectorAll('.reward-stage__medal, .reward-stage__team, .reward-stage__earned, .reward-stage__gp, .reward-stage__card, .blind-reward__card, .blind-reward p, .reward-pointer')].flatMap((node) => {
      const box = node.getBoundingClientRect()
      return box.left < left - 1 || box.right > right + 1 || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1
        ? [`${row.getAttribute('aria-label')}: ${node.getAttribute('class') || node.tagName}`] : []
    })
  }))
  expect(violations, 'Reward content must stay inside its row and the artwork frame').toEqual([])
}
