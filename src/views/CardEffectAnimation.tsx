import { cardAnimation } from '../services/cardPresentation'

export function CardEffectAnimation({ name }: { name: string }) {
  const { kind, symbol } = cardAnimation(name)
  return <span className={`card-effect-animation card-effect-animation--${kind}`} data-effect={kind} aria-hidden="true">
    {[0, 1, 2].map((index) => <i key={index}>{symbol}</i>)}
  </span>
}
