import { test, expect } from '@playwright/test'

test('GigaRisk records GP transactions and preserves balances after reload', async ({ page }) => {
  const id = '9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'
  await page.goto(`/admin/tactical/${id}`)
  for (const name of ['Merah', 'Biru', 'Kuning', 'Pink', 'Hijau']) {
    await page.getByRole('button', { name: `Skip ${name}`, exact: true }).click()
  }
  await page.goto(`/admin/gigarisk/${id}`)
  await page.getByRole('button', { name: 'Serang semua tim −2 GP', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Serangan selesai', exact: true })).toBeDisabled()
  await page.goto('/admin/gp-transactions')
  const ledger = page.getByRole('table', { name: 'Transaksi GP' })
  await expect(ledger.locator('tbody tr').filter({ hasText: 'Serangan GigaRisk' })).toHaveCount(5)
  await expect(ledger).toContainText('−2 GP')
  await page.reload()
  await expect(ledger.locator('tbody tr').filter({ hasText: 'Serangan GigaRisk' })).toHaveCount(5)
  await page.goto(`/card-reveal/${id}`)
  await expect(page.locator('.tactical-stage__gp').filter({ hasText: '3 GP' })).toHaveCount(5)
  await page.screenshot({ path: 'test-results/card-reveal-after-attack.png' })
})
