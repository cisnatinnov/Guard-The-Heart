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
    await expect(page.locator('.card--locked')).toHaveCount(6)
    await expect(page.getByRole('button', { name: 'Add challenge' })).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'New challenge name' })).toHaveCount(0)

    // --- Scoreboard per challenge view: rank derives from score ---
    await page.locator('.card--locked').first().getByRole('button', { name: 'Scoreboard' }).click()
    await expect(page.getByRole('heading', { name: 'Scoreboard per challenge' })).toBeVisible()

    await page.locator('.grid-form select').selectOption({ label: 'Sentinels' })
    await page.locator('.grid-form input[type="number"]').fill('40')
    await page.getByRole('button', { name: 'Add entry' }).click()

    await page.locator('.grid-form select').selectOption({ label: 'Wardens' })
    await page.locator('.grid-form input[type="number"]').fill('120')
    await page.getByRole('button', { name: 'Add entry' }).click()

    const rows = page.locator('tbody tr')
    // Rank 1 goes to the higher score and earns the top-tier rewards.
    await expect(rows.nth(0)).toContainText('Wardens')
    await expect(rows.nth(0)).toContainText('120')
    await expect(rows.nth(0)).toContainText('10')
    await expect(rows.nth(0)).toContainText('3')
    await expect(rows.nth(1)).toContainText('Sentinels')
    await expect(rows.nth(1)).toContainText('2')
    await expect(rows.nth(1)).toContainText('8')
    await expect(rows.nth(1)).toContainText('2')

    // --- Correcting a score in place reranks without losing the team ---
    await page.locator('tbody tr', { hasText: 'Sentinels' }).getByRole('button', { name: 'Edit score' }).click()
    await expect(page.getByRole('button', { name: 'Update score' })).toBeVisible()
    // The team is pinned while correcting, so it cannot be swapped for another.
    await expect(page.locator('.grid-form select')).toBeDisabled()
    await page.locator('.grid-form input[type="number"]').fill('150')
    await page.getByRole('button', { name: 'Update score' }).click()
    // Still two rows: the entry was corrected, not re-added.
    await expect(page.locator('tbody tr')).toHaveCount(2)
    await expect(page.locator('tbody tr').nth(0)).toContainText('Sentinels')
    await expect(page.locator('tbody tr').nth(0)).toContainText('150')

    // --- Scoreboard total view: aggregated per team ---
    await tab(page, 'Scoreboard total').click()
    await expect(page.getByRole('heading', { name: 'Scoreboard total' })).toBeVisible()

    const totals = page.locator('tbody tr')
    await expect(totals.nth(0)).toContainText('Sentinels')
    await expect(totals.nth(0)).toContainText('150')
    await expect(totals.nth(0)).toContainText('10')
    await expect(totals.nth(0)).toContainText('3')
    await expect(totals.nth(1)).toContainText('Wardens')
    await expect(totals.nth(1)).toContainText('120')
    await expect(totals.nth(1)).toContainText('8')
    // Guard power is no longer a scoreboard column.
    await expect(totals.nth(0)).not.toContainText('GP')

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
    await tab(page, 'Scoreboard total').click()
    await expect(page.locator('tbody tr').nth(0)).toContainText('Sentinels', { timeout: 15_000 })
    await expect(page.locator('tbody tr').nth(0)).toContainText('150')

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
    await expect(page.locator('tbody tr')).toHaveCount(5)

    // The 6th team is still selectable, but submitting is rejected outright.
    await expect(page.locator('.alert--info')).toContainText('maximum of 5 entries')
    await page.locator('.grid-form select').selectOption({ label: 'Team 5' })
    await page.locator('.grid-form input[type="number"]').fill('60')
    await page.getByRole('button', { name: 'Add entry' }).click()
    await expect(page.locator('.alert--error')).toContainText('at most 5 entries')
    await expect(page.locator('tbody tr')).toHaveCount(5)
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
      { title: 'Emoji Decode', duration: '30s' },
      { title: 'Word Assembly', duration: '15s' },
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
      await retryAnswer.fill(title === 'Emoji Decode' ? 'firefighter' : 'still not the answer')
      await page.getByRole('button', { name: 'Next team answer' }).click()

      await expect(page.getByRole('button', { name: 'Next question' })).toBeVisible()
      await page.getByRole('button', { name: 'Next question' }).click()
      const secondQuestionAnswer = page.getByRole('textbox', { name: 'Run Team answer' })
      await expect(secondQuestionAnswer).toBeEnabled()
      await expect(page.getByRole('textbox', { name: 'Next Team answer' })).toBeDisabled()

      if (title === 'Word Assembly') {
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
      } else if (title !== 'Emoji Decode') {
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

    await page.locator('.card--locked', { hasText: 'Save the Core' }).getByRole('button', { name: 'Play' }).click()
    await expect(page.getByRole('timer')).toHaveCount(0)
  })

  test('finalizes Save the Core scores when its five-minute timer expires', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })
    await tab(page, 'Challenge').click()
    await page.locator('.card--locked', { hasText: 'Save the Core' }).getByRole('button', { name: 'Play' }).click()

    await page.clock.install()
    await page.getByRole('button', { name: 'Start 5-minute game' }).click()
    await expect(page.getByRole('timer', { name: 'Time remaining' })).toHaveText('5:00')
    await page.clock.runFor(5 * 60 * 1000)

    await expect(page.getByRole('timer', { name: 'Time remaining' })).toHaveText('0:00')
    await expect(page.locator('.alert--info')).toContainText(
      'No player reached the Core; final scores are shown below.'
    )
    await expect(page.locator('.core-leaderboard__row')).toHaveCount(4)
    await expect(page.getByRole('button', { name: /Roll the d6/ })).toBeDisabled()
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
    await expect(builtIn).toHaveCount(6)
    await expect(page.getByText('Built-in', { exact: true })).toHaveCount(6)
    for (const title of [
      'Emoji Decode',
      'Gardimon Protocol',
      'Word Assembly',
      'Incident Trail',
      'Jaws of Risk',
      'Save the Core',
    ]) {
      await expect(page.locator('.card--locked', { hasText: title })).toHaveCount(1)
    }

    // No add / rename / delete controls remain for built-in challenge data.
    await expect(page.getByRole('button', { name: 'Add challenge' })).toHaveCount(0)
    await expect(builtIn.first().getByRole('button', { name: 'Rename' })).toHaveCount(0)
    await expect(builtIn.first().getByRole('button', { name: 'Delete' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Work in progress' })).toHaveCount(2)

    for (const title of ['Gardimon Protocol', 'Incident Trail']) {
      await builtIn
        .filter({ hasText: title })
        .getByRole('button', { name: 'Work in progress' })
        .click()
      await expect(page.getByRole('heading', { name: 'Work in progress' })).toBeVisible()
      await expect(page.locator('.protocol-card, .scene, .evidence')).toHaveCount(0)
      await page.getByRole('button', { name: 'All challenges' }).click()
      await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible()
    }

    // The row opens its game, and the back button returns to the list.
    await builtIn.first().getByRole('button', { name: 'Play' }).click()
    await expect(page.getByRole('heading', { name: 'Emoji Decode' })).toBeVisible()
    await page.getByRole('button', { name: 'All challenges' }).click()
    await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible()

    // A row also opens that challenge's own scoreboard.
    const firstChallengeId = await builtIn.first().getAttribute('data-challenge-id')
    await builtIn.first().getByRole('button', { name: 'Scoreboard' }).click()
    await expect(page.getByRole('heading', { name: 'Scoreboard per challenge' })).toBeVisible()
    await expect(page.locator('.row-form select')).toHaveValue(firstChallengeId!)
  })

  test('plays available challenges, shows work-in-progress pages and keeps available decks reachable', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 30_000 })

    await tab(page, 'Challenge').click()
    await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible()
    await expect(page.locator('.card--locked')).toHaveCount(6)
    await expect(page.getByRole('link', { name: 'Emoji Decode deck (PPTX)' }).first()).toHaveAttribute(
      'href',
      '/decks/emoji-decode.pptx'
    )
    const play = (title: string) =>
      page.locator('.card--locked', { hasText: title }).getByRole('button', { name: 'Play' }).click()

    // Emoji Decode scores a decoded word.
    await play('Emoji Decode')
    await expect(page.getByRole('heading', { name: 'Emoji Decode' })).toBeVisible()

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

    // Gardimon Protocol content is temporarily hidden.
    await page.getByRole('button', { name: 'All challenges' }).click()
    await page
      .locator('.card--locked', { hasText: 'Gardimon Protocol' })
      .getByRole('button', { name: 'Work in progress' })
      .click()
    await expect(page.getByRole('heading', { name: 'Work in progress' })).toBeVisible()

    // Word Assembly deals ten pairs of picture cards.
    await page.getByRole('button', { name: 'All challenges' }).click()
    await play('Word Assembly')
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

    // Incident Trail content is temporarily hidden.
    await page.getByRole('button', { name: 'All challenges' }).click()
    await page
      .locator('.card--locked', { hasText: 'Incident Trail' })
      .getByRole('button', { name: 'Work in progress' })
      .click()
    await expect(page.getByRole('heading', { name: 'Work in progress' })).toBeVisible()

    // Jaws of Risk shows the solo board without the removed extra labels.
    await page.getByRole('button', { name: 'All challenges' }).click()
    await play('Jaws of Risk')
    await expect(page.getByText('Or play solo below and record the score afterwards.')).toBeVisible()
    await expect(page.locator('.jaw')).toHaveCount(8)
    await page.locator('.jaw').first().click()
    await expect(page.locator('.alert--info')).toContainText('loose tooth caught', { timeout: 15_000 })

    // Save the Core rolls a die for the active guardian.
    await page.getByRole('button', { name: 'All challenges' }).click()
    await play('Save the Core')
    await page.getByRole('button', { name: 'Start 5-minute game' }).click()
    await expect(page.getByRole('timer', { name: 'Time remaining' })).toHaveText('5:00')
    await expect(page.locator('.core-square')).toHaveCount(24)
    await expect(page.locator('.core-square--start, .core-square--empty')).toHaveCount(0)
    await expect(page.getByRole('gridcell', { name: /outside the track/ })).toHaveCount(0)
    await expect(page.locator('.core-square__mark', { hasText: '🏁' })).toHaveCount(0)
    await page.getByRole('button', { name: /Roll the d6/ }).click()
    await expect(page.locator('.core-leaderboard__row')).toHaveCount(4)
    await expect(page.locator('.core-turn__active')).not.toContainText('Guardimon Male')
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