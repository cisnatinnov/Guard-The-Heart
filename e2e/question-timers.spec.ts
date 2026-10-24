import { expect, test } from '@playwright/test'
const CHALLENGE_GAMES = [{ id: 'emoji-decode', challengeId: '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10' }, { id: 'word-assembly', challengeId: '7c4a2f96-08db-4e15-b3c7-1d9e5a80f463' }, { id: 'jaws-of-risk', challengeId: 'd5e8b317-4c62-49af-8b03-2f7c19a6d5e8' }]

test('Image Decode solo questions expire once at 15 seconds and reset for the next question', async ({ page }) => {
  await page.goto('/admin/challenges')
  const time = new Date()
  await page.clock.install({time})
  await page.clock.pauseAt(new Date(time.getTime()+1000))
  await page.goto(`/admin/play/emoji-decode/${CHALLENGE_GAMES[0].challengeId}`)
  await page.getByText('Play solo instead',{exact:true}).click()
  const timer=page.locator('.qa-stage__timer strong')
  const score=page.locator('.stat',{has:page.locator('.stat__label',{hasText:/^Score$/})}).locator('.stat__value')
  await expect(timer).toHaveText('15s')
  await page.clock.runFor(14900)
  await expect(timer).toHaveText('1s')
  await expect(score).toHaveText('0/110')
  await page.clock.runFor(100)
  await expect(timer).toHaveText('0s')
  await expect(score).toHaveText('-10/110')
  await page.clock.runFor(15000)
  await expect(score).toHaveText('-10/110')
  await page.getByRole('button',{name:'Next →',exact:true}).click()
  await expect(timer).toHaveText('15s')
})

test('Jaw of Risk has host verdict controls on admin and a read-only public display', async ({page}) => {
  for (const prefix of ['/admin','']) {
    await page.goto(`${prefix}/play/jaws-of-risk/${CHALLENGE_GAMES[2].challengeId}`)
    await expect(page.getByRole('region',{name:'Crocodile bite toy'})).toBeVisible()
    await expect(page.getByRole('button',{name:/^Tooth \d+$/})).toHaveCount(14)
    await expect(page.locator('.qa-stage__timer, .run-panel__teams, .run-panel__answers')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Wrong Answer (-10)', exact: true })).toHaveCount(prefix ? 1 : 0)
  }
})
