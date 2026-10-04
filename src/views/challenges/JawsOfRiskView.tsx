import { useState } from 'react'
import {
  JAWS_HIT_POINTS,
  JAWS_LABELS,
  JAWS_LOOSE_COUNT,
  JAWS_PRESS_DURATION_MS,
  JAWS_ROWS,
  JAWS_TOOTH_COUNT,
  createJawsBoard,
  evaluateJawsBoard,
  jawsFlagCount,
  setJawLabel,
  toggleJawSelection,
  type JawsBoard,
  type JawsOutcome,
} from '../../services/games'

export function JawsOfRiskView() {
  const [board, setBoard] = useState<JawsBoard>(() => createJawsBoard())
  const [outcome, setOutcome] = useState<JawsOutcome | null>(null)
  const [pressing, setPressing] = useState(false)
  const [wobbleId, setWobbleId] = useState<string | null>(null)

  const rows = Array.from({ length: JAWS_ROWS }, (_, row) =>
    board.teeth.filter((tooth) => tooth.row === row)
  )

  function handleTooth(toothId: string) {
    if (outcome) return
    setBoard((previous) => toggleJawSelection(previous, toothId))
    setWobbleId(toothId)
    window.setTimeout(() => setWobbleId((current) => (current === toothId ? null : current)), 420)
  }

  function press() {
    if (pressing) return
    setPressing(true)
    setOutcome(null)
    window.setTimeout(() => {
      setOutcome(evaluateJawsBoard(board))
      setPressing(false)
    }, JAWS_PRESS_DURATION_MS)
  }

  function reset() {
    setBoard(createJawsBoard())
    setOutcome(null)
    setPressing(false)
  }

  return (
    <div className="game">
      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">Teeth</span>
          <span className="stat__value">{JAWS_TOOTH_COUNT}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Loose teeth</span>
          <span className="stat__value">{JAWS_LOOSE_COUNT}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Labelled</span>
          <span className="stat__value">{jawsFlagCount(board)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Score</span>
          <span className="stat__value">
            {outcome ? `${outcome.score}/${outcome.maximum}` : `0/${JAWS_LOOSE_COUNT * JAWS_HIT_POINTS}`}
          </span>
        </div>
      </div>

      <p className="muted">
        Select a tooth to label it suspect, choose its label, then press. Nothing is graded until the press.
      </p>

      <div className={`jaws${pressing ? ' jaws--pressing' : ''}`}>
        {rows.map((teeth) => (
          <div key={teeth[0]?.row} className="jaws__row">
            {teeth.map((tooth) => {
              const isLoose = outcome ? board.looseIds.includes(tooth.id) : false
              const isHit = outcome ? outcome.hits.includes(tooth.id) : false
              const isMiss = outcome ? outcome.misses.includes(tooth.id) : false
              const isFalseFlag = outcome ? outcome.falseFlags.includes(tooth.id) : false
              const className = [
                'jaw',
                tooth.label === 'Suspect' ? 'jaw--suspect' : '',
                tooth.label === 'Firm' ? 'jaw--firm' : '',
                wobbleId === tooth.id ? 'jaw--wobble' : '',
                isHit ? 'jaw--hit' : '',
                isMiss ? 'jaw--miss' : '',
                isFalseFlag ? 'jaw--false' : '',
                isLoose ? 'jaw--loose' : '',
                pressing ? 'jaw--shaking' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button
                  key={tooth.id}
                  type="button"
                  className={className}
                  disabled={outcome !== null}
                  aria-pressed={tooth.label === 'Suspect'}
                  aria-label={`Tooth ${tooth.number}, ${tooth.label}`}
                  onClick={() => handleTooth(tooth.id)}
                >
                  <span className="jaw__number">{tooth.number}</span>
                </button>
              )
            })}
          </div>
        ))}
        <div className="jaws__gauge" role="progressbar" aria-valuenow={pressing ? 60 : 0} aria-valuemin={0} aria-valuemax={100}>
          <span className={pressing ? 'jaws__gauge-fill jaws__gauge-fill--active' : 'jaws__gauge-fill'} />
        </div>
      </div>

      <fieldset className="jaws__labels">
        <legend>Label</legend>
        {JAWS_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            className="ghost"
            disabled={outcome !== null}
            onClick={() =>
              setBoard((previous) => {
                const suspect = previous.teeth.find((tooth) => tooth.label === 'Suspect')
                return suspect ? setJawLabel(previous, suspect.id, label) : previous
              })
            }
          >
            {label}
          </button>
        ))}
      </fieldset>

      {outcome && (
        <p className="alert alert--info">
          {outcome.hits.length} loose tooth caught, {outcome.falseFlags.length} false alarm
          {outcome.falseFlags.length === 1 ? '' : 's'}, {outcome.accuracy}% accuracy.
        </p>
      )}

      <div className="game__toolbar">
        <button type="button" onClick={press} disabled={pressing || outcome !== null}>
          {pressing ? 'Pressing…' : 'Press'}
        </button>
        <button type="button" className="ghost" onClick={reset}>
          New mouth
        </button>
      </div>
    </div>
  )
}