import { WORD_ASSEMBLY_QUESTIONS, type WordAssemblyState } from '../../services/games'

const REFERENCE_ART: Record<string, number> = {
  'word-1': 7, 'word-2': 13, 'word-3': 5, 'word-4': 3, 'word-5': 1,
  'word-6': 2, 'word-7': 4, 'word-8': 8, 'word-9': 9, 'word-10': 15,
}

function matchingCardFace(questionId: string, position: number, revealed: boolean): string {
  return revealed
    ? `/match-card/reference/reveal-${String(REFERENCE_ART[questionId] ?? 1).padStart(2, '0')}.webp`
    : `/match-card/reference/hidden-${String(position + 1).padStart(2, '0')}.webp`
}

export function MatchingCards({ board, disabled = false, onFlip, reference = false }: {
  board: WordAssemblyState
  disabled?: boolean
  onFlip?: (cardId: string) => void
  reference?: boolean
}) {
  return <div className={`tile-grid matching-cards${reference ? ' matching-cards--reference' : ''}`} role="group" aria-label="Picture matching cards">
    {board.board.map((card, position) => {
      const matched = board.matchedCardIds.includes(card.id)
      const revealed = matched || board.revealed.includes(card.id)
      const label = WORD_ASSEMBLY_QUESTIONS.find((question) => question.id === card.questionId)?.prompt ?? 'Picture'
      const props = {
        className: `tile${revealed ? ' tile--revealed' : ''}${matched ? ' tile--matched' : ''}`,
        'aria-label': revealed ? `Picture card: ${label}` : `Face-down picture card ${position + 1}`,
        'data-pair': card.questionId,
        style: { backgroundImage: reference && !revealed ? undefined : `url("${matchingCardFace(card.questionId, position, revealed)}")`,
          ...(reference ? { left: `${12.6 + position % 5 * 15.4}%`, top: `${22 + Math.floor(position / 5) * 17.6}%` } : {}) },
      }
      return onFlip ? <button key={card.id} type="button" {...props} aria-pressed={revealed}
        disabled={disabled || matched || board.revealed.length === 2 || revealed}
        onClick={() => onFlip(card.id)}><span className="sr-only">Card {position + 1}</span></button>
        : <div key={card.id} {...props} role="img" />
    })}
  </div>
}
