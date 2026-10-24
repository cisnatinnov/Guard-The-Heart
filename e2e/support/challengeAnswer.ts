import { expect, type Page } from '@playwright/test'

/** Every physical press now follows a host verdict. Reuse an already pending press. */
export async function prepareToothPress(page: Page) {
  await expect(page.getByLabel('Crocodile bite toy')).toHaveAttribute('aria-busy', 'false')
  const pending = page.locator('.challenge-answer-controls [role="status"]')
  if (await pending.count()) return
  const wrong = page.getByRole('button', { name: 'Wrong Answer (-10)', exact: true })
  await expect(wrong).toBeEnabled()
  await wrong.click()
  await expect(pending).toBeVisible()
}
