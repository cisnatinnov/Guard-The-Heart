import { describe, it, expect } from 'vitest'
import {
  CHALLENGE_GAMES,
  CORE_FINISH_BONUS,
  CORE_TRACK_LENGTH,
  EMOJI_DECODE_EMOJIS_PER_QUESTION,
  EMOJI_DECODE_QUESTIONS,
  GARDIMON_PHASES,
  GARDIMON_ROUNDS,
  INCIDENT_TRAIL_ANSWER_SHEET_COUNT,
  INCIDENT_TRAIL_CLUES,
  INCIDENT_TRAIL_INFORMATION,
  INCIDENT_TRAIL_SCENES,
  JAWS_LOOSE_COUNT,
  JAWS_TOOTH_COUNT,
  WORD_ASSEMBLY_CARD_COUNT,
  WORD_ASSEMBLY_QUESTIONS,
  assignIncidentTrailClue,
  challengeGameInfo,
  checkEmojiAnswer,
  createCoreGame,
  createJawsBoard,
  createWordAssemblyState,
  evaluateJawsBoard,
  gardimonMaximumScore,
  isClueCorrectForScene,
  isCorrectPick,
  normalizeEmojiAnswer,
  placeWordAssemblyCard,
  playCoreTurn,
  scoreEmojiDecode,
  scoreGardimonRound,
  scoreIncidentTrail,
  scoreWordAssembly,
  searchIncidentTrail,
  setJawLabel,
  toggleJawSelection,
} from '../src/services/games'
import { challengeQuestionsFor } from '../src/services/games/challengeQuestions'

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('challenge registry', () => {
  it('lists the six blueprint challenges in order', () => {
    expect(CHALLENGE_GAMES.map((game) => game.title)).toEqual([
      'Emoji Decode',
      'Gardimon Protocol',
      'Word Assembly',
      'Incident Trail',
      'Jaws of Risk',
      'Save the Core',
    ])
    expect(challengeGameInfo('save-the-core').rules.length).toBeGreaterThan(0)
  })

  it('ships a pptx deck only for the two deck challenges', () => {
    expect(CHALLENGE_GAMES.filter((game) => game.deckPath).map((game) => game.id)).toEqual([
      'emoji-decode',
      'incident-trail',
    ])
    expect(CHALLENGE_GAMES[0].deckPath).toMatch(/emoji-decode\.pptx$/)
    expect(CHALLENGE_GAMES[3].deckPath).toMatch(/incident-trail\.pptx$/)
  })

  it('uses the configured timer for question-based team runs only', () => {
    expect(challengeQuestionsFor('emoji-decode').secondsPerQuestion).toBe(30)
    expect(challengeQuestionsFor('gardimon-protocol').secondsPerQuestion).toBe(8 * 60)
    expect(challengeQuestionsFor('word-assembly').secondsPerQuestion).toBe(15)
    expect(challengeQuestionsFor('incident-trail').secondsPerQuestion).toBe(20)
    expect(challengeQuestionsFor('jaws-of-risk').secondsPerQuestion).toBeUndefined()
    expect(challengeQuestionsFor('save-the-core').secondsPerQuestion).toBeUndefined()
  })
})

describe('Emoji Decode', () => {
  it('ships 15 questions that each combine four emoji', () => {
    expect(EMOJI_DECODE_QUESTIONS).toHaveLength(15)
    for (const question of EMOJI_DECODE_QUESTIONS) {
      expect(question.emojis).toHaveLength(EMOJI_DECODE_EMOJIS_PER_QUESTION)
      for (const glyph of question.emojis) {
        expect(glyph.length).toBeGreaterThan(0)
      }
      expect(question.answer.length).toBeGreaterThan(1)
      expect(question.hint.length).toBeGreaterThan(0)
    }
    expect(EMOJI_DECODE_EMOJIS_PER_QUESTION).toBe(4)
    expect(new Set(EMOJI_DECODE_QUESTIONS.map((q) => q.id)).size).toBe(15)
  })

  it('accepts loose spellings but rejects other words', () => {
    const question = EMOJI_DECODE_QUESTIONS[0]
    expect(normalizeEmojiAnswer(' Fire-Engine! ')).toBe('fireengine')
    expect(checkEmojiAnswer(question, ' firefighter ')).toBe(true)
    expect(checkEmojiAnswer(question, 'FIREFIGHTER')).toBe(true)
    expect(checkEmojiAnswer(question, 'fire-fighter')).toBe(true)
    expect(checkEmojiAnswer(question, 'astronaut')).toBe(false)
    expect(checkEmojiAnswer(question, '   ')).toBe(false)
  })

  it('scores ten points per decoded answer', () => {
    const result = scoreEmojiDecode(
      EMOJI_DECODE_QUESTIONS.slice(0, 3).map((question, index) => ({
        questionId: question.id,
        guess: index < 2 ? question.answer : 'nope',
        correct: index < 2,
      }))
    )
    expect(result.solved).toBe(2)
    expect(result.attempted).toBe(3)
    expect(result.score).toBe(20)
    expect(result.maximum).toBe(150)
  })
})

describe('Gardimon Protocol', () => {
  it('has five unique cards across three phases', () => {
    expect(GARDIMON_ROUNDS).toHaveLength(5)
    expect(GARDIMON_PHASES).toEqual(['Crime Scene', 'Evidence', 'Protocol'])
    expect(new Set(GARDIMON_ROUNDS.map((round) => round.card.id)).size).toBe(5)
    expect(new Set(GARDIMON_ROUNDS.map((round) => round.card.name)).size).toBe(5)
  })

  it('marks exactly one correct option per phase', () => {
    for (const round of GARDIMON_ROUNDS) {
      for (const phase of GARDIMON_PHASES) {
        const block = round[phase === 'Crime Scene' ? 'crimeScene' : phase === 'Evidence' ? 'evidence' : 'protocol']
        const correct = block.options.filter((option) => option.id === block.correctOptionId)
        expect(correct).toHaveLength(1)
        expect(isCorrectPick(round, phase, block.correctOptionId)).toBe(true)
        const wrong = block.options.find((option) => option.id !== block.correctOptionId)!
        expect(isCorrectPick(round, phase, wrong.id)).toBe(false)
      }
    }
  })

  it('pays the perfect bonus only for a clean card', () => {
    const round = GARDIMON_ROUNDS[0]
    const correct = Object.fromEntries(
      GARDIMON_PHASES.map((phase) => [
        phase,
        round[phase === 'Crime Scene' ? 'crimeScene' : phase === 'Evidence' ? 'evidence' : 'protocol'].correctOptionId,
      ])
    )
    const perfect = scoreGardimonRound(round, correct)
    expect(perfect.perfect).toBe(true)
    expect(perfect.score).toBe(45)
    expect(gardimonMaximumScore()).toBe(225)

    const partial = scoreGardimonRound(round, { 'Crime Scene': correct['Crime Scene'] })
    expect(partial.perfect).toBe(false)
    expect(partial.score).toBe(10)
    expect(scoreGardimonRound(round, {}).score).toBe(0)
  })
})

describe('Word Assembly', () => {
  it('deals twenty cards for five four-letter questions', () => {
    const state = createWordAssemblyState(seededRandom(7))
    expect(WORD_ASSEMBLY_QUESTIONS).toHaveLength(5)
    expect(WORD_ASSEMBLY_CARD_COUNT).toBe(20)
    expect(state.board).toHaveLength(20)
    expect(new Set(state.board.map((card) => card.id)).size).toBe(20)
    for (const question of WORD_ASSEMBLY_QUESTIONS) {
      expect(state.board.filter((card) => card.questionId === question.id)).toHaveLength(4)
    }
  })

  it('locks a card only on its own question and slot', () => {
    const state = createWordAssemblyState(seededRandom(11))
    const question = WORD_ASSEMBLY_QUESTIONS[0]
    const card = state.board.find((entry) => entry.questionId === question.id && entry.slot === 1)!

    const wrongSlot = placeWordAssemblyCard(state, card.id, question.id, 2)
    expect(wrongSlot.placement).toBe('mismatch')
    expect(wrongSlot.state.mismatches).toBe(1)
    expect(wrongSlot.state.board).toHaveLength(20)

    const wrongQuestion = placeWordAssemblyCard(state, card.id, WORD_ASSEMBLY_QUESTIONS[1].id, 1)
    expect(wrongQuestion.placement).toBe('mismatch')

    const correct = placeWordAssemblyCard(state, card.id, question.id, 1)
    expect(correct.placement).toBe('matched')
    expect(correct.state.board).toHaveLength(19)
    expect(correct.state.placed[question.id]?.[1]).toBe(question.answer[1])
  })

  it('closes a question only when every letter matches', () => {
    let state = createWordAssemblyState(seededRandom(3))
    const question = WORD_ASSEMBLY_QUESTIONS[2]
    for (let slot = 0; slot < question.answer.length; slot += 1) {
      const card = state.board.find((entry) => entry.questionId === question.id && entry.slot === slot)!
      state = placeWordAssemblyCard(state, card.id, question.id, slot).state
    }
    const score = scoreWordAssembly(state)
    expect(score.matched).toBe(4)
    expect(score.questionsSolved).toBe(1)
    expect(score.mismatches).toBe(0)
    expect(score.score).toBe(40)
    expect(state.board).toHaveLength(16)
  })
})

describe('Incident Trail', () => {
  it('ships five scenes, five clues and twenty five answer sheets', () => {
    expect(INCIDENT_TRAIL_SCENES).toHaveLength(5)
    expect(INCIDENT_TRAIL_CLUES).toHaveLength(5)
    expect(INCIDENT_TRAIL_INFORMATION).toHaveLength(25)
    expect(INCIDENT_TRAIL_ANSWER_SHEET_COUNT).toBe(25)
    for (const piece of INCIDENT_TRAIL_INFORMATION) {
      expect(piece.answerSheet.length).toBeGreaterThan(10)
    }
  })

  it('points every clue at one information piece inside the box', () => {
    for (const clue of INCIDENT_TRAIL_CLUES) {
      expect(clue.informationIndex).toBeGreaterThanOrEqual(0)
      expect(clue.informationIndex).toBeLessThan(INCIDENT_TRAIL_INFORMATION.length)
      expect(isClueCorrectForScene(clue.id, clue.sceneId)).toBe(true)
      const wrongScene = INCIDENT_TRAIL_SCENES.find((scene) => scene.id !== clue.sceneId)!
      expect(isClueCorrectForScene(clue.id, wrongScene.id)).toBe(false)
    }
  })

  it('only scores a scene when the filed clue belongs to it', () => {
    const clue = INCIDENT_TRAIL_CLUES[0]
    const wrongScene = INCIDENT_TRAIL_SCENES.find((scene) => scene.id !== clue.sceneId)!
    const wrong = assignIncidentTrailClue({}, clue.id, wrongScene.id)
    expect(wrong.correct).toBe(false)
    expect(scoreIncidentTrail(wrong.assignments).solved).toBe(0)

    const right = assignIncidentTrailClue(wrong.assignments, clue.id, clue.sceneId)
    expect(right.correct).toBe(true)
    const score = scoreIncidentTrail(right.assignments)
    expect(score.solved).toBe(1)
    expect(score.score).toBe(20)
    expect(score.maximum).toBe(100)
    expect(score.complete).toBe(false)
  })

  it('keeps a single clue per scene when it is re-filed', () => {
    const first = INCIDENT_TRAIL_CLUES[0]
    const second = INCIDENT_TRAIL_CLUES[1]
    let assignments = assignIncidentTrailClue({}, first.id, first.sceneId).assignments
    assignments = assignIncidentTrailClue(assignments, second.id, second.sceneId).assignments
    assignments = assignIncidentTrailClue(assignments, first.id, second.sceneId).assignments

    expect(Object.values(assignments)).toHaveLength(1)
    expect(assignments[second.sceneId]).toBe(first.id)
  })

  it('searches headlines, details and answer sheets', () => {
    expect(searchIncidentTrail('')).toHaveLength(25)
    expect(searchIncidentTrail('badge')).toHaveLength(1)
    expect(searchIncidentTrail('starlight')).toHaveLength(1)
    expect(searchIncidentTrail('lens tray')).toHaveLength(1)
    expect(searchIncidentTrail('zzz')).toHaveLength(0)
  })
})

describe('Jaws of Risk', () => {
  it('builds twenty four teeth with the requested number of loose ones', () => {
    const board = createJawsBoard(seededRandom(5))
    expect(board.teeth).toHaveLength(JAWS_TOOTH_COUNT)
    expect(board.looseIds).toHaveLength(JAWS_LOOSE_COUNT)
    expect(new Set(board.looseIds).size).toBe(JAWS_LOOSE_COUNT)
    for (const id of board.looseIds) {
      expect(board.teeth.some((tooth) => tooth.id === id)).toBe(true)
    }
  })

  it('labels a tooth before the press and grades it afterwards', () => {
    let board = createJawsBoard(seededRandom(21))
    const [firstLoose, secondLoose] = board.looseIds
    const firmTooth = board.teeth.find(
      (tooth) => tooth.id !== firstLoose && tooth.id !== secondLoose
    )!

    board = toggleJawSelection(board, firstLoose)
    expect(board.teeth.find((tooth) => tooth.id === firstLoose)?.label).toBe('Suspect')
    board = toggleJawSelection(board, firstLoose)
    expect(board.teeth.find((tooth) => tooth.id === firstLoose)?.label).toBe('Firm')

    board = setJawLabel(board, firstLoose, 'Suspect')
    board = setJawLabel(board, secondLoose, 'Suspect')
    board = setJawLabel(board, firmTooth.id, 'Suspect')

    const outcome = evaluateJawsBoard(board)
    expect(outcome.hits).toHaveLength(2)
    expect(outcome.falseFlags).toEqual([firmTooth.id])
    expect(outcome.misses).toHaveLength(JAWS_LOOSE_COUNT - 2)
    expect(outcome.score).toBe(2 * 10 - 5)
    expect(outcome.maximum).toBe(JAWS_LOOSE_COUNT * 10)
  })

  it('never drops below zero for an all-wrong press', () => {
    const board = createJawsBoard(seededRandom(9))
    const flagged = board.teeth
      .filter((tooth) => !board.looseIds.includes(tooth.id))
      .reduce((current, tooth) => setJawLabel(current, tooth.id, 'Suspect'), board)
    const outcome = evaluateJawsBoard(flagged)
    expect(outcome.hits).toHaveLength(0)
    expect(outcome.falseFlags.length).toBe(JAWS_TOOTH_COUNT - JAWS_LOOSE_COUNT)
    expect(outcome.score).toBe(0)
  })
})

describe('Save the Core', () => {
  it('builds a track with bombs, a start and a core', () => {
    const state = createCoreGame(seededRandom(13))
    expect(state.tiles).toHaveLength(CORE_TRACK_LENGTH)
    expect(state.tiles[0].kind).toBe('start')
    expect(state.tiles.at(-1)?.kind).toBe('core')
    expect(state.tiles.slice(1, -1).filter((tile) => tile.kind === 'bomb').length).toBeGreaterThan(0)
    expect(state.players).toHaveLength(4)
    expect(state.players.every((player) => player.position === 0 && player.score === 0)).toBe(true)
    expect(state.tiles.filter((tile) => tile.kind === 'safe').every((tile) => tile.score > 0)).toBe(true)
  })

  it('reveals a score on a safe tile only the first time', () => {
    const state = createCoreGame(seededRandom(4))
    const safeIndex = state.tiles.findIndex((tile, index) => index > 0 && tile.kind === 'safe')
    const first = playCoreTurn(state, seededRandom(1), safeIndex)
    expect(first.outcome).toBe('advanced')
    expect(first.revealedScore).toBe(state.tiles[safeIndex].score)
    expect(first.state.players[0].score).toBe(first.revealedScore)

    const second = playCoreTurn(first.state, seededRandom(1), safeIndex)
    expect(second.revealedScore).toBe(0)
    expect(second.state.tiles[safeIndex].score).toBe(state.tiles[safeIndex].score)
  })

  it('sends a piece back to the start when it lands on a bomb', () => {
    const state = createCoreGame(seededRandom(17))
    const bombIndex = state.tiles.findIndex((tile) => tile.kind === 'bomb')
    const result = playCoreTurn(state, seededRandom(1), bombIndex)
    expect(result.outcome).toBe('bomb')
    expect(result.state.players[0].position).toBe(0)
    expect(result.state.tiles[bombIndex].revealed).toBe(true)
    expect(result.state.log.at(-1)?.text).toMatch(/returns to the start/)
  })

  it('finishes a player on the core and awards the bonus', () => {
    const state = createCoreGame(seededRandom(23))
    const lastIndex = state.tiles.length - 1
    const atTheDoor = {
      ...state,
      players: state.players.map((player, index) =>
        index === 0 ? { ...player, position: lastIndex - 2, score: 15 } : player
      ),
    }
    const result = playCoreTurn(atTheDoor, seededRandom(1), 2)
    expect(result.outcome).toBe('core')
    expect(result.revealedScore).toBe(CORE_FINISH_BONUS)
    expect(result.state.players[0].finished).toBe(true)
    expect(result.state.players[0].score).toBe(15 + CORE_FINISH_BONUS)
  })

  it('passes the turn on and stops once everyone is safe', () => {
    let state = createCoreGame(seededRandom(31))
    expect(state.turnIndex).toBe(0)
    state = playCoreTurn(state, seededRandom(1), 3).state
    expect(state.turnIndex).toBe(1)
    expect(state.log).toHaveLength(1)

    const finished = {
      ...state,
      players: state.players.map((player) => ({ ...player, finished: true })),
    }
    const result = playCoreTurn(finished, seededRandom(1), 3)
    expect(result.state.over).toBe(true)
  })
})