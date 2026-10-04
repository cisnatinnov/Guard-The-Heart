import { useMemo, useState } from 'react'
import {
  WORD_ASSEMBLY_CARD_COUNT,
  WORD_ASSEMBLY_QUESTIONS,
  createWordAssemblyState,
  isWordAssemblyQuestionSolved,
  placeWordAssemblyCard,
  revealWordAssemblyCard,
  scoreWordAssembly,
} from '../../services/games'

export function WordAssemblyView() {
  const [state, setState] = useState(createWordAssemblyState)
  const [activeQuestionId, setActiveQuestionId] = useState(WORD_ASSEMBLY_QUESTIONS[0].id)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const score = useMemo(() => scoreWordAssembly(state), [state])
  const activeQuestion =
    WORD_ASSEMBLY_QUESTIONS.find((question) => question.id === activeQuestionId) ??
    WORD_ASSEMBLY_QUESTIONS[0]

  function handleTile(cardId: string) {
    const card = state.board.find((entry) => entry.id === cardId)
    if (!card) return
    setState((previous) => revealWordAssemblyCard(previous, cardId))
    setSelectedCardId((previous) => (previous === cardId ? null : cardId))
  }

  function handleSlot(slot: number) {
    if (!selectedCardId) return
    const card = state.board.find((entry) => entry.id === selectedCardId)
    if (!card) return
    const result = placeWordAssemblyCard(state, selectedCardId, activeQuestion.id, slot)
    setState(result.state)
    setSelectedCardId(null)
    setFlash(result.placement === 'mismatch' ? 'mismatch' : 'matched')
  }

  return (
    <div className="game">
      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">Cards matched</span>
          <span className="stat__value">
            {score.matched}/{WORD_ASSEMBLY_CARD_COUNT}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Words closed</span>
          <span className="stat__value">
            {score.questionsSolved}/{WORD_ASSEMBLY_QUESTIONS.length}
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

      {flash && (
        <p className={flash === 'mismatch' ? 'alert alert--error' : 'alert alert--ok'}>
          {flash === 'mismatch' ? 'That letter belongs to another question. Tile turned back down.' : 'Matched.'}
        </p>
      )}

      <ul className="word-slots">
        {WORD_ASSEMBLY_QUESTIONS.map((question) => {
          const solved = isWordAssemblyQuestionSolved(state, question)
          const letters = state.placed[question.id] ?? []
          return (
            <li
              key={question.id}
              className={`word-slot${question.id === activeQuestion.id ? ' word-slot--active' : ''}${
                solved ? ' word-slot--solved' : ''
              }`}
            >
              <button type="button" className="ghost" onClick={() => setActiveQuestionId(question.id)}>
                {question.prompt}
              </button>
              <div className="word-slot__tiles">
                {Array.from({ length: question.answer.length }, (_, slot) => (
                  <button
                    key={slot}
                    type="button"
                    className="word-tile"
                    aria-label={`${question.prompt} letter ${slot + 1}`}
                    onClick={() => handleSlot(slot)}
                  >
                    {letters[slot] ?? ''}
                  </button>
                ))}
              </div>
              <span className="muted">{solved ? 'Closed' : `${letters.length}/4 placed`}</span>
            </li>
          )
        })}
      </ul>

      <div className="tile-grid" role="group" aria-label="Letter tiles">
        {state.board.map((card) => {
          const revealed = state.revealed.includes(card.id)
          return (
            <button
              key={card.id}
              type="button"
              className={`tile${revealed ? ' tile--revealed' : ''}${
                selectedCardId === card.id ? ' tile--selected' : ''
              }`}
              aria-label={revealed ? `Tile ${card.letter}` : 'Face-down tile'}
              onClick={() => handleTile(card.id)}
            >
              {revealed ? card.letter : '?'}
            </button>
          )
        })}
      </div>

      <div className="game__toolbar">
        <button type="button" className="ghost" onClick={() => setState(createWordAssemblyState())}>
          Shuffle and restart
        </button>
      </div>
    </div>
  )
}