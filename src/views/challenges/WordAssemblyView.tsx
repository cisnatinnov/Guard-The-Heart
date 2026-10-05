import { useEffect, useMemo, useState } from 'react'
import {
  WORD_ASSEMBLY_QUESTIONS,
  closeUnmatchedWordAssemblyCards,
  createWordAssemblyState,
  revealWordAssemblyCard,
  scoreWordAssembly,
} from '../../services/games'

const MISMATCH_REVEAL_MS = 900

export function WordAssemblyView() {
  const [state, setState] = useState(createWordAssemblyState)
  const [flash, setFlash] = useState<'mismatch' | 'matched' | null>(null)

  const score = useMemo(() => scoreWordAssembly(state), [state])

  useEffect(() => {
    if (state.revealed.length !== 2) return

    const timer = window.setTimeout(() => {
      setState(closeUnmatchedWordAssemblyCards)
      setFlash(null)
    }, MISMATCH_REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [state])

  function handleTile(cardId: string) {
    const next = revealWordAssemblyCard(state, cardId)
    if (next === state) return
    setState(next)
    if (next.mismatches > state.mismatches) setFlash('mismatch')
    else if (next.matchedQuestionIds.length > state.matchedQuestionIds.length) setFlash('matched')
  }

  function restart() {
    setState(createWordAssemblyState())
    setFlash(null)
  }

  return (
    <div className="game">
      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">Pairs matched</span>
          <span className="stat__value">
            {score.matchedPairs}/{WORD_ASSEMBLY_QUESTIONS.length}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Misplays</span>
          <span className="stat__value">{score.mismatches}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Score</span>
          <span className="stat__value">
            {score.score}/{score.maximum}
          </span>
        </div>
      </div>

      <p className="muted">Find both cards with the same picture for each question:</p>
      <ul className="word-match-prompts">
        {WORD_ASSEMBLY_QUESTIONS.map((question) => (
          <li key={question.id}>{question.prompt}</li>
        ))}
      </ul>

      {flash && (
        <p className={flash === 'mismatch' ? 'alert alert--error' : 'alert alert--ok'}>
          {flash === 'mismatch'
            ? 'The pictures do not match. All open cards will turn back over.'
            : 'Match found.'}
        </p>
      )}

      <div className="tile-grid" role="group" aria-label="Picture matching cards">
        {state.board.map((card) => {
          const matched = state.matchedCardIds.includes(card.id)
          const revealed = matched || state.revealed.includes(card.id)
          const question = WORD_ASSEMBLY_QUESTIONS.find((entry) => entry.id === card.questionId)!
          return (
            <button
              key={card.id}
              type="button"
              className={`tile${revealed ? ' tile--revealed' : ''}${matched ? ' tile--matched' : ''}`}
              aria-label={revealed ? `Picture card: ${question.prompt}` : 'Face-down picture card'}
              aria-pressed={revealed}
              disabled={matched || state.revealed.length === 2}
              onClick={() => handleTile(card.id)}
            >
              {revealed ? (
                <img src={card.image} alt={question.prompt} draggable={false} />
              ) : (
                '?'
              )}
            </button>
          )
        })}
      </div>

      <div className="game__toolbar">
        <button type="button" className="ghost" onClick={restart}>
          Shuffle and restart
        </button>
      </div>
    </div>
  )
}
