import { expect, test } from '@playwright/test'
const CHALLENGE_GAMES = [
 {challengeId:'9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'},
 {challengeId:'7c4a2f96-08db-4e15-b3c7-1d9e5a80f463'},
 {challengeId:'d5e8b317-4c62-49af-8b03-2f7c19a6d5e8'},
]

test('default teams can be manually deactivated and restored without losing the choice on reload',async({page})=>{
 await page.goto('/admin')
 const row=page.locator('.card').filter({has:page.locator('.card__title',{hasText:/^Merah$/})})
 await row.getByRole('button',{name:'Deactivate',exact:true}).click()
 await expect(row).toHaveCount(0)
 await page.getByLabel('Filter teams by status').selectOption('inactive')
 await expect(row.getByRole('button',{name:'Activate',exact:true})).toBeEnabled()
 await page.reload()
 await page.getByLabel('Filter teams by status').selectOption('inactive')
 await expect(row).toContainText('inactive')
 await row.getByRole('button',{name:'Activate',exact:true}).click()
 await page.getByLabel('Filter teams by status').selectOption('active')
 await expect(row).toContainText('active')
})

test('inactive teams stay on both leaderboards as OUT and reactivate live', async ({ page, context }) => {
 await page.goto('/admin')
 const publicPage = await context.newPage()
 await publicPage.goto('/leaderboard')
 const publicRows = publicPage.locator('.ranking-table tbody tr')
 const publicTeam = publicRows.filter({ hasText: 'Merah' })
 await expect(publicRows).toHaveCount(5)
 await expect(publicTeam.locator('.out-label')).toHaveCount(0)
 const card = page.locator('.card').filter({ has: page.locator('.card__title', { hasText: /^Merah$/ }) })
 await card.getByRole('button', { name: 'Deactivate', exact: true }).click()
 await expect(publicTeam).toHaveClass('is-out')
 await expect(publicTeam.locator('.out-label')).toHaveText('OUT')
 await expect(publicTeam.locator('td').nth(5).locator('strong')).toHaveText('5')
 await page.goto('/admin/leaderboard')
 const rows = page.locator('.ranking-table tbody tr')
 const team = rows.filter({ hasText: 'Merah' })
 await expect(rows).toHaveCount(5)
 await expect(team.locator('.out-label')).toHaveText('OUT')
 await expect(team).toHaveCSS('opacity', '0.55')
 await publicPage.reload()
 await expect(publicTeam.locator('.out-label')).toHaveText('OUT')
 await page.goto('/admin')
 await page.getByLabel('Filter teams by status').selectOption('inactive')
 await card.getByRole('button', { name: 'Activate', exact: true }).click()
 await expect(publicTeam).not.toHaveClass('is-out')
 await expect(publicTeam.locator('.out-label')).toHaveCount(0)
 await page.goto('/admin/leaderboard')
 await expect(team.locator('.out-label')).toHaveCount(0)
})
test('three skipped attacks eliminate teams, preserve reveal history and persist inactive status',async({page,context})=>{
 const names=['Merah','Biru','Kuning','Pink','Hijau']
 const projector=await context.newPage()
 for (const game of CHALLENGE_GAMES) {
  await page.goto(`/admin/tactical/${game.challengeId}`)
  for (const name of names) await page.getByRole('button',{name:`Skip ${name}`,exact:true}).click()
  await projector.goto(`/gigarisk/${game.challengeId}`)
  await page.getByRole('button',{name:'Serang semua tim −2 GP',exact:true}).click()
  await expect(page.getByRole('button',{name:'Serangan selesai',exact:true})).toBeDisabled()
 }
 await expect(projector.locator('.tactical-stage__team')).toHaveCount(5)
 await expect(projector.locator('.tactical-stage__gp')).toContainText(['0 GP','0 GP','0 GP','0 GP','0 GP'])
 const last=CHALLENGE_GAMES[2].challengeId
 await projector.goto(`/gigarisk/${last}`)
 await expect(projector.locator('.giga-row.is-out')).toHaveCount(5)
 await page.goto('/admin')
 await expect(page.locator('.card')).toHaveCount(0)
 await page.getByLabel('Filter teams by status').selectOption('inactive')
 await expect(page.locator('.card')).toHaveCount(5)
 for (const button of await page.getByRole('button',{name:'Activate',exact:true}).all()) await expect(button).toBeDisabled()
 await page.reload()
 await page.getByLabel('Filter teams by status').selectOption('inactive')
 await expect(page.locator('.card')).toHaveCount(5)
 await projector.reload()
 await expect(projector.locator('.giga-row.is-out')).toHaveCount(5)
 await page.goto('/admin/turn-order')
 await expect(page.getByRole('button',{name:'Acak Giliran',exact:true})).toBeDisabled()
 for (const route of ['/admin/leaderboard', '/leaderboard']) {
  await page.goto(route)
  await expect(page.locator('.ranking-table tbody tr.is-out')).toHaveCount(5)
  await expect(page.locator('.out-label')).toHaveText(['OUT', 'OUT', 'OUT', 'OUT', 'OUT'])
 }
})
