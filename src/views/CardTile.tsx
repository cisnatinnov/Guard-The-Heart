import type { CardEffect, CardType } from '../models'

interface CardTileProps {
  name: string
  type: CardType
  effect: CardEffect
  icon: string
  owner?: string
}

const RARITY_MARKS: Record<CardType, number> = {
  Normal: 1,
  Rare: 2,
  Epic: 3,
}

export function CardTile({ name, type, effect, icon, owner }: CardTileProps) {
  return (
    <article className={`card-tile card-tile--${type.toLowerCase()}`}>
      <header className="card-tile__header">
        <h3 className="card-tile__name" title={name}>
          {name}
        </h3>
        <span className="card-tile__rarity" aria-label={`${type} rarity`}>
          {Array.from({ length: RARITY_MARKS[type] }, (_, index) => (
            <span key={index} aria-hidden="true">
              ◆
            </span>
          ))}
        </span>
      </header>

      <div className="card-tile__art" aria-hidden="true">
        <span className="card-tile__icon">{icon}</span>
      </div>

      <div className="card-tile__details">
        <span className="card-tile__type">{type} card</span>
        <span className="card-tile__effect">{effect}</span>
        {owner && <span className="card-tile__owner">Collected by {owner}</span>}
      </div>
    </article>
  )
}
