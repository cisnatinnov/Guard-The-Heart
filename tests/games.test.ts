import reference from '../src/data/reference-question-bank.json'
import { describe, it, expect, vi } from 'vitest'
import {
  CHALLENGE_GAMES,
  EMOJI_DECODE_EMOJIS_PER_QUESTION,
  EMOJI_DECODE_QUESTIONS,
  JAWS_LOOSE_COUNT,
  JAWS_SOLO_TOOTH_COUNT,
  JAWS_TOOTH_COUNT,
  REMOVED_CHALLENGE_TITLES,
  RENAMED_CHALLENGE_TITLES,
  WORD_ASSEMBLY_CARD_COUNT,
  WORD_ASSEMBLY_QUESTIONS,
  challengeGameInfo,
  checkEmojiAnswer,
  closeUnmatchedWordAssemblyCards,
  createJawsBoard,
  createWordAssemblyState,
  evaluateJawsBoard,
  normalizeEmojiAnswer,
  revealWordAssemblyCard,
  scoreEmojiDecode,
  scoreWordAssembly,
  setJawLabel,
  toggleJawSelection,
} from '../src/services/games'
import { challengeQuestionsFor } from '../src/services/games/challengeQuestions'
import {
  enableRunMatching,
  advanceMatchingTurn,
  advanceMatchingTransition,
  chooseMatchingAnswerTeam,
  isMatchingQuestionUnlocked,
  flipRunCard,
  applyAnswer,
  applyPassedAnswer,
  beginNextQuestion,
  isRunComplete,
  startChallengeRun,
  teamForQuestion,
} from '../src/services/games/teamRun'

function finishMatchingDelay(run: ReturnType<typeof startChallengeRun>) {
  return advanceMatchingTransition({ ...run, turnDeadline: Date.now() - 1 })
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('challenge registry', () => {
  it('lists the three playable challenges in order', () => {
    expect(CHALLENGE_GAMES.map((game) => game.title)).toEqual([
      'Challenge 1 - Image Decode',
      'Challenge 2 - Flipping Connect',
      'Challenge 3 - Jaw of Risk',
    ])
    expect(challengeGameInfo('emoji-decode').title).toBe('Challenge 1 - Image Decode')
    expect(challengeGameInfo('word-assembly').title).toBe('Challenge 2 - Flipping Connect')
  })

  it('maps former titles and retires removed challenges', () => {
    expect(RENAMED_CHALLENGE_TITLES).toEqual({
      'Emoji Decode': 'Challenge 1 - Image Decode',
      'Image Decode': 'Challenge 1 - Image Decode',
      'Word Assembly': 'Challenge 2 - Flipping Connect',
      'Match Card': 'Challenge 2 - Flipping Connect',
      'Flipping Connect': 'Challenge 2 - Flipping Connect',
      'Flipping Card': 'Challenge 2 - Flipping Connect',
      'Challenge 2 - Flipping Card': 'Challenge 2 - Flipping Connect',
      'Jaws of Risk': 'Challenge 3 - Jaw of Risk',
      'Jaw of Risk': 'Challenge 3 - Jaw of Risk',
    })
    expect(REMOVED_CHALLENGE_TITLES).toEqual(['Gardimon Protocol', 'Incident Trail', 'Save the Core'])
    for (const title of REMOVED_CHALLENGE_TITLES) {
      expect(CHALLENGE_GAMES.some((game) => game.title === title)).toBe(false)
    }
  })

  it('links question games to their supplied reference decks', () => {
    expect(CHALLENGE_GAMES.filter((game) => game.deckPath).map((game) => game.id)).toEqual([
      'emoji-decode',
    ])
    expect(CHALLENGE_GAMES[0].deckPath).toMatch(/Image_Decode\.pptx$/)
  })

  it('uses the configured timer for question-based team runs only', () => {
    expect(challengeQuestionsFor('emoji-decode').secondsPerQuestion).toBe(15)
    expect(challengeQuestionsFor('word-assembly').secondsPerQuestion).toBe(15)
    expect(challengeQuestionsFor('jaws-of-risk').secondsPerQuestion).toBe(15)
  })
})

describe('team challenge turns', () => {
  it('completes matching-only pairs without scoring or opening questions', () => {
    let run = { ...enableRunMatching(startChallengeRun({ challenge: 'matching', teams: ['a', 'b'], questionCount: 10, pointsPerQuestion: 10 })), matchingOnly: true }
    for (let pair = 1; pair <= 10; pair++) {
      const cards = run.matchingBoard!.board.filter((card) => card.questionId === `word-${pair}`)
      run = flipRunCard(flipRunCard(run, cards[0].id), cards[1].id) as typeof run
      expect(isMatchingQuestionUnlocked(run)).toBe(false)
      expect(run.matchingBoard!.revealed).toEqual([])
    }
    expect(run.runs.map((team) => team.score)).toEqual([0, 0])
    expect(isRunComplete(run)).toBe(true)
  })

  it('locks questions until matching and keeps the first miss on the same team', () => {
    let run = enableRunMatching(startChallengeRun({ challenge: 'matching', teams: ['alpha', 'beta'], questionCount: 10, pointsPerQuestion: 10 }))
    expect(() => applyAnswer(run, 'alpha', { points: 10, correct: true })).toThrow('Match a pair first')
    const pair = run.matchingBoard!.board.filter((card) => card.questionId === 'word-1')
    run = flipRunCard(run, pair[0].id)
    run = flipRunCard(run, pair[1].id)
    expect(run.matchingBoard!.matchedQuestionIds).toEqual(['word-1'])
    expect(run.matchingPhase).toBe('matched-delay')
    expect(isMatchingQuestionUnlocked(run)).toBe(false)
    const otherCard = run.matchingBoard!.board.find((card) => !run.matchingBoard!.matchedCardIds.includes(card.id))!
    expect(flipRunCard(run, otherCard.id)).toBe(run)
    run = finishMatchingDelay(run)
    run = chooseMatchingAnswerTeam(run, 'alpha')
    run = applyAnswer(run, 'alpha', { points: -10, correct: false }).run
    expect(teamForQuestion(run)?.team).toBe('alpha')
    expect(run.answerAttempts).toBe(1)
    expect(run.runs[0].score).toBe(0)
    run = applyAnswer(run, 'alpha', { points: -10, correct: false }).run
    expect(teamForQuestion(run)?.team).toBe('beta')
    expect(run.answerAttempts).toBe(0)
    run = finishMatchingDelay(run)
    run = applyAnswer(run, 'beta', { points: 10, correct: true }).run
    run = beginNextQuestion(run)
    expect(run.matchingBoard!.matchedQuestionIds).toHaveLength(1)
    expect(() => applyAnswer(run, 'beta', { points: 10, correct: true })).toThrow('Match a pair first')
  })

  it('rotates the matching turn after a mismatch and a 20-second timeout', () => {
    vi.useFakeTimers()
    try {
      let run = enableRunMatching(startChallengeRun({ challenge: 'matching', teams: ['alpha', 'beta'], questionCount: 21, pointsPerQuestion: 10 }))
      const first = run.matchingBoard!.board[0]
      const other = run.matchingBoard!.board.find((card) => card.questionId !== first.questionId)!
      run = flipRunCard(flipRunCard(run, first.id), other.id)
      run = advanceMatchingTurn(run)
      expect(teamForQuestion(run)?.team).toBe('beta')
      expect(run.runs.map((entry) => entry.score)).toEqual([0, 0])
      expect(run.matchingBoard!.revealed).toEqual([])
      expect(isMatchingQuestionUnlocked(run)).toBe(false)
      expect(advanceMatchingTurn(run, true)).toBe(run)
      vi.advanceTimersByTime(20000)
      expect(flipRunCard(run, first.id)).toBe(run)
      run = advanceMatchingTurn(run, true)
      expect(teamForQuestion(run)?.team).toBe('alpha')
      expect(run.questionIndex).toBe(0)
    } finally { vi.useRealTimers() }
  })

  it('commits the given question to the recipient and preserves matching roulette order', () => {
    let run = enableRunMatching(startChallengeRun({ challenge: 'matching', teams: ['alpha', 'beta', 'gamma'], questionCount: 21, pointsPerQuestion: 10 }))
    expect(() => chooseMatchingAnswerTeam(run, 'gamma')).toThrow('Match a pair')
    const pair = run.matchingBoard!.board.filter((card) => card.questionId === 'word-1')
    run = flipRunCard(flipRunCard(run, pair[0].id), pair[1].id)
    run = finishMatchingDelay(run)
    expect(run.matchingPhase).toBe('choice')
    expect(run.turnDeadline).toBeUndefined()
    expect(() => applyAnswer(run, 'alpha', { points: 10, correct: true })).toThrow('Choose who')
    run = chooseMatchingAnswerTeam(run, 'gamma')
    expect(teamForQuestion(run)?.team).toBe('gamma')
    const deadline = run.turnDeadline
    run = applyAnswer(run, 'gamma', { points: -10, correct: false }).run
    expect(run.answerAttempts).toBe(1)
    expect(run.turnDeadline).toBe(deadline)
    expect(run.runs.map((entry) => entry.score)).toEqual([0, 0, 0])
    run = applyAnswer(run, 'gamma', { points: 10, correct: true }).run
    expect(run.runs.map((entry) => entry.score)).toEqual([-10, 0, 5])
    run = beginNextQuestion(run)
    expect(teamForQuestion(run)?.team).toBe('beta')
    expect(run.matchingPhase).toBe('matching')
  })

  it('refreshes matching boards and completes all 21 questions without losing scores', () => {
    let run = enableRunMatching(startChallengeRun({ challenge: 'matching', teams: ['alpha'], questionCount: 21, pointsPerQuestion: 10 }))
    for (let index = 0; index < 21; index++) {
      const board = run.matchingBoard!
      const first = board.board.find((card) => !board.matchedCardIds.includes(card.id))!
      const pair = board.board.filter((card) => card.questionId === first.questionId)
      run = flipRunCard(flipRunCard(run, pair[0].id), pair[1].id)
      run = finishMatchingDelay(run)
      run = chooseMatchingAnswerTeam(run, 'alpha')
      run = applyAnswer(run, 'alpha', { points: 10, correct: true }).run
      if (index < 20) run = beginNextQuestion(run)
      if (index === 9) expect(run.matchingBoard!.matchedCardIds).toHaveLength(0)
      if (index === 19) expect(run.matchingBoard!.board).toHaveLength(2)
    }
    expect(isRunComplete(run)).toBe(true)
    expect(run.runs[0].score).toBe(210)
  })

  it('exhausts two given-answer attempts and keeps the giver eligible to answer', () => {
    let run = enableRunMatching(startChallengeRun({ challenge: 'matching', teams: ['alpha', 'beta', 'gamma'], questionCount: 21, pointsPerQuestion: 10 }))
    const pair = run.matchingBoard!.board.filter((card) => card.questionId === 'word-1')
    run = flipRunCard(flipRunCard(run, pair[0].id), pair[1].id)
    run = finishMatchingDelay(run)
    run = chooseMatchingAnswerTeam(run, 'gamma')
    run = applyAnswer(run, 'gamma', { points: -10, correct: false }).run
    run = applyAnswer(run, 'gamma', { points: -10, correct: false }).run
    expect(run.runs.map((entry) => entry.score)).toEqual([-5, 0, -5])
    expect(run.matchingPhase).toBe('handoff-delay')
    run = finishMatchingDelay(run)
    expect(teamForQuestion(run)?.team).toBe('alpha')
    expect(run.questionResolved).toBe(false)
    expect(run.passedByTeam).toBeUndefined()
    run = applyAnswer(run, 'alpha', { points: 10, correct: true }).run
    expect(run.questionResolved).toBe(true)
  })

  it('keeps the question unlocked until all five actual answering teams exhaust their attempts', () => {
    const teams = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']
    let run = enableRunMatching(startChallengeRun({ challenge: 'matching', teams, questionCount: 21, pointsPerQuestion: 10 }))
    const pair = run.matchingBoard!.board.filter((card) => card.questionId === 'word-1')
    run = flipRunCard(flipRunCard(run, pair[0].id), pair[1].id)
    run = finishMatchingDelay(run)
    run = chooseMatchingAnswerTeam(run, 'beta')
    for (const [index, team] of ['beta', 'gamma', 'delta', 'epsilon', 'alpha'].entries()) {
      expect(teamForQuestion(run)?.team).toBe(team)
      run = applyAnswer(run, team, { points: -10, correct: false }).run
      expect(teamForQuestion(run)?.team).toBe(team)
      run = applyAnswer(run, team, { points: -10, correct: false }).run
      if (index < 4) run = finishMatchingDelay(run)
      expect(run.attemptedTeams).toHaveLength(index + 1)
      expect(run.questionResolved).toBe(index === 4)
      expect(run.questionIndex).toBe(0)
      expect(run.matchingPhase).toBe('answer')
    }
    run = beginNextQuestion(run)
    expect(run.questionIndex).toBe(1)
    expect(run.matchingPhase).toBe('matching')
    expect(isMatchingQuestionUnlocked(run)).toBe(false)
  })

  it('scores self answers and passed answers using the challenge rules', () => {
    let run = startChallengeRun({ challenge: 'challenge-id', teams: ['alpha', 'beta'], questionCount: 1, pointsPerQuestion: 10 })
    run = applyPassedAnswer(run, 'alpha', 'beta', true)
    expect(run.runs.map((entry) => entry.score)).toEqual([-10, 5])
    expect(run.questionResolved).toBe(true)
  })

  it('passes wrong answers and timeouts to another team, then advances after a correct answer', () => {
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
    expect(run.questionResolved).toBe(false)
    expect(teamForQuestion(run)?.team).toBe('beta')
    run = applyAnswer(run, 'beta', { points: 10, correct: true }).run
    run = beginNextQuestion(run)
    expect(run.questionIndex).toBe(2)
    expect(teamForQuestion(run)?.team).toBe('alpha')
    run = applyAnswer(run, 'alpha', { points: 10, correct: true }).run

    expect(isRunComplete(run)).toBe(true)
    expect(run.runs.map((entry) => entry.answered)).toEqual([3, 2])
    expect(run.runs.map((entry) => entry.score)).toEqual([10, 20])
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

describe('Image Decode', () => {
  it('ships the eleven clue and answer pairs from the supplied reference deck', () => {
    expect(EMOJI_DECODE_QUESTIONS).toHaveLength(11)
    for (const question of EMOJI_DECODE_QUESTIONS) {
      expect(question.emojis).toHaveLength(EMOJI_DECODE_EMOJIS_PER_QUESTION)
      for (const glyph of question.emojis) {
        expect(glyph.length).toBeGreaterThan(0)
      }
      expect(question.answer.length).toBeGreaterThan(1)
      expect(question.hint.length).toBeGreaterThan(0)
    }
    expect(EMOJI_DECODE_QUESTIONS[10].answer).toBe('Lapor')
    expect(checkEmojiAnswer(EMOJI_DECODE_QUESTIONS[10], 'Kendaraan Dinas Operasional')).toBe(false)
    expect(EMOJI_DECODE_EMOJIS_PER_QUESTION).toBe(1)
    expect(new Set(EMOJI_DECODE_QUESTIONS.map((q) => q.id)).size).toBe(11)
  })

  it('accepts loose spellings but rejects other words', () => {
    const question = EMOJI_DECODE_QUESTIONS[0]
    expect(normalizeEmojiAnswer(' Fire-Engine! ')).toBe('fireengine')
    expect(checkEmojiAnswer(question, ' rekening ')).toBe(true)
    expect(checkEmojiAnswer(question, 'REKENING')).toBe(true)
    expect(checkEmojiAnswer(question, 're-kening')).toBe(true)
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
    expect(result.score).toBe(10)
    expect(result.maximum).toBe(110)
  })
})

describe('Flipping Connect', () => {
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
    expect(scoreWordAssembly(closed)).toMatchObject({ matchedPairs: 0, mismatches: 1, score: 0 })
  })

  it('prevents opening another card while a mismatched pair is showing', () => {
    const state = createWordAssemblyState(seededRandom(4))
    const first = state.board[0]
    const different = state.board.find((card) => card.questionId !== first.questionId)!
    const opened = revealWordAssemblyCard(revealWordAssemblyCard(state, first.id), different.id)
    const third = state.board.find((card) => card.id !== first.id && card.id !== different.id)!
    expect(revealWordAssemblyCard(opened, third.id)).toBe(opened)
  })

  it('uses all 21 reference questions, including slides 43 and 44', () => {
    const set = challengeQuestionsFor('word-assembly')
    expect(set.questions).toHaveLength(21)
    expect(set.questions[0].options).toEqual(reference.matchCard[0].options)
    expect(set.questions[0].grade(reference.matchCard[0].answer)).toBe(10)
    expect(set.questions[20].sourceSlide).toBe(43)
    expect(set.questions[20].answerSlide).toBe(44)
  })
})

describe('Jaw of Risk', () => {
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

describe('reference slide ranges and answer keys', () => {
  for (const [game, bank, lastSlide] of [['word-assembly', reference.matchCard, 44], ['jaws-of-risk', reference.jawsOfRisk, 42]] as const) {
    it(`grades every ${game} question using the answer-slide highlight`, () => {
      const questions = challengeQuestionsFor(game).questions
      expect(questions).toHaveLength((lastSlide - 2) / 2)
      questions.forEach((question, index) => {
        expect(question.sourceSlide).toBe(3 + index * 2)
        expect(question.answerSlide).toBe(4 + index * 2)
        expect(question.prompt).toBe(bank[index].prompt)
        expect(question.options).toEqual(bank[index].options)
        expect(question.grade(bank[index].answer)).toBe(10)
        for (const wrong of bank[index].options.filter((option) => option !== bank[index].answer)) expect(question.grade(wrong)).toBe(0)
      })
    })
  }
})
