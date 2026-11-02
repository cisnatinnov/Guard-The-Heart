import { englishText } from '../../services/english'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { challengeGameInfo, type ChallengeGameId } from '../../services/games'
import type { ChallengeQuestion } from '../../services/games/challengeQuestions'

/** Live text over the original artwork and A/B-left, C/D-right slide layout. */
export function QuestionPresentation({ gameId, question, counter, seconds, timerReady = false, status, children, answerInput }: {
  gameId: ChallengeGameId
  question?: ChallengeQuestion
  counter?: string
  seconds?: number
  timerReady?: boolean
  status?: string
  children?: ReactNode
  answerInput?: ReactNode
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
  if (gameId === 'emoji-decode') return <section className="decode-stage" aria-label="Image Decode Q&A">
    <header className="decode-stage__header">
      <img src="/fight-the-dragon-logo.png" alt="Fight the Dragon" />
      <div><p>{counter ?? 'Team challenge'}</p><h1>Image Decode</h1><span>{question ? englishText(question.hint) : 'Waiting for the host'}</span></div>
      <div className="decode-stage__timer" role="timer" aria-label="Turn reminder"><strong>{seconds ?? 15}s</strong><span>{timerReady ? 'Ready' : 'Turn reminder'}</span></div>
    </header>
    <div className="decode-stage__clue">{question ? <h2 className="workbook-emoji-clue">{question.prompt}</h2> : <p role="status">{status ?? 'Waiting for the challenge to start…'}</p>}</div>
    <div className="decode-stage__answer"><h2>Answer</h2>{answerInput ?? <p>{status ?? 'Waiting for an answer…'}</p>}</div>
  </section>
  return <section className={`qa-stage qa-stage--${gameId}${children ? ' qa-stage--matching' : ''}${reference ? ' qa-stage--slide-reference' : ''}`}
    aria-label={`${game.title} Q&A`} style={{ backgroundImage: reference ? 'url("/ui/Match-Card-question-background.png")' : 'url("/ui/match-card/arena.png")' }}>
    <header className="qa-stage__header">
      <img className="qa-stage__logo" src="/fight-the-dragon-logo.png" alt="Fight the Dragon" />
      <div className="qa-stage__heading"><h1>{game.title}</h1><span>{counter}</span></div>
    </header>
    {children ? <div className="qa-stage__matching">{children}</div> : <>
      <div className="qa-stage__frame" aria-hidden="true" style={{ backgroundImage: 'url("/ui/match-card/frame.png")' }} />
      <div className="qa-stage__question">{question ? <h2 ref={questionRef}>{englishText(question.prompt)}</h2> : <p role="status">{status ?? 'Waiting for the challenge to start…'}</p>}</div>
      <h2 className="qa-stage__answer-label">ANSWER</h2>
      <div className="qa-stage__answer">{question?.options?.length ? <ol className="qa-stage__options" aria-label="Answer choices">{question.options.map((option, index) => <li key={option}><b>{String.fromCharCode(65 + index)}</b><span>{option}</span></li>)}</ol> : <p>{status ?? '—'}</p>}</div>
    </>}
  </section>
}
