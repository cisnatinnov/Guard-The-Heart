import { useEffect, useState } from 'react'
import { challengeGameInfo, type ChallengeGameId } from '../../services/games'
import { challengeQuestionsFor } from '../../services/games/challengeQuestions'
import { isRunComplete, teamForQuestion, type ChallengeRun } from '../../services/games/teamRun'
import { useTeams } from '../../hooks/useTeams'

export function PublicQuestionView({ gameId, run }: { gameId: ChallengeGameId; run: ChallengeRun | null }) {
  const game = challengeGameInfo(gameId)
  const { teams } = useTeams()
  const set = challengeQuestionsFor(gameId)
  const complete = run ? isRunComplete(run) : false
  const question = run && !complete ? set.questions[run.questionIndex] : undefined
  const team = run ? teamForQuestion(run) : undefined
  const teamName = teams.find((entry) => entry.id === team?.team)?.name
  const duration = set.secondsPerQuestion
  const attempt = question && team ? `${question.id}:${team.team}` : null
  const [timer, setTimer] = useState({ attempt: null as string | null, remaining: duration ?? 0 })

  useEffect(() => {
    if (!attempt || duration === undefined) return
    const deadline = Date.now() + duration * 1000
    const tick = () => setTimer({ attempt, remaining: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) })
    tick()
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [attempt, duration])

  const remaining = timer.attempt === attempt ? timer.remaining : duration ?? 0

  return <section className="qa-stage" aria-label={`${game.title} Q&A`}>
    <header className="qa-stage__header">
      <img className="qa-stage__logo" src="/Logo_Game-5.png" alt="Guard the Heart" />
      <div className="qa-stage__heading">
        <h1>{game.title}</h1>
        {question && <span>Soal {question.number} / {run?.questionCount}{teamName ? ` · ${teamName}` : ''}</span>}
      </div>
      <div className="qa-stage__timer" role="timer" aria-label="Time remaining">
        <span aria-hidden="true">⏱</span>
        <strong>{question && duration !== undefined ? `${remaining}s` : '—'}</strong>
      </div>
    </header>
    <div className="qa-stage__frame" aria-hidden="true" />
    <div className={`qa-stage__question${gameId === 'emoji-decode' ? ' qa-stage__question--image' : ''}`}>
      {question ? gameId === 'emoji-decode'
        ? <img src={`/image-decode/questions/decode-${String(question.number).padStart(2, '0')}.webp`} alt={`Visual clue for question ${question.number}`} />
        : <h2>{question.prompt}</h2>
        : <p role="status">{complete ? 'Seluruh soal telah selesai!' : 'Menunggu tantangan dimulai…'}</p>}
    </div>
    <h2 className="qa-stage__answer-label">JAWABAN</h2>
    <div className="qa-stage__answer">
      {question?.options?.length ? <ol className="qa-stage__options" aria-label="Answer choices">
        {question.options.map((option, index) => <li key={option}><b>{String.fromCharCode(65 + index)}.</b> {option}</li>)}
      </ol> : <p>{question ? (teamName ? `Menunggu jawaban ${teamName}…` : 'Menunggu jawaban…') : '—'}</p>}
    </div>
  </section>
}
