import { expect, test } from '@playwright/test'

const decode = '/admin/play/emoji-decode/9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'
const matching = '/admin/play/word-assembly/7c4a2f96-08db-4e15-b3c7-1d9e5a80f463'
type SavedRun = { gameId: string; run?: { runs: { team: string }[] } }
const jaw = '/admin/play/jaws-of-risk/d5e8b317-4c62-49af-8b03-2f7c19a6d5e8'

test('Image Decode automatically includes every active team and team names select the turn', async ({ page, context }) => {
  await page.goto(decode)
  await expect(page.locator('.challenge-turn-order li')).toHaveCount(5)
  await expect(page.getByRole('button', { name: /Start team run/ })).toHaveCount(0)
  await expect(page.locator('.run-panel__teams input[type=checkbox]')).toHaveCount(0)
  await page.getByRole('region', { name: 'Challenge turn order' }).getByRole('button', { name: /2\. Merah/ }).click()
  await expect(page.getByRole('textbox', { name: 'Merah answer', exact: true })).toBeEnabled()
  const projector = await context.newPage()
  await projector.goto(decode.replace('/admin', ''))
  await expect(projector.locator('.decode-stage')).toContainText('Merah')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Merah answer', exact: true })).toBeEnabled()
  await page.getByRole('textbox', { name: 'Merah answer', exact: true }).fill('Selisih Kas')
  await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
  await expect(page.locator('.run-panel__title')).toContainText('question 2 of 10')
  await expect(projector.locator('.workbook-emoji-clue')).toContainText('S +')
})

test('automatic Image Decode keeps the selectable ten-question limit', async ({ page }) => {
  await page.goto(decode)
  await expect(page.locator('.challenge-turn-order li')).toHaveCount(5)
  await page.locator('.question-plan > summary').click()
  await page.locator('.question-picker > summary').click()
  await expect(page.locator('.question-picker input').nth(10)).toBeDisabled()
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click()
  await page.locator('.question-picker input').nth(1).check()
  await page.locator('.question-picker input').nth(10).check()
  await page.getByRole('button', { name: 'Apply selected questions', exact: true }).click()
  await expect(page.locator('.run-panel__title')).toContainText('question 1 of 2')
  await expect(page.locator('.workbook-emoji-clue')).toContainText('S +')
})

test('saved runs with fewer teams automatically include the remaining active teams', async ({ page }) => {
  for (const route of [decode, matching]) {
    await page.goto(route)
    await expect.poll(() => page.evaluate((gameId) => {
      const entries = JSON.parse(localStorage.getItem('guard-the-heart-active-challenge-runs') ?? '{}') as Record<string, SavedRun>
      return Object.values(entries).some((entry) => entry.gameId === gameId && entry.run?.runs.length === 5)
    }, route === decode ? 'emoji-decode' : 'word-assembly')).toBe(true)
    await page.evaluate(() => {
      const key = 'guard-the-heart-active-challenge-runs'
      const entries = JSON.parse(localStorage.getItem(key)!) as Record<string, SavedRun>
      for (const entry of Object.values(entries)) if (entry.run) entry.run.runs = entry.run.runs.slice(0, 1)
      localStorage.setItem(key, JSON.stringify(entries))
    })
    await page.reload()
    if (route === decode) await expect(page.locator('.challenge-turn-order li')).toHaveCount(5)
    else await expect(page.locator('.challenge-score')).toHaveCount(5)
  }
})

test('Matching Cards clicks grade options, reminders never score, and correct answers unlock bonus pairs', async ({ page, context }) => {
  await page.goto(matching)
  await expect(page.locator('.challenge-score')).toHaveCount(5)
  await expect(page.getByRole('button', { name: /Start team run/ })).toHaveCount(0)
  await page.clock.install()
  const projector = await context.newPage()
  await projector.goto(matching.replace('/admin', ''))
  await page.getByRole('button', { name: 'Timer', exact: true }).click()
  await page.clock.runFor(16000)
  await expect(page.getByRole('timer', { name: 'Turn reminder', exact: true })).toHaveText('0s')
  await expect(page.locator('.challenge-score strong')).toHaveText(['0', '0', '0', '0', '0'])
  await page.getByRole('button', { name: /Tolak \(Deny\)/ }).click()
  await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
  await page.getByRole('button', { name: 'Show cards', exact: true }).click()
  await expect(page.locator('.challenge-score').filter({ hasText: 'Kuning' }).locator('strong')).toHaveText('10')
  await expect(projector.locator('.tile--revealed')).toHaveCount(20)
  await page.clock.runFor(5100)
  await page.locator('.tile[data-pair="word-1"]').nth(0).click()
  await page.locator('.tile[data-pair="word-1"]').nth(1).click()
  await expect(projector.locator('.tile--matched')).toHaveCount(2)
  await expect(projector.locator('.challenge-score').filter({ hasText: 'Kuning' }).locator('strong')).toHaveText('15')
  await page.reload()
  await expect(page.locator('.tile--matched')).toHaveCount(2)
})

test('Jaw correct answers choose opponents afterwards and bites eliminate them across reload and projector', async ({ page, context }) => {
  await page.goto(jaw)
  await page.clock.install()
  const settings = page.getByRole('group', { name: 'Biting teeth', exact: true })
  for (const box of await settings.getByRole('checkbox').all()) await box.uncheck()
  await settings.getByRole('checkbox', { name: 'Biting tooth 1', exact: true }).check()
  await page.getByRole('button', { name: 'Apply biting teeth', exact: true }).click()
  const projector = await context.newPage()
  await projector.goto(jaw.replace('/admin', ''))
  await page.getByRole('button', { name: 'Timer', exact: true }).click()
  await page.clock.runFor(16000)
  await expect(page.getByRole('timer', { name: 'Turn reminder', exact: true })).toHaveText('0s')
  await page.getByRole('button', { name: /Hentikan penggunaan/ }).click()
  await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Choose opponent', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tooth 1', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Show dragon', exact: true }).click()
  await page.getByRole('group', { name: 'Choose opponent', exact: true }).getByRole('button', { name: 'Merah', exact: true }).click()
  await expect(projector.locator('.challenge-answer-controls [role=status]')).toContainText('Merah')
  await page.getByRole('button', { name: 'Tooth 1', exact: true }).click()
  for (const screen of [page, projector]) await expect(screen.locator('.challenge-score').filter({ hasText: 'Merah' })).toContainText('OUT · deactivated')
  await expect(page.getByRole('button', { name: 'Tooth 2', exact: true })).toBeDisabled()
  await page.clock.runFor(4500)
  await page.reload()
  await expect(page.getByRole('region', { name: 'Challenge turn order' }).getByRole('button', { name: /Merah.*OUT/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Next question', exact: true }).click()
  await expect(page.locator('.quiz-option').first()).toBeEnabled()
})

test('wrong Jaw answer requires its own team to press teeth', async ({ page }) => {
  await page.goto(jaw)
  await page.getByRole('button', { name: /Lanjutkan selama nama nasabah dihapus/ }).click()
  await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
  await expect(page.locator('.challenge-answer-controls [role=status]')).toContainText('Kuning')
  await expect(page.getByRole('group', { name: 'Choose opponent', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tooth 1', exact: true })).toBeEnabled()
  await expect(page.locator('.challenge-score').filter({ hasText: 'Kuning' }).locator('strong')).toHaveText('-10')
})

test('game layouts remain themed and within the viewport on host and projector', async ({ page }) => {
  for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript((value) => localStorage.setItem('guard-the-heart-theme', value), theme)
    for (const route of [decode, matching, jaw, decode.replace('/admin', ''), matching.replace('/admin', ''), jaw.replace('/admin', '')]) {
      await page.goto(route)
      await expect(page.locator('.decode-stage,.workbook-quiz').first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `.validation.tmp/auto-${theme}-${width}-${route.replaceAll('/', '_')}.png`, fullPage: true })
    }
  }
})
