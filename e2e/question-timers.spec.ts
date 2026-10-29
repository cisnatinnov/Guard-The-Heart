import { expect, test } from '@playwright/test'
const CHALLENGE_GAMES = [{ id: 'emoji-decode', challengeId: '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10' }, { id: 'word-assembly', challengeId: '7c4a2f96-08db-4e15-b3c7-1d9e5a80f463' }, { id: 'jaws-of-risk', challengeId: 'd5e8b317-4c62-49af-8b03-2f7c19a6d5e8' }]

test('Image Decode team questions remind without scoring and reset on the next question', async ({ page }) => {
  await page.goto(`/admin/play/emoji-decode/${CHALLENGE_GAMES[0].challengeId}`)
  await page.clock.install()
  await page.getByRole('checkbox', { name: 'Kuning', exact: true }).check()
  await page.getByRole('button', { name: 'Start team run (1)', exact: true }).click()
  const timer = page.locator('.qa-stage__timer strong')
  await page.clock.runFor(16000)
  await expect(timer).toHaveText('0s')
  await expect(page.locator('.run-panel__answers tbody tr td:last-child')).toHaveText('0')
  await page.getByRole('textbox', { name: 'Kuning answer', exact: true }).fill('Selisih Kas')
  await page.getByRole('button', { name: 'Grade this question', exact: true }).click()
  await expect(timer).toHaveText('15s')
})

test('Jaw of Risk has host verdict controls on admin and public gameplay without verdict controls', async ({page}) => {
  for (const prefix of ['/admin','']) {
    await page.goto(`${prefix}/play/jaws-of-risk/${CHALLENGE_GAMES[2].challengeId}`)
    await expect(page.getByRole('region',{name:'Crocodile bite toy'})).toBeVisible()
    await expect(page.getByRole('button',{name:/^Tooth \d+$/})).toHaveCount(14)
    await expect(page.locator('.qa-stage__timer, .run-panel__teams, .run-panel__answers')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Submit answer', exact: true })).toHaveCount(prefix ? 1 : 0)
  }
})
