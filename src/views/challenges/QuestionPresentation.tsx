import type { ReactNode } from 'react'
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
  // The reference decks contain the same artwork, already shipped with the app.
  return <section className={`qa-stage qa-stage--${gameId}${children ? ' qa-stage--matching' : ''}`}
    aria-label={`${game.title} Q&A`} style={{
      backgroundImage: 'url("/ui/match-card/arena.png")',
    }}>
    <header className="qa-stage__header">
      <img className="qa-stage__logo" src="/Logo_Game-5.png" alt="Guard the Heart" />
      <div className="qa-stage__heading">
        <h1>{gameId === 'emoji-decode' && question ? question.prompt : game.title}</h1>
        <span>{counter}</span>
      </div>
      {gameId === 'emoji-decode' && question && <p className="qa-stage__hint">{question.hint}</p>}
      <div className="qa-stage__timer" role="timer" aria-label="Time remaining">
        <span aria-hidden="true">⏱</span><strong>{seconds === undefined ? '—' : `${seconds}s`}</strong>
      </div>
    </header>
    {children ? <div className="qa-stage__matching">{children}</div> : <>
      <div className="qa-stage__frame" aria-hidden="true" style={{ backgroundImage: 'url("/ui/match-card/frame.png")' }} />
      <div className={`qa-stage__question${gameId === 'emoji-decode' ? ' qa-stage__question--image' : ''}`}>
        {question ? gameId === 'emoji-decode'
          ? <img src={`/image-decode/questions/decode-${String(question.number).padStart(2, '0')}.webp`} alt={`Visual clue for question ${question.number}`} />
          : <h2>{question.prompt}</h2> : <p role="status">{status ?? 'Menunggu tantangan dimulai…'}</p>}
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
