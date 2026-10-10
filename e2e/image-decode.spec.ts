import { expect, test } from '@playwright/test'

test('Image Decode advances after a wrong answer and after time runs out', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })

  await page.clock.install()
  await page.getByRole('navigation', { name: 'Admin views' }).getByRole('link', { name: 'Challenges', exact: true }).click()
  await page.locator('.card--locked', { hasText: 'Image Decode' }).getByRole('button', { name: 'Play' }).click()

  const answerInput = page.getByRole('textbox', { name: 'Decoded answer' })
  await answerInput.fill('not the answer')
  await page.getByRole('button', { name: 'Decode', exact: true }).click()
  await expect(page.locator('.alert--error')).toContainText('Not this time')

  await page.getByRole('button', { name: 'Next →' }).click()
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
})
