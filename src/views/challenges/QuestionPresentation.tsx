import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { challengeGameInfo, type ChallengeGameId } from '../../services/games'
import type { ChallengeQuestion } from '../../services/games/challengeQuestions'

/** Live text over the original artwork and A/B-left, C/D-right slide layout. */
export function QuestionPresentation({ gameId, question, counter, seconds, status, children }: {
  gameId: ChallengeGameId
  question?: ChallengeQuestion
  counter?: string
  seconds?: number
  status?: string
  children?: ReactNode
}) {
  const game = challengeGameInfo(gameId)
  const reference = !children && (gameId === 'word-assembly' || gameId === 'emoji-decode')
  const questionRef = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    const heading = questionRef.current
    const box = heading?.parentElement
    if (!reference || !heading || !box) return
    let disposed = false
    const fit = () => {
      if (disposed) return
      heading.style.fontSize = ''
      const boxStyle = getComputedStyle(box)
      const available = box.clientHeight - parseFloat(boxStyle.paddingTop) - parseFloat(boxStyle.paddingBottom)
      let size = parseFloat(getComputedStyle(heading).fontSize)
      for (let step = 0; step < 20 && heading.scrollHeight > available; step++) {
        size *= 0.95
        heading.style.fontSize = `${size}px`
      }
    }
    fit()
    void document.fonts.ready.then(fit)
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => { disposed = true; observer.disconnect() }
  }, [reference, question?.prompt])
  // The reference decks contain the same artwork, already shipped with the app.
  return <section className={`qa-stage qa-stage--${gameId}${children ? ' qa-stage--matching' : ''}${reference ? ' qa-stage--slide-reference' : ''}`}
    aria-label={`${game.title} Q&A`} style={{
      backgroundImage: reference ? `url("/ui/${gameId === 'emoji-decode' ? 'Image_Decode' : 'Match-Card'}-question-background.png")` : 'url("/ui/match-card/arena.png")',
    }}>
    <header className="qa-stage__header">
      <img className="qa-stage__logo" src="/Logo_Game-5.png" alt="Guard the Heart" />
      <div className="qa-stage__heading">
        <h1>{gameId === 'emoji-decode' && question ? question.prompt : game.title}</h1>
        <span>{counter}</span>
      </div>
      {gameId === 'emoji-decode' && question && <p className="qa-stage__hint">{question.hint}</p>}
      <div className="qa-stage__timer" role="timer" aria-label={seconds === undefined ? 'Time remaining' : `${seconds} seconds remaining`}>
        <span aria-hidden="true">⏱</span><strong>{seconds === undefined ? reference ? '' : '—' : `${seconds}s`}</strong>
      </div>
    </header>
    {children ? <div className="qa-stage__matching">{children}</div> : <>
      <div className="qa-stage__frame" aria-hidden="true" style={{ backgroundImage: 'url("/ui/match-card/frame.png")' }} />
      <div className={`qa-stage__question${gameId === 'emoji-decode' ? ' qa-stage__question--image' : ''}`}>
        {question ? gameId === 'emoji-decode'
          ? <img src={`/image-decode/questions/decode-${String(question.number).padStart(2, '0')}.webp`} alt={`Visual clue for question ${question.number}`} />
          : <h2 ref={questionRef}>{question.prompt}</h2> : <p role="status">{status ?? 'Menunggu tantangan dimulai…'}</p>}
      </div>
      <h2 className="qa-stage__answer-label">JAWABAN</h2>
      <div className="qa-stage__answer">
        {question?.options?.length ? <ol className="qa-stage__options" aria-label="Answer choices">
          {question.options.map((option, index) => <li key={option}><b>{String.fromCharCode(65 + index)}</b><span>{option}</span></li>)}
        </ol> : <p>{status ?? '—'}</p>}
      </div>
    </>}
  </section>
}
