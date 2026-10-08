import { cardImageFor, cardTitleFor } from '../data/card-pool'
import type { CardEffect, CardType } from '../models'

interface CardTileProps {
  name: string
  type: CardType
  effect: CardEffect
  effect_action: string
  icon: string
  variant?: 'reward' | 'reveal'
}

export function CardTile({ name, type, effect, effect_action, icon, variant = 'reveal' }: CardTileProps) {
  const rarity = type.toLowerCase()
  const image = cardImageFor(name)
  const title = cardTitleFor(name, type)
  const description = `${type} ${title} (${effect}): ${effect_action}`

  if (image) {
    return (
      <figure className={`card-art card-art--${variant}`} title={description}>
        <img src={encodeURI(image)} alt={description} loading="lazy" />
      </figure>
    )
  }

  if (variant === 'reward') {
    return (
      <article className={`reward-card reward-card--${rarity}`} title={description}>
        <span className="reward-card__type">{type}</span>
        <span className="reward-card__art" aria-hidden="true">
          {icon}
        </span>
        <span className="reward-card__name">{title}</span>
      </article>
    )
  }

  return (
    <article className={`reveal-card reveal-card--${rarity}`} title={description}>
      <span className="reveal-card__type">{type}</span>
      <span className="reveal-card__art" aria-hidden="true">
        {icon}
      </span>
      <h4 className="reveal-card__name">{title}</h4>
      <p className="reveal-card__action">
        <span className="reveal-card__effect">{effect}</span>
        {effect_action}
      </p>
    </article>
  )
}
