import { useState } from 'react'
import {
  GARDIMON_PHASES,
  GARDIMON_ROUNDS,
  correctOptionFor,
  gardimonBlock,
  gardimonMaximumScore,
  isCorrectPick,
  scoreGardimonRound,
  type GardimonPhase,
} from '../../services/games'

type Picks = Record<string, Partial<Record<GardimonPhase, string>>>

export function GardimonProtocolView() {
  const [roundIndex, setRoundIndex] = useState(0)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [picks, setPicks] = useState<Picks>({})
  const [scores, setScores] = useState<number[]>([])

  const round = GARDIMON_ROUNDS[roundIndex]
  const phase = GARDIMON_PHASES[phaseIndex]
  const roundPicks = picks[round.id] ?? {}
  const block = gardimonBlock(round, phase)
  const picked = roundPicks[phase]
  const answered = picked !== undefined
  const total = scores.reduce((sum, value) => sum + value, 0)

  function choose(optionId: string) {
    if (answered) return
    setPicks((previous) => ({
      ...previous,
      [round.id]: { ...(previous[round.id] ?? {}), [phase]: optionId },
    }))
  }

  function advance() {
    const outcome = scoreGardimonRound(round, picks[round.id] ?? {})
    const nextScores = roundIndex === scores.length ? [...scores, outcome.score] : scores
    setScores(nextScores)
    if (phaseIndex < GARDIMON_PHASES.length - 1) {
      setPhaseIndex((index) => index + 1)
      return
    }
    if (roundIndex < GARDIMON_ROUNDS.length - 1) {
      setRoundIndex((index) => index + 1)
      setPhaseIndex(0)
      return
    }
    setPhaseIndex(GARDIMON_PHASES.length - 1)
  }

  function restart() {
    setRoundIndex(0)
    setPhaseIndex(0)
    setPicks({})
    setScores([])
  }

  return (
    <div className="game">
      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">Cards played</span>
          <span className="stat__value">
            {Math.min(scores.length + (scores.length === GARDIMON_ROUNDS.length ? 0 : 1), GARDIMON_ROUNDS.length)}/
            {GARDIMON_ROUNDS.length}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Score</span>
          <span className="stat__value">
            {total}/{gardimonMaximumScore()}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Phase</span>
          <span className="stat__value">{phaseIndex + 1}/{GARDIMON_PHASES.length}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Card rarity</span>
          <span className="stat__value">{round.card.type}</span>
        </div>
      </div>

      <article className={`protocol-card protocol-card--${round.card.type.toLowerCase()}`}>
        <header className="protocol-card__header">
          <span className="protocol-card__icon" aria-hidden="true">
            {round.card.icon}
          </span>
          <div>
            <h3 className="protocol-card__name">{round.card.name}</h3>
            <p className="muted">
              {round.card.type} · {round.card.effect} · Charge {round.card.charge}
            </p>
          </div>
        </header>

        <ol className="protocol-phases">
          {GARDIMON_PHASES.map((entry, index) => (
            <li
              key={entry}
              className={`protocol-phase${index === phaseIndex ? ' protocol-phase--active' : ''}${
                roundPicks[entry] ? ' protocol-phase--done' : ''
              }`}
            >
              {entry}
            </li>
          ))}
        </ol>

        <h4 className="protocol-block__prompt">{block.prompt}</h4>

        <ul className="protocol-options">
          {block.options.map((option) => {
            const selected = roundPicks[phase] === option.id
            const correct = isCorrectPick(round, phase, option.id)
            const className = [
              'protocol-option',
              selected && correct ? 'protocol-option--correct' : '',
              selected && !correct ? 'protocol-option--wrong' : '',
              answered && correct && !selected ? 'protocol-option--missed' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <li key={option.id}>
                <button type="button" className={className} disabled={answered} onClick={() => choose(option.id)}>
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              </li>
            )
          })}
        </ul>

        {answered && (
          <p className={isCorrectPick(round, phase, picked) ? 'alert alert--ok' : 'alert alert--error'}>
            {isCorrectPick(round, phase, picked)
              ? 'Correct call.'
              : `Not quite. The right answer was ${correctOptionFor(round, phase).label}.`}
          </p>
        )}

        <div className="game__toolbar">
          <button
            type="button"
            className="ghost"
            disabled={phaseIndex === 0}
            onClick={() => setPhaseIndex((index) => Math.max(0, index - 1))}
          >
            ← {GARDIMON_PHASES[Math.max(0, phaseIndex - 1)]}
          </button>
          {answered && (
            <button type="button" onClick={advance}>
              {phaseIndex === GARDIMON_PHASES.length - 1 ? 'Score card' : 'Next phase →'}
            </button>
          )}
          <button
            type="button"
            className="ghost"
            disabled={roundIndex === 0}
            onClick={() => {
              setRoundIndex((index) => Math.max(0, index - 1))
              setPhaseIndex(0)
            }}
          >
            ← Previous card
          </button>
          <button type="button" className="ghost" onClick={restart}>
            Restart
          </button>
        </div>
      </article>

      {scores.length > 0 && (
        <ul className="protocol-log">
          {scores.map((score, index) => (
            <li key={GARDIMON_ROUNDS[index]?.id ?? index}>
              <span>{GARDIMON_ROUNDS[index]?.card.name ?? `Card ${index + 1}`}</span>
              <strong>{score} pts</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}