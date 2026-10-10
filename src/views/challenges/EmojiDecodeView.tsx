import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EMOJI_DECODE_POINTS_PER_ANSWER,
  EMOJI_DECODE_SECONDS_PER_QUESTION,
  checkEmojiAnswer,
  getEmojiDecodeQuestions,
  scoreEmojiDecode,
  type EmojiDecodeAttempt,
} from '../../services/games'

export function EmojiDecodeView() {
  const questions = useMemo(() => getEmojiDecodeQuestions(), [])
  const [attempts, setAttempts] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [timedOutQuestions, setTimedOutQuestions] = useState<Record<string, boolean>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [remaining, setRemaining] = useState(EMOJI_DECODE_SECONDS_PER_QUESTION)
  const remainingRef = useRef(EMOJI_DECODE_SECONDS_PER_QUESTION)
  const timerQuestionId = useRef<string | null>(questions[0]?.id ?? null)
  const checkedQuestionIds = useRef(new Set<string>())

  const history: EmojiDecodeAttempt[] = questions.map((question) => ({
        questionId: question.id,
        guess: attempts[question.id] ?? '',
        correct: checked[question.id] ?? false,
      }))
  const result = scoreEmojiDecode(history)
  const current = questions[currentIndex]
  const answered = current ? checked[current.id] !== undefined : false
  const timedOut = current ? timedOutQuestions[current.id] === true : false

  useEffect(() => {
    const questionId = current?.id
    if (answered || !questionId) return
    const timer = window.setInterval(() => {
      if (timerQuestionId.current !== questionId) return
      if (remainingRef.current <= 1) {
        if (checkedQuestionIds.current.has(questionId)) return
        checkedQuestionIds.current.add(questionId)
        remainingRef.current = 0
        setRemaining(0)
        setChecked((previous) => ({ ...previous, [questionId]: false }))
        setTimedOutQuestions((previous) => ({ ...previous, [questionId]: true }))
        return
      }
      remainingRef.current -= 1
      setRemaining(remainingRef.current)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [answered, current?.id])

  function submit(index: number) {
    const question = questions[index]
    if (!question || checkedQuestionIds.current.has(question.id)) return
    checkedQuestionIds.current.add(question.id)
    setAttempts((previous) => ({ ...previous, [question.id]: attempts[question.id] ?? '' }))
    setChecked((previous) => ({
      ...previous,
      [question.id]: checkEmojiAnswer(question, attempts[question.id] ?? ''),
    }))
  }

  function goToQuestion(index: number) {
    const nextIndex = Math.max(0, Math.min(questions.length - 1, index))
    if (nextIndex === currentIndex) return
    timerQuestionId.current = questions[nextIndex]?.id ?? null
    remainingRef.current = EMOJI_DECODE_SECONDS_PER_QUESTION
    setRemaining(EMOJI_DECODE_SECONDS_PER_QUESTION)
    setCurrentIndex(nextIndex)
  }

  function reset() {
    setAttempts({})
    setChecked({})
    setTimedOutQuestions({})
    checkedQuestionIds.current.clear()
    timerQuestionId.current = questions[0]?.id ?? null
    remainingRef.current = EMOJI_DECODE_SECONDS_PER_QUESTION
    setCurrentIndex(0)
    setRemaining(EMOJI_DECODE_SECONDS_PER_QUESTION)
  }

  return (
    <div className="game">
      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">Solved</span>
          <span className="stat__value">
            {result.solved}/{questions.length}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Score</span>
          <span className="stat__value">
            {result.score}/{result.maximum}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Timer per slide</span>
          <span className="stat__value">{EMOJI_DECODE_SECONDS_PER_QUESTION}s</span>
        </div>
        <div className="stat">
          <span className="stat__label">Per answer</span>
          <span className="stat__value">{EMOJI_DECODE_POINTS_PER_ANSWER} pts</span>
        </div>
      </div>

      <div className="emoji-decode emoji-decode--reference">
        <div className="emoji-decode__stage">
          <p className="muted">
          Question {currentIndex + 1} of {questions.length}
          </p>
          <p
            className="emoji-decode__glyph emoji-decode__question-art"
            aria-label={`Image clue ${currentIndex + 1}`}
          >
            <img
              src={`/image-decode/questions/decode-${String(currentIndex + 1).padStart(2, '0')}.webp`}
              alt={`Visual clue for question ${currentIndex + 1}`}
              draggable={false}
            />
          </p>
          <p className="emoji-decode__hint">{answered ? current.hint : `Hint: ${current.hint}`}</p>

          <div className="emoji-timer" role="timer" aria-label={`Time left for question ${currentIndex + 1}`}>
            <span className="emoji-timer__track">
              <span
                className={`emoji-timer__fill${
                  remaining <= 5 && !answered ? ' emoji-timer__fill--urgent' : ''
                }`}
                style={{ width: `${(remaining / EMOJI_DECODE_SECONDS_PER_QUESTION) * 100}%` }}
              />
            </span>
            <span className="emoji-timer__value">{timedOut ? 'Time up' : `${remaining}s`}</span>
          </div>

          <div className="row-form">
            <input
              type="text"
              value={attempts[current?.id ?? ''] ?? ''}
              maxLength={60}
              placeholder="Type the decoded word"
              aria-label="Decoded answer"
              disabled={answered}
              onChange={(event) =>
                setAttempts((previous) => ({ ...previous, [current.id]: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit(currentIndex)
              }}
            />
            <button type="button" disabled={answered || !(attempts[current?.id ?? ''] ?? '').trim()} onClick={() => submit(currentIndex)}>
              Decode
            </button>
          </div>

          {answered && (
            <p className={checked[current.id] ? 'alert alert--ok' : 'alert alert--error'}>
              {checked[current.id]
                ? `Correct — ${current.answer}`
                : timedOut
                  ? `Time ran out. The answer was ${current.answer}.`
                  : `Not this time. The answer was ${current.answer}.`}
            </p>
          )}

          <div className="game__toolbar">
            <button
              type="button"
              className="ghost"
              disabled={currentIndex === 0}
              onClick={() => goToQuestion(currentIndex - 1)}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="ghost"
              disabled={currentIndex >= questions.length - 1}
              onClick={() => goToQuestion(currentIndex + 1)}
            >
              Next →
            </button>
            <button type="button" className="ghost" onClick={reset}>
              Reset
            </button>
          </div>
        </div>

        <ol className="emoji-decode__index">
        {questions.map((question, index) => {
            const state = checked[question.id] === undefined ? 'open' : checked[question.id] ? 'hit' : 'miss'
            return (
              <li key={question.id}>
                <button
                  type="button"
                  className={`emoji-chip emoji-chip--${state}${index === currentIndex ? ' emoji-chip--active' : ''}`}
                  onClick={() => goToQuestion(index)}
                >
                  <span aria-hidden="true" className="emoji-chip__glyphs">
                    {question.emojis.join('')}
                  </span>
                  <span className="emoji-chip__index">{index + 1}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
