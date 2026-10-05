import { useState } from 'react'
import {
  JAWS_LOOSE_COUNT,
  JAWS_ROWS,
  JAWS_SOLO_TOOTH_COUNT,
  createJawsBoard,
  toggleJawSelection,
  type JawsBoard,
  type JawsOutcome,
} from '../../services/games'

export function JawsOfRiskView() {
  const [board, setBoard] = useState<JawsBoard>(() =>
    createJawsBoard(Math.random, JAWS_LOOSE_COUNT, JAWS_SOLO_TOOTH_COUNT)
  )
  const [outcome] = useState<JawsOutcome | null>(null)
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

  return (
    <div className="game">
      <div className="jaws jaws--solo">
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
        <div className="jaws__gauge" role="progressbar" aria-valuenow={0} aria-valuemin={0} aria-valuemax={100}>
          <span className="jaws__gauge-fill" />
        </div>
      </div>

      {outcome && (
        <p className="alert alert--info">
          {outcome.hits.length} loose tooth caught, {outcome.falseFlags.length} false alarm
          {outcome.falseFlags.length === 1 ? '' : 's'}, {outcome.accuracy}% accuracy.
        </p>
      )}
    </div>
  )
}