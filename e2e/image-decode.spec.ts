import { expect, test } from '@playwright/test'

test('Image Decode advances after a wrong answer and after time runs out', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })

  await page.clock.install()
  await page.getByRole('navigation', { name: 'Admin views' }).getByRole('link', { name: 'Challenges', exact: true }).click()
  await page.locator('.card--locked', { hasText: 'Image Decode' }).getByRole('button', { name: 'Play' }).click()

  await page.getByText('Play solo instead', { exact: true }).click()
  const answerInput = page.getByRole('textbox', { name: 'Decoded answer' })
  await answerInput.fill('not the answer')
  await page.getByRole('button', { name: 'Decode', exact: true }).click()
  await expect(page.locator('.alert--error')).toContainText('Not this time')

  await expect(page.locator('.qa-stage__answer')).toContainText('Rekening')
  await page.screenshot({ path: 'test-results/image-decode-question.png', fullPage: true })
  await page.getByRole('button', { name: 'Next →' }).click()
  await expect(page.locator('.qa-stage__hint')).toHaveText('1 Kata')
  await expect(page.getByText('Question 2 of 11')).toBeVisible()
  await expect(answerInput).toBeEnabled()
  await answerInput.fill('SLIK')
  await page.getByRole('button', { name: 'Decode', exact: true }).click()
  await expect(page.locator('.alert--ok')).toContainText('Correct')

  await page.getByRole('button', { name: 'Next →' }).click()
  await page.clock.runFor(30_100)
  await expect(page.locator('.alert--error')).toContainText('Time ran out')

  await page.getByRole('button', { name: 'Next →' }).click()
  await expect(page.getByText('Question 4 of 11')).toBeVisible()
  await expect(answerInput).toBeEnabled()
  await expect(page.locator('.emoji-timer__value')).toHaveText('30s')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(answerInput).toBeVisible()
  const header = await page.locator('.qa-stage__header').boundingBox()
  expect(header?.height).toBeLessThan(150)
  const clue = await page.locator('.qa-stage__question').boundingBox()
  expect(clue?.y).toBeGreaterThan((header?.y ?? 0) + (header?.height ?? 0))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/image-decode-mobile.png', fullPage: true })
})
