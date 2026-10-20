import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { initializeAppDatabase } from '../src/db/database'
import { Challenge, GPTransaction } from '../src/models'
import { TeamController } from '../src/controllers/TeamController'
import { initializeGPTransactions, recordGigaRiskGP } from '../src/services/gpTransactions'
import { publishTacticalPhase, readTacticalPhase, type TacticalResolution } from '../src/services/tacticalPhase'

beforeAll(async () => { await initializeAppDatabase() })
beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    get length() { return values.size }, key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  })
  vi.stubGlobal('window', { dispatchEvent: () => true })
})
afterEach(() => vi.unstubAllGlobals())
const result = (teamId: string) => ({ teamId, initialGP: 5, finalGP: 3, gigaRisk: -2, effects: [], usedCards: 0 })

it('starts with an archived attack whose teams no longer exist without changing its history', async () => {
  const challenge = await Challenge.create({ name: crypto.randomUUID() })
  const resolution: TacticalResolution = { resolvedAt: 1, teams: [result('missing-old-team')] }
  publishTacticalPhase(challenge.id, { choices: {}, revealed: true, resolution })
  const saved = localStorage.getItem(`guard-the-heart-gigarisk-completed:${challenge.id}`)
  await expect(initializeGPTransactions()).resolves.toBeUndefined()
  await expect(initializeGPTransactions()).resolves.toBeUndefined()
  expect(await GPTransaction.count({ where: { challenge: challenge.id, category: 'attack' } })).toBe(0)
  expect(localStorage.getItem(`guard-the-heart-gigarisk-completed:${challenge.id}`)).toBe(saved)
  expect(readTacticalPhase(challenge.id).resolution).toEqual(resolution)
})

it('imports existing participants once while preserving missing participants in the archive', async () => {
  const team = await TeamController.create(crypto.randomUUID())
  const challenge = await Challenge.create({ name: crypto.randomUUID() })
  const resolution: TacticalResolution = { resolvedAt: 2, teams: [result(team.id), result('deleted-team')] }
  publishTacticalPhase(challenge.id, { choices: {}, revealed: true, resolution })
  await initializeGPTransactions()
  await initializeGPTransactions()
  expect((await team.reload()).total_gp).toBe(3)
  expect(await GPTransaction.count({ where: { challenge: challenge.id, category: 'attack' } })).toBe(1)
  expect(readTacticalPhase(challenge.id).resolution).toEqual(resolution)
})

it('still rejects a new attack with a missing team and rolls back valid participants', async () => {
  const team = await TeamController.create(crypto.randomUUID())
  const challenge = await Challenge.create({ name: crypto.randomUUID() })
  await expect(recordGigaRiskGP(challenge.id, { resolvedAt: 3, teams: [result(team.id), result('missing-live-team')] })).rejects.toThrow('Tim tidak ditemukan')
  expect((await team.reload()).total_gp).toBe(5)
  expect(await GPTransaction.count({ where: { challenge: challenge.id, category: 'attack' } })).toBe(0)
})

it('keeps history after real team deletion and never applies old GP to a replacement with the same name', async () => {
  const survivor = await TeamController.create(crypto.randomUUID())
  const removed = await TeamController.create(crypto.randomUUID())
  const name = removed.name
  const challenge = await Challenge.create({ name: crypto.randomUUID() })
  const resolution: TacticalResolution = { resolvedAt: 4, teams: [result(survivor.id), result(removed.id)] }
  publishTacticalPhase(challenge.id, { choices: {}, revealed: true, resolution })
  await recordGigaRiskGP(challenge.id, resolution)
  expect(await TeamController.remove(removed.id)).toBe(true)
  const replacement = await TeamController.create(name)
  expect(replacement.id).not.toBe(removed.id)
  for (let run = 0; run < 3; run++) await initializeGPTransactions()
  expect((await survivor.reload()).total_gp).toBe(3)
  expect((await replacement.reload()).total_gp).toBe(5)
  const ledger = await GPTransaction.findAll({ where: { challenge: challenge.id, category: 'attack' } })
  expect(ledger).toHaveLength(2)
  expect(ledger.find((row) => row.source_key === `attack:${challenge.id}:${removed.id}`)?.team).toBeNull()
  expect(readTacticalPhase(challenge.id).resolution).toEqual(resolution)
})
