import { useState, type FormEvent } from 'react'
import { JAWS_HIT_POINTS } from '../../services/games'
import { getGameQuestions, type GameQuestionRecord } from '../../services/gameQuestionCache'

export function JawsOfRiskView() {
  const questions = getGameQuestions('jaws-of-risk')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [questionResult, setQuestionResult] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const question: GameQuestionRecord | undefined = questions[questionIndex]
  const complete = questionIndex >= questions.length

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!question || questionResult || !answer) return
    if (answer === question.answer) {
      setScore((current) => current + JAWS_HIT_POINTS)
      setQuestionResult(`Correct — ${question.answer}. +${JAWS_HIT_POINTS} points.`)
    } else {
      setScore((current) => current - JAWS_HIT_POINTS)
      setQuestionResult(`Incorrect. Answer: ${question.answer}. −${JAWS_HIT_POINTS} points.`)
    }
  }

  function nextQuestion() {
    setQuestionIndex((current) => current + 1)
    setAnswer('')
    setQuestionResult(null)
  }

  function restart() {
    setQuestionIndex(0)
    setAnswer('')
    setQuestionResult(null)
    setScore(0)
  }

  return (
    <div className="game">
      <div className="stat-grid">
        <div className="stat"><span className="stat__label">Question</span><span className="stat__value">{complete ? questions.length : questionIndex + 1}/{questions.length}</span></div>
        <div className="stat"><span className="stat__label">Score</span><span className="stat__value">{score}</span></div>
      </div>
      {question ? <form className="match-question" onSubmit={submitAnswer}>
        <p className="muted">Question {question.number}</p>
        <h3>{question.prompt}</h3>
        <fieldset className="game-options" disabled={!!questionResult}>
          <legend>Choose the best answer</legend>
          {question.options.map((option, index) => (
            <label className="game-options__choice" key={option}>
              <input type="radio" name="jaws-answer" value={option} checked={answer === option} onChange={() => setAnswer(option)} />
              <span><b>{String.fromCharCode(65 + index)}</b>{option}</span>
            </label>
          ))}
        </fieldset>
        {!questionResult ? <button type="submit" disabled={!answer}>Submit answer</button> : <>
          <p className={questionResult.startsWith('Correct') ? 'alert alert--ok' : 'alert alert--error'} role="status">{questionResult}</p>
          <button type="button" onClick={nextQuestion}>Next question →</button>
        </>}
      </form> : <p className="alert alert--ok" role="status">{complete ? `All questions complete. Final score: ${score}.` : 'Loading questions…'}</p>}
      <div className="game__toolbar">
        {complete && <button type="button" className="ghost" onClick={restart}>Play again</button>}
      </div>
    </div>
  )
}
