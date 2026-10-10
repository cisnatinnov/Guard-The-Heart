import { describe, it, expect } from 'vitest'
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
  applyAnswer,
  applyPassedAnswer,
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
  it('lists the three playable challenges in order', () => {
    expect(CHALLENGE_GAMES.map((game) => game.title)).toEqual([
      'Image Decode',
      'Match Card',
      'Jaws of Risk',
    ])
    expect(challengeGameInfo('emoji-decode').title).toBe('Image Decode')
    expect(challengeGameInfo('word-assembly').title).toBe('Match Card')
  })

  it('maps former titles and retires removed challenges', () => {
    expect(RENAMED_CHALLENGE_TITLES).toEqual({
      'Emoji Decode': 'Image Decode',
      'Word Assembly': 'Match Card',
    })
    expect(REMOVED_CHALLENGE_TITLES).toEqual(['Gardimon Protocol', 'Incident Trail', 'Save the Core'])
    for (const title of REMOVED_CHALLENGE_TITLES) {
      expect(CHALLENGE_GAMES.some((game) => game.title === title)).toBe(false)
    }
  })

  it('links each game to its supplied question reference deck', () => {
    expect(CHALLENGE_GAMES.filter((game) => game.deckPath).map((game) => game.id)).toEqual([
      'emoji-decode',
      'word-assembly',
      'jaws-of-risk',
    ])
    expect(CHALLENGE_GAMES[0].deckPath).toMatch(/Image_Decode\.pptx$/)
  })

  it('uses the configured timer for question-based team runs only', () => {
    expect(challengeQuestionsFor('emoji-decode').secondsPerQuestion).toBe(30)
    expect(challengeQuestionsFor('word-assembly').secondsPerQuestion).toBe(15)
    expect(challengeQuestionsFor('jaws-of-risk').secondsPerQuestion).toBeUndefined()
  })
})

describe('team challenge turns', () => {
  it('scores self answers and passed answers using the challenge rules', () => {
    let run = startChallengeRun({ challenge: 'challenge-id', teams: ['alpha', 'beta'], questionCount: 1, pointsPerQuestion: 10 })
    run = applyAnswer(run, 'alpha', { points: -10, correct: false }).run
    expect(run.runs[0].score).toBe(-10)
    run = applyPassedAnswer(run, 'beta', 'alpha', true)
    expect(run.runs.map((entry) => entry.score)).toEqual([-5, -10])
    expect(run.questionResolved).toBe(true)
  })

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
    expect(result.score).toBe(20)
    expect(result.maximum).toBe(110)
  })
})

describe('Match Card', () => {
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
