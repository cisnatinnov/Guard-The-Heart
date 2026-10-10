import { useEffect, useMemo, useState } from 'react'
import {
  WORD_ASSEMBLY_QUESTIONS,
  closeUnmatchedWordAssemblyCards,
  createWordAssemblyState,
  revealWordAssemblyCard,
  scoreWordAssembly,
} from '../../services/games'
import { getGameQuestions, type GameQuestionRecord } from '../../services/gameQuestionCache'

const MISMATCH_REVEAL_MS = 900
// Representative revealed-card positions from the supplied reveal reference.
const REFERENCE_ART: Record<string, number> = {
  'word-1': 7, 'word-2': 13, 'word-3': 5, 'word-4': 3, 'word-5': 1,
  'word-6': 2, 'word-7': 4, 'word-8': 8, 'word-9': 9, 'word-10': 15,
}

export function WordAssemblyView() {
  const questionBank = getGameQuestions('match-card')
  const [roundQuestions, setRoundQuestions] = useState(() => drawQuestions(questionBank))
  const [state, setState] = useState(createWordAssemblyState)
  const [flash, setFlash] = useState<'mismatch' | 'matched' | null>(null)
  const [activeQuestion, setActiveQuestion] = useState<GameQuestionRecord | null>(null)
  const [answer, setAnswer] = useState('')
  const [answerAttempts, setAnswerAttempts] = useState(0)
  const [answerFeedback, setAnswerFeedback] = useState<string | null>(null)
  const answerFinished = answerFeedback?.startsWith('Correct') || answerAttempts >= 2

  const score = useMemo(() => scoreWordAssembly(state), [state])
  const matchedPair = WORD_ASSEMBLY_QUESTIONS.find(
    (question) => question.id === state.matchedQuestionIds[state.matchedQuestionIds.length - 1]
  )

  useEffect(() => {
    if (state.revealed.length !== 2) return

    const timer = window.setTimeout(() => {
      setState(closeUnmatchedWordAssemblyCards)
      setFlash(null)
    }, MISMATCH_REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [state])

  function handleTile(cardId: string) {
    const next = revealWordAssemblyCard(state, cardId)
    if (next === state) return
    setState(next)
    if (next.mismatches > state.mismatches) setFlash('mismatch')
    else if (next.matchedQuestionIds.length > state.matchedQuestionIds.length) {
      setFlash('matched')
        setActiveQuestion(roundQuestions[next.matchedQuestionIds.length - 1] ?? null)
      setAnswer('')
      setAnswerAttempts(0)
      setAnswerFeedback(null)
    }
  }

  function restart() {
    setState(createWordAssemblyState())
    setFlash(null)
    setActiveQuestion(null)
    setAnswer('')
    setAnswerAttempts(0)
    setAnswerFeedback(null)
    setRoundQuestions(drawQuestions(questionBank))
  }

  return (
    <div className="game">
      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">Pairs matched</span>
          <span className="stat__value">
            {score.matchedPairs}/{WORD_ASSEMBLY_QUESTIONS.length}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Misplays</span>
          <span className="stat__value">{score.mismatches}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Score</span>
          <span className="stat__value">
            {score.score}/{score.maximum}
          </span>
        </div>
      </div>

      <p className="muted">Find both cards with the same picture for each question:</p>
      <p className="muted">Match a pair first to unlock its question. Each question allows two answer attempts.</p>

      {flash && (
        <p className={flash === 'mismatch' ? 'alert alert--error' : 'alert alert--ok'}>
          {flash === 'mismatch'
            ? 'The pictures do not match. All open cards will turn back over.'
            : 'Match found.'}
        </p>
      )}

      {activeQuestion && (() => {
        const question = activeQuestion
        return <form className="match-question" onSubmit={(event) => {
          event.preventDefault()
          if (answerFinished) return
          const nextAttempts = answerAttempts + 1
          setAnswerAttempts(nextAttempts)
          if (answer.trim() === question.answer) {
            setAnswerFeedback(`Correct! ${question.answer}`)
          } else if (nextAttempts >= 2) {
            setAnswerFeedback(`Answer: ${question.answer}`)
          } else {
            setAnswerFeedback('Not quite. One chance left.')
          }
        }}>
          <div className="match-question__heading">
            <img src={`/match-card/reference/reveal-${String(REFERENCE_ART[matchedPair?.id ?? ''] ?? 1).padStart(2, '0')}.webp`} alt="Matched picture" />
            <div><p className="match-question__eyebrow">Matched pair · Question {score.matchedPairs}</p><h3>{question.prompt}</h3></div>
          </div>
          <fieldset className="game-options" disabled={!!answerFinished}>
            <legend>Choose the best answer. You have two attempts.</legend>
            {question.options.map((option, index) => (
              <label className="game-options__choice" key={option}>
                <input type="radio" name="match-card-answer" value={option} checked={answer === option} onChange={() => setAnswer(option)} />
                <span><b>{String.fromCharCode(65 + index)}</b>{option}</span>
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={!answer || !!answerFinished}>Answer</button>
          <p className="muted">Attempts: {answerAttempts}/2</p>
          {answerFeedback && <p className={answerFeedback.startsWith('Correct') ? 'alert alert--ok' : 'alert alert--info'} role="status">{answerFeedback}</p>}
          <button type="button" className="ghost" disabled={!answerFinished} onClick={() => { setActiveQuestion(null); setAnswer(''); setAnswerAttempts(0); setAnswerFeedback(null) }}>Back to cards</button>
        </form>
      })()}

      <div className="tile-grid" role="group" aria-label="Picture matching cards">
        {state.board.map((card, position) => {
          const matched = state.matchedCardIds.includes(card.id)
          const revealed = matched || state.revealed.includes(card.id)
          const question = WORD_ASSEMBLY_QUESTIONS.find((entry) => entry.id === card.questionId)!
          const face = revealed
            ? `/match-card/reference/reveal-${String(REFERENCE_ART[card.questionId] ?? 1).padStart(2, '0')}.webp`
            : `/match-card/reference/hidden-${String(position + 1).padStart(2, '0')}.webp`
          return (
            <button
              key={card.id}
              type="button"
              className={`tile${revealed ? ' tile--revealed' : ''}${matched ? ' tile--matched' : ''}`}
              aria-label={revealed ? `Picture card: ${question.prompt}` : 'Face-down picture card'}
              aria-pressed={revealed}
              style={{ backgroundImage: `url("${face}")` }}
              disabled={!!activeQuestion || matched || state.revealed.length === 2}
              onClick={() => handleTile(card.id)}
            >
              <span className="sr-only">{revealed ? question.prompt : `Card ${position + 1}`}</span>
            </button>
          )
        })}
      </div>

      <div className="game__toolbar">
        <button type="button" className="ghost" onClick={restart}>
          Shuffle and restart
        </button>
      </div>
    </div>
  )
}

function drawQuestions(bank: GameQuestionRecord[]): GameQuestionRecord[] {
  const shuffled = [...bank]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, WORD_ASSEMBLY_QUESTIONS.length)
}
