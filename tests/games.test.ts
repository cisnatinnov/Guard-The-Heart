import { describe, it, expect } from 'vitest'
import {
  CHALLENGE_GAMES,
  CORE_FINISH_BONUS,
  CORE_GAME_DURATION_SECONDS,
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
  JAWS_SOLO_TOOTH_COUNT,
  JAWS_TOOTH_COUNT,
  WORD_ASSEMBLY_CARD_COUNT,
  WORD_ASSEMBLY_QUESTIONS,
  assignIncidentTrailClue,
  challengeGameInfo,
  checkEmojiAnswer,
  closeUnmatchedWordAssemblyCards,
  createCoreGame,
  coreTileCoordinate,
  expireCoreGame,
  createJawsBoard,
  createWordAssemblyState,
  evaluateJawsBoard,
  gardimonMaximumScore,
  isClueCorrectForScene,
  isCorrectPick,
  normalizeEmojiAnswer,
  playCoreTurn,
  revealWordAssemblyCard,
  scoreEmojiDecode,
  scoreGardimonRound,
  scoreIncidentTrail,
  scoreWordAssembly,
  searchIncidentTrail,
  setJawLabel,
  toggleJawSelection,
  isChallengeWorkInProgress,
} from '../src/services/games'
import { challengeQuestionsFor } from '../src/services/games/challengeQuestions'
import {
  applyAnswer,
  beginNextQuestion,
  isRunComplete,
  startChallengeRun,
  teamForQuestion,
} from '../src/services/games/teamRun'

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
    expect(isChallengeWorkInProgress('gardimon-protocol')).toBe(true)
    expect(isChallengeWorkInProgress('incident-trail')).toBe(true)
    expect(isChallengeWorkInProgress('word-assembly')).toBe(false)
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
    expect(challengeQuestionsFor('save-the-core').questions).toHaveLength(0)
    expect(challengeGameInfo('save-the-core').rules).toContain(
      'Reach the Core within five minutes to finish the game and earn the 50-point bonus.'
    )
  })
})

describe('team challenge turns', () => {
  it('passes wrong answers to another team and advances after a correct answer or timeout', () => {
    let run = startChallengeRun({
      challenge: 'challenge-id',
      teams: ['alpha', 'beta'],
      questionCount: 3,
      pointsPerQuestion: 10,
    })

    expect(teamForQuestion(run)?.team).toBe('alpha')
    expect(() => beginNextQuestion(run)).toThrow('The question must be answered correctly')
    expect(() => applyAnswer(run, 'beta', { points: 10, correct: true })).toThrow(
      "It is not that team's turn to answer"
    )
    run = applyAnswer(run, 'alpha', { points: 0, correct: false }).run
    expect(run.questionIndex).toBe(0)
    expect(run.questionResolved).toBe(false)
    expect(teamForQuestion(run)?.team).toBe('beta')
    expect(() => applyAnswer(run, 'alpha', { points: 10, correct: true })).toThrow(
      "It is not that team's turn to answer"
    )
    run = applyAnswer(run, 'beta', { points: 10, correct: true }).run
    expect(run.questionResolved).toBe(true)
    run = beginNextQuestion(run)
    expect(run.questionIndex).toBe(1)
    expect(teamForQuestion(run)?.team).toBe('alpha')
    expect(run.runs.every((entry) => entry.state === 'following')).toBe(true)
    run = applyAnswer(run, 'alpha', { points: 0, correct: false, timedOut: true }).run
    expect(run.questionResolved).toBe(true)
    run = beginNextQuestion(run)
    expect(run.questionIndex).toBe(2)
    expect(teamForQuestion(run)?.team).toBe('beta')
    run = applyAnswer(run, 'beta', { points: 10, correct: true }).run

    expect(isRunComplete(run)).toBe(true)
    expect(run.runs.map((entry) => entry.answered)).toEqual([2, 2])
    expect(run.runs.map((entry) => entry.score)).toEqual([0, 20])
    expect(beginNextQuestion(run)).toEqual(run)
  })

  it('advances after every selected team misses the current question', () => {
    let run = startChallengeRun({
      challenge: 'challenge-id',
      teams: ['alpha', 'beta'],
      questionCount: 2,
      pointsPerQuestion: 10,
    })
    run = applyAnswer(run, 'alpha', { points: 0, correct: false }).run
    run = applyAnswer(run, 'beta', { points: 0, correct: false }).run
    expect(run.questionResolved).toBe(true)
    expect(teamForQuestion(run)).toBeUndefined()
    run = beginNextQuestion(run)
    expect(run.questionIndex).toBe(1)
    expect(teamForQuestion(run)?.team).toBe('alpha')
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
  it('deals two identical image cards for each of ten questions', () => {
    const state = createWordAssemblyState(seededRandom(7))
    expect(WORD_ASSEMBLY_QUESTIONS).toHaveLength(10)
    expect(WORD_ASSEMBLY_CARD_COUNT).toBe(20)
    expect(state.board).toHaveLength(20)
    expect(new Set(state.board.map((card) => card.id)).size).toBe(20)
    for (const question of WORD_ASSEMBLY_QUESTIONS) {
      const pair = state.board.filter((card) => card.questionId === question.id)
      expect(pair).toHaveLength(2)
      expect(pair[0].image).toBe(pair[1].image)
      expect(pair[0].image).toBe(question.image)
    }
    expect(WORD_ASSEMBLY_QUESTIONS.map(({ prompt, image }) => [prompt, image])).toEqual([
      ['Logo Bank Syariah', '/match-card/Syariah.png'],
      ['Bankir', '/match-card/Bankir.png'],
      ['Tembok keamanan komputer', '/match-card/Firewall.png'],
      ['Secure account', '/match-card/Secure.png'],
      ['Fraud', '/match-card/Fraud.png'],
      ['Kartu', '/match-card/Card.png'],
      ['Hukum', '/match-card/Law.png'],
      ['Laporan', '/match-card/Laporan.png'],
      ['Phishing', '/match-card/Phising.png'],
      ['Password', '/match-card/Password.png'],
    ])
  })

  it('keeps a correct matching pair face up and awards points', () => {
    const state = createWordAssemblyState(seededRandom(11))
    const question = WORD_ASSEMBLY_QUESTIONS[0]
    const pair = state.board.filter((entry) => entry.questionId === question.id)
    const first = revealWordAssemblyCard(state, pair[0].id)
    expect(first.revealed).toEqual([pair[0].id])
    const matched = revealWordAssemblyCard(first, pair[1].id)
    expect(matched.revealed).toEqual([])
    expect(matched.matchedCardIds).toEqual([pair[0].id, pair[1].id])
    expect(matched.matchedQuestionIds).toEqual([question.id])
    expect(scoreWordAssembly(matched)).toMatchObject({
      matchedPairs: 1,
      questionsSolved: 1,
      score: 10,
      maximum: 100,
    })
  })

  it('turns every open card back down after a mismatch', () => {
    const state = createWordAssemblyState(seededRandom(3))
    const first = state.board[0]
    const different = state.board.find((card) => card.questionId !== first.questionId)!
    const opened = revealWordAssemblyCard(revealWordAssemblyCard(state, first.id), different.id)
    expect(opened.revealed).toEqual([first.id, different.id])
    expect(opened.mismatches).toBe(1)

    const closed = closeUnmatchedWordAssemblyCards(opened)
    expect(closed.revealed).toEqual([])
    expect(closed.matchedCardIds).toEqual([])
    expect(scoreWordAssembly(closed)).toMatchObject({ matchedPairs: 0, mismatches: 1, score: -5 })
  })

  it('prevents opening another card while a mismatched pair is showing', () => {
    const state = createWordAssemblyState(seededRandom(4))
    const first = state.board[0]
    const different = state.board.find((card) => card.questionId !== first.questionId)!
    const opened = revealWordAssemblyCard(revealWordAssemblyCard(state, first.id), different.id)
    const third = state.board.find((card) => card.id !== first.id && card.id !== different.id)!
    expect(revealWordAssemblyCard(opened, third.id)).toBe(opened)
  })

  it('uses all ten picture prompts in team runs', () => {
    const set = challengeQuestionsFor('word-assembly')
    expect(set.questions).toHaveLength(10)
    expect(set.questions.map((question) => question.prompt)).toEqual(
      WORD_ASSEMBLY_QUESTIONS.map((question) => question.prompt)
    )
    expect(set.questions[0].grade('Syariah')).toBe(10)
    expect(set.questions[0].grade('wrong')).toBe(0)
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

  it('builds the solo mouth with only eight teeth', () => {
    const board = createJawsBoard(seededRandom(8), JAWS_LOOSE_COUNT, JAWS_SOLO_TOOTH_COUNT)
    expect(board.teeth).toHaveLength(JAWS_SOLO_TOOTH_COUNT)
    expect(board.looseIds).toHaveLength(JAWS_LOOSE_COUNT)
    expect(board.looseIds.every((id) => board.teeth.some((tooth) => tooth.id === id))).toBe(true)
    expect(board.teeth.map((tooth) => [tooth.row, tooth.column])).toEqual([
      [0, 0], [0, 1], [0, 2], [0, 3],
      [1, 0], [1, 1], [1, 2], [1, 3],
    ])
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
  it('builds a track of playable spaces and a core without a dedicated start tile', () => {
    const state = createCoreGame(seededRandom(13))
    expect(state.tiles).toHaveLength(CORE_TRACK_LENGTH)
    expect(['safe', 'bomb']).toContain(state.tiles[0].kind)
    expect(state.tiles.at(-1)?.kind).toBe('core')
    expect(state.tiles.slice(0, -1).filter((tile) => tile.kind === 'bomb').length).toBeGreaterThan(0)
    expect(state.players).toHaveLength(4)
    expect(state.players.every(
      (player) => player.position === player.startPosition && player.position < CORE_TRACK_LENGTH - 1 && player.score === 0
    )).toBe(true)
    expect(new Set(state.players.map((player) => player.startPosition)).size).toBe(4)
    expect(CORE_GAME_DURATION_SECONDS).toBe(300)
    expect(state.tiles.filter((tile) => tile.kind === 'safe').every((tile) => tile.score > 0)).toBe(true)
  })

  it('maps the 24 track spaces to chess coordinates', () => {
    expect([0, 2, 5, 8, 15, 16, 23].map(coreTileCoordinate)).toEqual([
      'a5',
      'c5',
      'f5',
      'h6',
      'a6',
      'a7',
      'h7',
    ])
    expect(() => coreTileCoordinate(CORE_TRACK_LENGTH)).toThrow(RangeError)
  })

  it('reveals a score on a safe tile only the first time', () => {
    const state = createCoreGame(seededRandom(4))
    const safeIndex = state.tiles.findIndex((tile, index) => index > 0 && index <= 6 && tile.kind === 'safe')
    const fromStart = {
      ...state,
      players: state.players.map((player, index) =>
        index === 0 ? { ...player, position: 0, startPosition: 0 } : player
      ),
    }
    const first = playCoreTurn(fromStart, seededRandom(1), safeIndex)
    expect(first.outcome).toBe('advanced')
    expect(first.revealedScore).toBe(state.tiles[safeIndex].score)
    expect(first.state.players[0].score).toBe(first.revealedScore)

    const nextPlayer = first.state.players[first.state.turnIndex]
    const secondFromStart = {
      ...first.state,
      players: first.state.players.map((player) =>
        player.id === nextPlayer.id ? { ...player, position: 0 } : player
      ),
    }
    const second = playCoreTurn(secondFromStart, seededRandom(1), safeIndex)
    expect(second.revealedScore).toBe(0)
    expect(second.state.tiles[safeIndex].score).toBe(state.tiles[safeIndex].score)
  })

  it('sends a piece back to the start when it lands on a bomb', () => {
    const state = createCoreGame(seededRandom(17))
    const bombIndex = state.tiles.findIndex((tile, index) => index > 0 && index <= 6 && tile.kind === 'bomb')
    const fromStart = {
      ...state,
      players: state.players.map((player, index) =>
        index === 0 ? { ...player, position: 0, startPosition: 0 } : player
      ),
    }
    const result = playCoreTurn(fromStart, seededRandom(1), bombIndex)
    expect(result.outcome).toBe('bomb')
    expect(result.state.players[0].position).toBe(0)
    expect(result.state.tiles[bombIndex].revealed).toBe(true)
    expect(result.state.log.at(-1)?.text).toMatch(/returns to their starting square/)
  })

  it('returns a guardian to its chosen starting square after a bomb', () => {
    const initial = createCoreGame(seededRandom(17))
    const bombIndex = 9
    const positioned = {
      ...initial,
      tiles: initial.tiles.map((tile) =>
        tile.index === bombIndex ? { ...tile, kind: 'bomb' as const, revealed: false } : tile
      ),
      players: initial.players.map((player, index) =>
        index === 0 ? { ...player, startPosition: 3, position: bombIndex - 1 } : player
      ),
    }

    const result = playCoreTurn(positioned, seededRandom(1), 1)
    expect(result.outcome).toBe('bomb')
    expect(result.state.players[0].position).toBe(3)
    expect(result.state.log.at(-1)?.text).toContain('starting square (d5)')
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
    expect(result.state.over).toBe(true)
    expect(result.state.endReason).toBe('core')
  })

  it('passes the turn on and stops once everyone is safe', () => {
    let state = createCoreGame(seededRandom(31))
    expect(state.turnIndex).toBe(0)
    const safeIndex = state.tiles.findIndex(
      (tile, index) => index > 0 && index <= 6 && tile.kind === 'safe'
    )
    state = playCoreTurn(
      {
        ...state,
        players: state.players.map((player, index) =>
          index === 0 ? { ...player, position: 0, startPosition: 0 } : player
        ),
      },
      seededRandom(1),
      safeIndex
    ).state
    expect(state.turnIndex).toBe(1)
    expect(state.log).toHaveLength(1)

    const finished = {
      ...state,
      players: state.players.map((player) => ({ ...player, finished: true })),
    }
    const result = playCoreTurn(finished, seededRandom(1), 3)
    expect(result.state.over).toBe(true)
  })

  it('supports selected teams as randomly placed pawns', () => {
    const state = createCoreGame(seededRandom(7), {
      players: [
        { id: 'team-a', name: 'Team A', icon: '🛡️', color: '#027479' },
        { id: 'team-b', name: 'Team B', icon: '⚔️', color: '#a9470c' },
      ],
    })
    expect(state.players.map((player) => player.name)).toEqual(['Team A', 'Team B'])
    expect(state.players.every((player) => player.position === player.startPosition)).toBe(true)
    expect(new Set(state.players.map((player) => player.position)).size).toBe(2)
  })

  it('finalizes scores on timeout and prevents any further turns', () => {
    const state = createCoreGame(seededRandom(18))
    const timedOut = expireCoreGame(state)
    expect(timedOut.over).toBe(true)
    expect(timedOut.endReason).toBe('timeout')
    expect(expireCoreGame(timedOut)).toBe(timedOut)
    expect(playCoreTurn(timedOut, seededRandom(1), 6)).toEqual({
      state: timedOut,
      die: 0,
      outcome: 'finished',
      revealedScore: 0,
    })
  })
})