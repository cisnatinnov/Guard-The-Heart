import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EMOJI_DECODE_POINTS_PER_ANSWER,
  EMOJI_DECODE_QUESTIONS,
  EMOJI_DECODE_SECONDS_PER_QUESTION,
  checkEmojiAnswer,
  scoreEmojiDecode,
  type EmojiDecodeAttempt,
} from '../../services/games'

export function EmojiDecodeView() {
  const [attempts, setAttempts] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [remaining, setRemaining] = useState(EMOJI_DECODE_SECONDS_PER_QUESTION)
  const timerQuestionId = useRef<string | null>(null)

  const history = useMemo<EmojiDecodeAttempt[]>(
    () =>
      EMOJI_DECODE_QUESTIONS.map((question) => ({
        questionId: question.id,
        guess: attempts[question.id] ?? '',
        correct: checked[question.id] ?? false,
      })),
    [attempts, checked]
  )
  const result = scoreEmojiDecode(history)
  const current = EMOJI_DECODE_QUESTIONS[currentIndex]
  const answered = current ? checked[current.id] !== undefined : false
  const timedOut = answered && remaining === 0

  // Mirrors the deck: every question starts a fresh 30 second countdown.
  useEffect(() => {
    setRemaining(EMOJI_DECODE_SECONDS_PER_QUESTION)
    timerQuestionId.current = current?.id ?? null
  }, [currentIndex, current?.id])

  useEffect(() => {
    if (answered || !current) return
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [answered, current])

  // Mark timeout only when timer naturally reaches 0 for the question the timer belongs to
  useEffect(() => {
    if (remaining !== 0 || !current) return
    if (timerQuestionId.current !== current.id) return // stale timer from previous question
    if (checked[current.id] !== undefined) return // already graded
    setChecked((previous) =>
      previous[current.id] === undefined ? { ...previous, [current.id]: false } : previous
    )
  }, [remaining, current, checked])

  function submit(index: number) {
    const question = EMOJI_DECODE_QUESTIONS[index]
    if (!question || checked[question.id] !== undefined) return
    setAttempts((previous) => ({ ...previous, [question.id]: attempts[question.id] ?? '' }))
    setChecked((previous) => ({
      ...previous,
      [question.id]: checkEmojiAnswer(question, attempts[question.id] ?? ''),
    }))
  }

  function reset() {
    setAttempts({})
    setChecked({})
    setCurrentIndex(0)
    setRemaining(EMOJI_DECODE_SECONDS_PER_QUESTION)
  }

  return (
    <div className="game">
      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">Solved</span>
          <span className="stat__value">
            {result.solved}/{EMOJI_DECODE_QUESTIONS.length}
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

      <div className="emoji-decode">
        <div className="emoji-decode__stage">
          <p className="muted">
            Question {currentIndex + 1} of {EMOJI_DECODE_QUESTIONS.length}
          </p>
          <p
            className="emoji-decode__glyph"
            aria-label={`Emoji puzzle ${currentIndex + 1}: ${current.emojis.join(' ')}`}
          >
            {current.emojis.map((glyph, position) => (
              <span className="emoji-decode__chip" key={`${current.id}-${position}`}>
                {glyph}
              </span>
            ))}
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
            <button type="button" disabled={answered} onClick={() => submit(currentIndex)}>
              Decode
            </button>
          </div>

          {answered && (
            <p className={checked[current.id] ? 'alert alert--ok' : 'alert alert--error'}>
              {checked[current.id]
                ? `Correct — ${current.answer}`
                : `Not this time. The answer was ${current.answer}.`}
            </p>
          )}

          <div className="game__toolbar">
            <button
              type="button"
              className="ghost"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="ghost"
              disabled={currentIndex >= EMOJI_DECODE_QUESTIONS.length - 1}
              onClick={() => setCurrentIndex((index) => Math.min(EMOJI_DECODE_QUESTIONS.length - 1, index + 1))}
            >
              Next →
            </button>
            <button type="button" className="ghost" onClick={reset}>
              Reset
            </button>
          </div>
        </div>

        <ol className="emoji-decode__index">
          {EMOJI_DECODE_QUESTIONS.map((question, index) => {
            const state = checked[question.id] === undefined ? 'open' : checked[question.id] ? 'hit' : 'miss'
            return (
              <li key={question.id}>
                <button
                  type="button"
                  className={`emoji-chip emoji-chip--${state}${index === currentIndex ? ' emoji-chip--active' : ''}`}
                  onClick={() => setCurrentIndex(index)}
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