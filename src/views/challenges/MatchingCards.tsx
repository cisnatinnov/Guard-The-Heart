import { WORD_ASSEMBLY_QUESTIONS, type WordAssemblyState } from '../../services/games'
import { useTheme } from '../../hooks/useTheme'

export function MatchingCards({ board, disabled = false, onFlip, revealAll = false }: {
  board: WordAssemblyState; disabled?: boolean; onFlip?: (cardId: string) => void; revealAll?: boolean
}) {
  const theme = useTheme()
  return <div className="tile-grid matching-cards matching-cards--branded" role="group" aria-label="Picture matching cards">
    {board.board.map((card, position) => {
      const matched = board.matchedCardIds.includes(card.id)
      const revealed = revealAll || matched || board.revealed.includes(card.id)
      const pair = WORD_ASSEMBLY_QUESTIONS.findIndex((question) => question.id === card.questionId)
      const label = WORD_ASSEMBLY_QUESTIONS[pair]?.prompt ?? 'Picture'
      const image = `/cards/branded/${theme}/${revealed ? `matching-${pair + 1}` : 'matching-back'}.svg`
      const slot = `${String.fromCharCode(65 + position % 5)}${Math.floor(position / 5) + 1}`
      const props = {
        className: `tile branded-match-card${revealed ? ' tile--revealed' : ''}${matched ? ' tile--matched' : ''}`,
        'aria-label': revealed ? `Picture card: ${label}` : `Face-down picture card ${position + 1}`,
        'data-pair': card.questionId,
      }
      const content = <><img src={image} alt="" draggable={false} /><span className="branded-match-card__slot" aria-hidden="true">{slot}</span>{matched && <span className="branded-match-card__matched" aria-hidden="true">✓</span>}</>
      return onFlip ? <button key={card.id} type="button" {...props} aria-pressed={revealed}
        disabled={disabled || matched || board.revealed.length === 2 || revealed} onClick={() => onFlip(card.id)}>{content}</button>
        : <div key={card.id} {...props} role="img">{content}</div>
    })}
  </div>
}
