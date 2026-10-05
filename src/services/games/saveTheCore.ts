import type { RandomSource } from './random'

export type CoreTileKind = 'safe' | 'bomb' | 'core'

export interface CoreTile {
  index: number
  kind: CoreTileKind
  score: number
  revealed: boolean
}

export interface CorePlayer {
  id: string
  name: string
  icon: string
  color: string
  position: number
  startPosition: number
  score: number
  finished: boolean
  homeRuns: number
}

export interface CoreLogEntry {
  round: number
  playerId: string
  playerName: string
  die: number
  outcome: CoreOutcome
  text: string
}

export type CoreOutcome = 'advanced' | 'bomb' | 'core' | 'waiting' | 'finished'

export interface CoreGameState {
  tiles: CoreTile[]
  players: CorePlayer[]
  turnIndex: number
  round: number
  log: CoreLogEntry[]
  over: boolean
  endReason: 'core' | 'timeout' | null
}

export const CORE_TRACK_LENGTH = 24
export const CORE_GAME_DURATION_SECONDS = 5 * 60
export const CORE_BOMB_RATIO = 0.25
export const CORE_SCORE_STEP = 5
export const CORE_SCORE_MIN = 5
export const CORE_SCORE_MAX = 25
export const CORE_CHALLENGE_ID = 'e62b4d90-7a15-4d38-bc6f-93d207e4a8b1'
export const CORE_FINISH_BONUS = 50
export const CORE_DIE_SIDES = 6
const CORE_BOARD_FILES = 'abcdefgh'

export const CORE_PLAYERS: Array<Pick<CorePlayer, 'id' | 'name' | 'icon' | 'color'>> = [
  { id: 'core-male', name: 'Guardimon Male', icon: '🛡️', color: '#027479' },
  { id: 'core-female', name: 'Guardimon Female', icon: '⚔️', color: '#a9470c' },
  { id: 'core-gardimon', name: 'Gardimon', icon: '🐲', color: '#f48220' },
  { id: 'core-gigarisk', name: 'Giga Risk', icon: '🔥', color: '#be392a' },
]

export type CorePlayerDefinition = Pick<CorePlayer, 'id' | 'name' | 'icon' | 'color'>

function rollScore(random: RandomSource): number {
  const steps = Math.floor(CORE_SCORE_MAX / CORE_SCORE_STEP)
  return (Math.floor(random() * steps) + 1) * CORE_SCORE_STEP
}

/**
 * Save the Core mixes Ludo and Minesweeper: every tile hides either a score or a
 * bomb, and bombs are fixed when the track is built so a reset keeps the layout.
 */
export function createCoreGame(
  random: RandomSource = Math.random,
  options: {
    trackLength?: number
    bombRatio?: number
    players?: CorePlayerDefinition[]
  } = {}
): CoreGameState {
  const trackLength = Math.max(6, options.trackLength ?? CORE_TRACK_LENGTH)
  const bombRatio = options.bombRatio ?? CORE_BOMB_RATIO
  const bombCount = Math.max(1, Math.round((trackLength - 1) * bombRatio))

  const bombIndices = new Set<number>()
  while (bombIndices.size < bombCount) {
    const index = Math.floor(random() * (trackLength - 1))
    bombIndices.add(index)
  }

  const tiles: CoreTile[] = Array.from({ length: trackLength }, (_, index) => {
    if (index === trackLength - 1) return { index, kind: 'core', score: CORE_FINISH_BONUS, revealed: false }
    if (bombIndices.has(index)) return { index, kind: 'bomb', score: 0, revealed: false }
    return { index, kind: 'safe', score: rollScore(random), revealed: false }
  })

  const players = options.players ?? CORE_PLAYERS
  const startingSquares = Array.from({ length: trackLength - 1 }, (_, index) => index)
  for (let index = 0; index < Math.min(players.length, startingSquares.length); index += 1) {
    const swapIndex = index + Math.floor(random() * (startingSquares.length - index))
    const value = startingSquares[index]
    startingSquares[index] = startingSquares[swapIndex]
    startingSquares[swapIndex] = value
  }

  return {
    tiles,
    players: players.map((player, index) => {
      const position =
        startingSquares[index] ??
        Math.floor(random() * (trackLength - 1))
      return {
        ...player,
        position,
        startPosition: position,
        score: 0,
        finished: false,
        homeRuns: 0,
      }
    }),
    turnIndex: 0,
    round: 1,
    log: [],
    over: false,
    endReason: null,
  }
}

/** Maps the 24 track spaces to a three-rank, chess-coordinate snake path. */
export function coreTileCoordinate(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= CORE_TRACK_LENGTH) {
    throw new RangeError(`Track index must be between 0 and ${CORE_TRACK_LENGTH - 1}`)
  }
  const rank = index < 8 ? 5 : index < 16 ? 6 : 7
  const fileIndex = index < 8 ? index : index < 16 ? 15 - index : index - 16
  return `${CORE_BOARD_FILES[fileIndex]}${rank}`
}

export function expireCoreGame(state: CoreGameState): CoreGameState {
  return state.over ? state : { ...state, over: true, endReason: 'timeout' }
}

export function rollCoreDie(random: RandomSource = Math.random): number {
  return 1 + Math.floor(random() * CORE_DIE_SIDES)
}

export interface CoreTurnResult {
  state: CoreGameState
  die: number
  outcome: CoreOutcome
  revealedScore: number
}

export function playCoreTurn(
  state: CoreGameState,
  random: RandomSource = Math.random,
  forcedDie?: number
): CoreTurnResult {
  if (state.over) {
    return { state, die: 0, outcome: 'finished', revealedScore: 0 }
  }

  const die = forcedDie ?? rollCoreDie(random)
  const active = state.players[state.turnIndex]
  const lastIndex = state.tiles.length - 1

  if (active.finished) {
    const logged = appendLog(state, active, die, 'waiting', `${active.name} is already safe.`)
    return { state: advanceTurn(logged), die, outcome: 'waiting', revealedScore: 0 }
  }

  const target = Math.min(active.position + die, lastIndex)
  const tile = state.tiles[target]

  if (tile.kind === 'bomb') {
    const revealedTiles = state.tiles.map((entry) =>
      entry.index === target ? { ...entry, revealed: true } : entry
    )
    const players = state.players.map((player) =>
      player.id === active.id ? { ...player, position: player.startPosition } : player
    )
    const next: CoreGameState = { ...state, tiles: revealedTiles, players }
    const logged = appendLog(
      next,
      active,
      die,
      'bomb',
      `${active.name} hit a bomb on ${coreTileCoordinate(target)} and returns to their starting square (${coreTileCoordinate(active.startPosition)}).`
    )
    return { state: advanceTurn(logged), die, outcome: 'bomb', revealedScore: 0 }
  }

  if (tile.kind === 'core') {
    const revealedTiles = state.tiles.map((entry) =>
      entry.index === target ? { ...entry, revealed: true } : entry
    )
    const players = state.players.map((player) =>
      player.id === active.id
        ? { ...player, position: target, score: player.score + CORE_FINISH_BONUS, finished: true, homeRuns: player.homeRuns + 1 }
        : player
    )
    const logged = appendLog(
      { ...state, tiles: revealedTiles, players, over: true, endReason: 'core' },
      active,
      die,
      'core',
      `${active.name} reached the Core for ${CORE_FINISH_BONUS} points.`
    )
    return { state: advanceTurn(logged), die, outcome: 'core', revealedScore: CORE_FINISH_BONUS }
  }

  const revealedScore = tile.revealed ? 0 : tile.score
  const revealedTiles = state.tiles.map((entry) =>
    entry.index === target ? { ...entry, revealed: true } : entry
  )
  const players = state.players.map((player) =>
    player.id === active.id ? { ...player, position: target, score: player.score + revealedScore } : player
  )
  const logged = appendLog(
    { ...state, tiles: revealedTiles, players },
    active,
    die,
    'advanced',
    revealedScore > 0
    ? `${active.name} moved ${die} and revealed ${revealedScore} points on ${coreTileCoordinate(target)}.`
    : `${active.name} moved ${die} to ${coreTileCoordinate(target)}.`
  )
  return { state: advanceTurn(logged), die, outcome: 'advanced', revealedScore }
}

function appendLog(
  state: CoreGameState,
  player: CorePlayer,
  die: number,
  outcome: CoreOutcome,
  text: string
): CoreGameState {
  const entry: CoreLogEntry = {
    round: state.round,
    playerId: player.id,
    playerName: player.name,
    die,
    outcome,
    text,
  }
  return { ...state, log: [...state.log, entry] }
}

function advanceTurn(state: CoreGameState): CoreGameState {
  const active = state.players.length
  let turnIndex = state.turnIndex
  for (let step = 0; step < active; step += 1) {
    turnIndex = (turnIndex + 1) % active
    if (!state.players[turnIndex].finished) break
  }
  const over = state.over || state.players.every((player) => player.finished)
  return {
    ...state,
    turnIndex,
    round: over ? state.round : state.round + 1,
    over,
    endReason: state.endReason ?? (over ? 'core' : null),
  }
}

export function coreLeaderboard(state: CoreGameState): CorePlayer[] {
  return [...state.players].sort((a, b) => b.score - a.score || b.position - a.position)
}

export function playersOnTile(state: CoreGameState, index: number): CorePlayer[] {
  return state.players.filter((player) => player.position === index)
}

export function revealedBombCount(state: CoreGameState): number {
  return state.tiles.filter((tile) => tile.kind === 'bomb' && tile.revealed).length
}