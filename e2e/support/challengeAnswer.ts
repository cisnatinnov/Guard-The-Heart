import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
const reference = JSON.parse(readFileSync(new URL('../../src/data/reference-question-bank.json', import.meta.url), 'utf8')) as Record<string, { prompt: string; answer: string; options: string[] }[]>

/** Submit an actual option through the host form, preserving scoring coverage. */
export async function submitQuizAnswer(page: Page, correct: boolean) {
  const recorded = page.getByText('Answer recorded for this team. Choose the next team or question.', { exact: true })
  if (await recorded.isVisible()) await page.getByRole('button', { name: 'Next question', exact: true }).click()
  const prompt = await page.locator('.workbook-quiz h2').textContent()
  const question = [...reference.matchCard, ...reference.jawsOfRisk].find((entry) => entry.prompt === prompt)
  if (!question) throw new Error(`Missing question: ${prompt}`)
  const option = correct ? question.answer : question.options.find((value) => value !== question.answer)!
  await page.getByRole('combobox', { name: 'Team answer', exact: true }).selectOption(option)
  await page.getByRole('button', { name: 'Submit answer', exact: true }).click()
  await expect(page.getByLabel('Challenge scoring')).toHaveAttribute('aria-busy', 'false')
}

/** Reuse a pending two-tooth turn; otherwise submit an incorrect answer. */
export async function prepareToothPress(page: Page) {
  await expect(page.getByLabel('Crocodile bite toy')).toHaveAttribute('aria-busy', 'false')
  const pending = page.locator('.challenge-answer-controls [role="status"]')
  if (await pending.count()) return
  await submitQuizAnswer(page, false)
  await expect(pending).toBeVisible()
}
