import { test, expect, type Page } from '@playwright/test'

/** The persistent top navigation. */
const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true })

test.describe('Guard The Heart', () => {
  test('runs the full MVC flow and survives a reload', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (error) => consoleErrors.push(error.message))

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Guard The Heart' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Guard The Heart logo' })).toHaveAttribute(
      'src',
      '/Logo_Game-5.png'
    )
    await expect
      .poll(() => page.getByRole('img', { name: 'Guard The Heart logo' }).evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0)
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })

    // --- Team view: create ---
    for (const team of ['Sentinels', 'Wardens']) {
      await page.getByRole('textbox', { name: 'New team name' }).fill(team)
      await page.getByRole('button', { name: 'Add team' }).click()
      await expect(page.getByText(team, { exact: true })).toBeVisible({ timeout: 15_000 })
    }

    // --- Challenge view: built-in challenges only, no "Add challenge" form ---
    await tab(page, 'Challenge').click()
    await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible()
    await expect(page.locator('.card--locked')).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Add challenge' })).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'New challenge name' })).toHaveCount(0)

    // --- Scoreboard per challenge view: rank derives from challenge point ---
    await page.locator('.card--locked').first().getByRole('button', { name: 'Scoreboard' }).click()
    await expect(page.getByRole('heading', { name: 'Scoreboard per challenge' })).toBeVisible()

    await page.locator('.grid-form select').selectOption({ label: 'Sentinels' })
    await page.locator('.grid-form input[type="number"]').fill('40')
    await page.getByRole('button', { name: 'Add entry' }).click()

    await page.locator('.grid-form select').selectOption({ label: 'Wardens' })
    await page.locator('.grid-form input[type="number"]').fill('120')
    await page.getByRole('button', { name: 'Add entry' }).click()

    const rows = page.locator('.board__row')
    // Rank 1 goes to the higher challenge point.
    await expect(rows.nth(0)).toContainText('Wardens')
    await expect(rows.nth(0)).toContainText('120')
    await expect(rows.nth(1)).toContainText('Sentinels')
    await expect(rows.nth(1)).toContainText('40')

    // --- Correcting a challenge point in place reranks without losing the team ---
    await page.locator('.board__row', { hasText: 'Sentinels' }).getByRole('button', { name: 'Edit CP' }).click()
    await expect(page.getByRole('button', { name: 'Update challenge point' })).toBeVisible()
    // The team is pinned while correcting, so it cannot be swapped for another.
    await expect(page.locator('.grid-form select')).toBeDisabled()
    await page.locator('.grid-form input[type="number"]').fill('150')
    await page.getByRole('button', { name: 'Update challenge point' }).click()
    // Still two rows: the entry was corrected, not re-added.
    await expect(page.locator('.board__row')).toHaveCount(2)
    await expect(page.locator('.board__row').nth(0)).toContainText('Sentinels')
    await expect(page.locator('.board__row').nth(0)).toContainText('150')

    // --- Public scoreboard shows the ranking without admin controls ---
    const scoreboardModes = page.getByRole('group', { name: 'Scoreboard view' })
    await scoreboardModes.getByRole('button', { name: 'Public' }).click()
    await expect(page.locator('.board__row')).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Edit CP' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add entry' })).toHaveCount(0)
    await expect(page.locator('.row-form select')).toHaveCount(0)
    await scoreboardModes.getByRole('button', { name: 'Adm' }).click()
    await expect(page.getByRole('button', { name: 'Edit CP' })).toHaveCount(2)

    // --- Leaderboard: public by default, admin adds recalculate and offline copy ---
    await tab(page, 'Leaderboard').click()
    await expect(page.getByRole('heading', { name: 'Leaderboard', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Recalculate' })).toHaveCount(0)

    const totals = page.locator('.leaderboard__card')
    await expect(totals.nth(0)).toContainText('Sentinels')
    await expect(totals.nth(0)).toContainText('8 GP')
    await expect(totals.nth(1)).toContainText('Wardens')
    await expect(totals.nth(1)).toContainText('7 GP')

    await page.getByRole('group', { name: 'Leaderboard view' }).getByRole('button', { name: 'Adm' }).click()
    await page.getByRole('button', { name: 'Recalculate' }).click()
    await expect(page.locator('.alert--info')).toContainText('Leaderboard recalculated.')
    await page.getByRole('button', { name: 'Save offline copy' }).click()
    await expect(page.locator('.alert--info')).toContainText('Offline copy saved.')
    await expect(totals.nth(0)).toContainText('Sentinels')
    // --- Team view: guard power accrues from 5 plus the rank rewards ---
    await tab(page, 'Team').click()
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible()
    // Sentinels won (3 GP earned), Wardens placed second (2 GP earned).
    await expect(page.locator('.card', { hasText: 'Sentinels' })).toContainText('GP 8')
    await expect(page.locator('.card', { hasText: 'Wardens' })).toContainText('GP 7')

    // --- Persistence: reload must restore the SQLite database ---
    await page.waitForTimeout(600) // allow the debounced IndexedDB write
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Sentinels', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Wardens', { exact: true })).toBeVisible({ timeout: 30_000 })

    // Recalculated totals survive the reload too.
    await tab(page, 'Leaderboard').click()
    await expect(page.locator('.leaderboard__card').nth(0)).toContainText('Sentinels', { timeout: 15_000 })
    await expect(page.locator('.leaderboard__card').nth(0)).toContainText('8 GP')

    expect(consoleErrors).toEqual([])
  })

  test('blocks a sixth entry for the same challenge', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })

    for (let i = 0; i < 6; i += 1) {
      await page.getByRole('textbox', { name: 'New team name' }).fill(`Team ${i}`)
      await page.getByRole('button', { name: 'Add team' }).click()
    }

    await tab(page, 'Challenge').click()
    await page.locator('.card--locked').first().getByRole('button', { name: 'Scoreboard' }).click()
    await expect(page.getByRole('heading', { name: 'Scoreboard per challenge' })).toBeVisible()

    for (let i = 0; i < 5; i += 1) {
      await page.locator('.grid-form select').selectOption({ label: `Team ${i}` })
      await page.locator('.grid-form input[type="number"]').fill(String((i + 1) * 10))
      await page.getByRole('button', { name: 'Add entry' }).click()
    }
    await expect(page.locator('.board__row')).toHaveCount(5)

    // The 6th team is still selectable, but submitting is rejected outright.
    await expect(page.locator('.alert--info')).toContainText('maximum of 5 entries')
    await page.locator('.grid-form select').selectOption({ label: 'Team 5' })
    await page.locator('.grid-form input[type="number"]').fill('60')
    await page.getByRole('button', { name: 'Add entry' }).click()
    await expect(page.locator('.alert--error')).toContainText('at most 5 entries')
    await expect(page.locator('.board__row')).toHaveCount(5)
  })

  test('advances team runs with editable answers and configured per-challenge timers', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })

    await page.getByRole('textbox', { name: 'New team name' }).fill('Run Team')
    await page.getByRole('button', { name: 'Add team' }).click()
    await expect(page.getByText('Run Team', { exact: true })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('textbox', { name: 'New team name' }).fill('Next Team')
    await page.getByRole('button', { name: 'Add team' }).click()
    await expect(page.getByText('Next Team', { exact: true })).toBeVisible({ timeout: 15_000 })

    await tab(page, 'Challenge').click()
    const challengeSettings = [
      { title: 'Image Decode', duration: '30s' },
      { title: 'Match Card', duration: '15s' },
      { title: 'Jaws of Risk', duration: null },
    ]

    for (const { title, duration } of challengeSettings) {
      await page.locator('.card--locked', { hasText: title }).getByRole('button', { name: 'Play' }).click()
      await page.getByRole('checkbox', { name: 'Run Team' }).check()
      await page.getByRole('checkbox', { name: 'Next Team' }).check()
      await page.getByRole('button', { name: 'Start team run (2)' }).click()

      const firstTimer = page.getByRole('timer', { name: 'Time left for question 1' })
      if (duration) {
        await expect(firstTimer).toHaveText(duration)
      } else {
        await expect(firstTimer).toHaveCount(0)
      }

      await page.getByRole('textbox', { name: 'Run Team answer' }).fill('not the answer')
      await page.getByRole('button', { name: 'Grade this question' }).click()

      const retryAnswer = page.getByRole('textbox', { name: 'Next Team answer' })
      await expect(retryAnswer).toBeEnabled()
      await expect(page.getByRole('textbox', { name: 'Run Team answer' })).toBeDisabled()
      await expect(page.getByRole('heading', { name: /question 1 of/ })).toBeVisible()
      await retryAnswer.fill(title === 'Image Decode' ? 'firefighter' : 'still not the answer')
      await page.getByRole('button', { name: 'Next team answer' }).click()

      await expect(page.getByRole('button', { name: 'Next question' })).toBeVisible()
      await page.getByRole('button', { name: 'Next question' }).click()
      const secondQuestionAnswer = page.getByRole('textbox', { name: 'Run Team answer' })
      await expect(secondQuestionAnswer).toBeEnabled()
      await expect(page.getByRole('textbox', { name: 'Next Team answer' })).toBeDisabled()

      if (title === 'Match Card') {
        const secondTimer = page.getByRole('timer', { name: 'Time left for question 2' })
        await expect(secondTimer).toHaveText(duration!)
        await expect(secondTimer).toHaveText('Time up', { timeout: 20_000 })
        await expect(secondQuestionAnswer).toBeDisabled()
        await expect(page.locator('.run-panel__verdict')).toContainText('time up')
        await expect(page.getByRole('button', { name: 'Next question' })).toBeVisible()
        await page.getByRole('button', { name: 'Next question' }).click()
        const thirdQuestionAnswer = page.getByRole('textbox', { name: 'Next Team answer' })
        await expect(thirdQuestionAnswer).toBeEnabled()
        await thirdQuestionAnswer.fill('next question answer')
      } else if (title !== 'Image Decode') {
        const secondTimer = page.getByRole('timer', { name: 'Time left for question 2' })
        if (duration) {
          await expect(secondTimer).toHaveText(duration)
        } else {
          await expect(secondTimer).toHaveCount(0)
        }
        await secondQuestionAnswer.fill('wrong answer')
        await page.getByRole('button', { name: 'Grade this question' }).click()
        const retryNextQuestion = page.getByRole('textbox', { name: 'Next Team answer' })
        await expect(retryNextQuestion).toBeEnabled()
      }

      await page.getByRole('button', { name: 'End run' }).click()
      await page.getByRole('button', { name: 'All challenges' }).click()
    }
  })

  test('shows only locked built-in challenges and opens them from their row', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })

    // The per-challenge scoreboard only renders its picker once a team exists.
    await page.getByRole('textbox', { name: 'New team name' }).fill('Sentinels')
    await page.getByRole('button', { name: 'Add team' }).click()
    await expect(page.getByText('Sentinels', { exact: true })).toBeVisible({ timeout: 15_000 })

    await tab(page, 'Challenge').click()
    await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible()

    // Every playable challenge is saved as challenge data from first launch.
    const builtIn = page.locator('.card--locked')
    await expect(builtIn).toHaveCount(3)
    await expect(page.getByText('Built-in', { exact: true })).toHaveCount(3)
    for (const title of ['Image Decode', 'Match Card', 'Jaws of Risk']) {
      await expect(page.locator('.card--locked', { hasText: title })).toHaveCount(1)
    }
    for (const title of ['Gardimon Protocol', 'Incident Trail', 'Save the Core']) {
      await expect(page.locator('.card--locked', { hasText: title })).toHaveCount(0)
    }

    // No add / rename / delete controls remain for built-in challenge data.
    await expect(page.getByRole('button', { name: 'Add challenge' })).toHaveCount(0)
    await expect(builtIn.first().getByRole('button', { name: 'Rename' })).toHaveCount(0)
    await expect(builtIn.first().getByRole('button', { name: 'Delete' })).toHaveCount(0)

    // The row opens its game, and the back button returns to the list.
    await builtIn.first().getByRole('button', { name: 'Play' }).click()
    await expect(page.getByRole('heading', { name: 'Image Decode' })).toBeVisible()
    await page.getByRole('button', { name: 'All challenges' }).click()
    await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible()

    // A row also opens that challenge's own scoreboard.
    const firstChallengeId = await builtIn.first().getAttribute('data-challenge-id')
    await builtIn.first().getByRole('button', { name: 'Scoreboard' }).click()
    await expect(page.getByRole('heading', { name: 'Scoreboard per challenge' })).toBeVisible()
    await expect(page.locator('.row-form select')).toHaveValue(firstChallengeId!)
  })

  test('plays every challenge and keeps the Image Decode deck reachable', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })

    await tab(page, 'Challenge').click()
    await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible()
    await expect(page.locator('.card--locked')).toHaveCount(3)
    await expect(page.getByRole('link', { name: 'Image Decode deck (PPTX)' }).first()).toHaveAttribute(
      'href',
      '/decks/emoji-decode.pptx'
    )
    const play = (title: string) =>
      page.locator('.card--locked', { hasText: title }).getByRole('button', { name: 'Play' }).click()

    // Image Decode scores a decoded word.
    await play('Image Decode')
    await expect(page.getByRole('heading', { name: 'Image Decode' })).toBeVisible()

    // Each question combines four emoji into one answer.
    await expect(page.locator('.emoji-decode__chip')).toHaveCount(4)
    await expect(page.locator('.emoji-decode__glyph')).toContainText('🔥')
    await expect(page.locator('.emoji-decode__glyph')).toContainText('🚒')

    // The app mirrors the deck: a live countdown runs on every question.
    const countdown = page.locator('.emoji-timer__value')
    await expect(countdown).toHaveText(/^\d{1,2}s$/)
    const before = Number((await countdown.textContent())?.replace('s', ''))
    await page.waitForTimeout(2200)
    const after = Number((await countdown.textContent())?.replace('s', ''))
    expect(after).toBeLessThan(before)

    await page.getByRole('textbox', { name: 'Decoded answer' }).fill('Firefighter')
    await page.getByRole('button', { name: 'Decode', exact: true }).click()
    await expect(page.locator('.alert--ok')).toContainText('Correct')
    await expect(page.locator('.stat', { hasText: 'Solved' })).toContainText('1/15')

    // Match Card deals ten pairs of picture cards.
    await page.getByRole('button', { name: 'All challenges' }).click()
    await play('Match Card')
    const matchCards = page.locator('.tile')
    await expect(matchCards).toHaveCount(20)
    await expect(page.locator('.word-match-prompts li')).toHaveCount(10)

    let mismatchIndices: [number, number] | null = null
    for (let firstIndex = 0; firstIndex < 20 && !mismatchIndices; firstIndex += 1) {
      const firstCard = matchCards.nth(firstIndex)
      if ((await firstCard.getAttribute('aria-label')) !== 'Face-down picture card') continue
      await firstCard.click()
      await expect(firstCard.locator('img')).toBeVisible()
      await expect
        .poll(() => firstCard.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0)
      const firstSource = await firstCard.locator('img').getAttribute('src')

      for (let secondIndex = firstIndex + 1; secondIndex < 20; secondIndex += 1) {
        const secondCard = matchCards.nth(secondIndex)
        if ((await secondCard.getAttribute('aria-label')) !== 'Face-down picture card') continue
        await secondCard.click()
        const secondSource = await secondCard.locator('img').getAttribute('src')
        if (secondSource !== firstSource) {
          mismatchIndices = [firstIndex, secondIndex]
          break
        }
        break
      }
    }
    expect(mismatchIndices).not.toBeNull()
    await expect(page.locator('.alert--error')).toContainText('pictures do not match')
    const [firstMismatch, secondMismatch] = mismatchIndices!
    await expect(matchCards.nth(firstMismatch)).toHaveAttribute('aria-label', 'Face-down picture card')
    await expect(matchCards.nth(secondMismatch)).toHaveAttribute('aria-label', 'Face-down picture card')

    // Jaws of Risk shows the solo board without the removed extra labels.
    await page.getByRole('button', { name: 'All challenges' }).click()
    await play('Jaws of Risk')
    await expect(page.getByText('Or play solo below and record the score afterwards.')).toBeVisible()
    await expect(page.locator('.jaw')).toHaveCount(8)
    await page.locator('.jaw').first().click()
    await expect(page.locator('.alert--info')).toContainText('loose tooth caught', { timeout: 15_000 })
  })

  test('service worker precaches assets for offline use', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Guard The Heart' })).toBeVisible()

    const registration = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready
      return { scope: reg.scope, active: Boolean(reg.active) }
    })
    expect(registration.active).toBe(true)

    await page.context().setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Guard The Heart' })).toBeVisible({ timeout: 30_000 })
    await page.context().setOffline(false)
  })
})
