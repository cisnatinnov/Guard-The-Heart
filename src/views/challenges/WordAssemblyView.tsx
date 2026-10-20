import { useEffect, useState } from 'react'
import { closeUnmatchedWordAssemblyCards, createWordAssemblyState, revealWordAssemblyCard } from '../../services/games'
import { challengeQuestionsFor, gradeQuestion } from '../../services/games/challengeQuestions'
import { MatchingCards } from './MatchingCards'
import { QuestionPresentation } from './QuestionPresentation'
import { useSoloQuestionTimer } from './useSoloQuestionTimer'

export function WordAssemblyView({ onComplete }: { onComplete?: () => void } = {}) {
  const questions = challengeQuestionsFor('word-assembly').questions
  const [state, setState] = useState(() => createWordAssemblyState(Math.random, Math.min(10, questions.length)))
  const [questionIndex, setQuestionIndex] = useState(0)
  const [unlocked, setUnlocked] = useState(false)
  const [answer, setAnswer] = useState('')
  const [answerAttempts, setAnswerAttempts] = useState(0)
  const [finished, setFinished] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const question = questions[questionIndex]
  const remaining = useSoloQuestionTimer(String(questionIndex), unlocked && !finished, () => {
    if (finished) return
    setScore((current) => current - 10)
    setAnswerAttempts(2)
    setFinished(true)
    setFeedback('Time ran out. −10 points.')
  })

  useEffect(() => {
    if (state.revealed.length !== 2) return
    const timer = window.setTimeout(() => setState(closeUnmatchedWordAssemblyCards), 900)
    return () => window.clearTimeout(timer)
  }, [state])

  useEffect(() => {
    if (questionIndex === questions.length - 1 && finished) onComplete?.()
  }, [questionIndex, questions.length, finished, onComplete])

  function handleTile(cardId: string) {
    if (unlocked) return
    const next = revealWordAssemblyCard(state, cardId)
    setState(next)
    if (next.mismatches > state.mismatches) {
      setFeedback('The pictures do not match. Try another pair.')
    }
    if (next.matchedQuestionIds.length > state.matchedQuestionIds.length) {
      setUnlocked(true)
      setFeedback(null)
    }
  }

  function backToCards() {
    const nextIndex = questionIndex + 1
    if (nextIndex >= questions.length) return
    setQuestionIndex(nextIndex)
    if (state.matchedCardIds.length === state.board.length) {
      setState(createWordAssemblyState(Math.random, Math.min(10, questions.length - nextIndex)))
    }
    setUnlocked(false)
    setAnswer('')
    setAnswerAttempts(0)
    setFinished(false)
    setFeedback(null)
  }

  function restart() {
    setState(createWordAssemblyState(Math.random, Math.min(10, questions.length)))
    setQuestionIndex(0)
    setUnlocked(false)
    setAnswer('')
    setAnswerAttempts(0)
    setFinished(false)
    setFeedback(null)
    setScore(0)
  }

  return <div className="game">
    <div className="stat-grid">
      <div className="stat"><span className="stat__label">Question</span><span className="stat__value">{questionIndex + 1}/{questions.length}</span></div>
      <div className="stat"><span className="stat__label">Score</span><span className="stat__value">{score}</span></div>
    </div>
    <p className="muted">Match a pair first to unlock its question. Each question allows two answer attempts within 15 seconds.</p>
    {unlocked && question ? <>
      <QuestionPresentation gameId="word-assembly" question={question} seconds={remaining} counter={`Soal ${question.number} / ${questions.length}`} />
      <form className="match-question" onSubmit={(event) => {
        event.preventDefault()
        if (finished || remaining === 0 || !answer) return
        const attempts = answerAttempts + 1
        setAnswerAttempts(attempts)
        if (gradeQuestion(question, answer).correct) {
          setScore((current) => current + 10)
          setFeedback('Correct! +10 points.')
          setFinished(true)
        } else if (attempts >= 2) {
          setScore((current) => current - 10)
          setFeedback('Two attempts used. −10 points.')
          setFinished(true)
        } else {
          setFeedback('Not quite. One chance left.')
          setAnswer('')
        }
      }}>
        <fieldset className="game-options" disabled={finished}>
          <legend>Choose the best answer</legend>
          {question.options?.map((option, index) => <label className="game-options__choice" key={option}>
            <input type="radio" name="match-card-answer" value={option} checked={answer === option} onChange={() => setAnswer(option)} />
            <span><b>{String.fromCharCode(65 + index)}</b>{option}</span>
          </label>)}
        </fieldset>
        <button type="submit" disabled={!answer || finished}>Answer</button>
        <p className="muted">Attempts: {answerAttempts}/2</p>
        <button type="button" className="ghost" disabled={!finished} onClick={backToCards}>Back to cards</button>
      </form>
    </> : <MatchingCards board={state} onFlip={handleTile} />}
    {feedback && <p className="alert alert--info" role="status">{feedback}</p>}
    <div className="game__toolbar"><button type="button" className="ghost" onClick={restart}>Shuffle and restart</button></div>
  </div>
}
