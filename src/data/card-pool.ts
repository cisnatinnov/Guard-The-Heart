import type { CardEffect, CardType } from '../models'
import { englishText } from '../services/english'

interface CardPoolDefinition {
  name: string
  type: CardType
  effect: CardEffect
  icon: string
  effect_action: string
}

interface CardDesign {
  type: CardType
  title: string
  effect: CardEffect
  icon: string
  effect_action: string
  copies: number
  image?: string
}

export const CARD_BACK_IMAGE = '/cards/0_BACK CARD.png'

const CARD_DESIGNS: CardDesign[] = [
  {
    type: 'Normal',
    title: 'Heal Card',
    effect: 'Heal',
    icon: '💚',
    effect_action: 'Menambah +2 Guard Point (GP).',
    copies: 11,
  },
  {
    type: 'Normal',
    title: 'Shield Card',
    effect: 'Defense',
    icon: '🛡️',
    effect_action: 'Melindungi 1 Guard Point (GP) dari serangan Gigarisk.',
    copies: 11,
  },
  {
    type: 'Normal',
    title: 'Thief Card',
    effect: 'Thief',
    icon: '🕵️',
    effect_action: 'Ambil 1 Guard Point (GP) dari satu tim lawan.',
    copies: 11,
  },
  {
    type: 'Rare',
    title: 'Heal Card',
    effect: 'Heal',
    icon: '💚',
    effect_action: 'Menambah +3 Guard Point (GP).',
    copies: 4,
  },
  {
    type: 'Rare',
    title: 'Protect Card',
    effect: 'Defense',
    icon: '🛡️',
    effect_action: 'Pemilik kartu dan tim target tidak kehilangan Guard Point (GP) dari satu kali serangan Gigarisk.',
    copies: 4,
  },
  {
    type: 'Epic',
    title: 'Reverse Card',
    effect: 'Utility',
    icon: '🔄',
    effect_action: 'Ambil 1 Guard Point (GP) dari setiap tim lawan.',
    copies: 3,
  },
  {
    type: 'Rare',
    title: 'Thief Card',
    effect: 'Thief',
    icon: '🕵️',
    effect_action: 'Ambil 2 Guard Point (GP) dari satu tim lawan.',
    copies: 4,
  },
  {
    type: 'Epic',
    title: 'Swallow Card',
    effect: 'Defense',
    icon: '💥',
    effect_action: 'Menelan efek serangan GigaRisk dan mengubahnya menjadi +4 Guard Point (GP).',
    copies: 2,
  },
  {
    type: 'Epic',
    title: 'Thief Card',
    effect: 'Thief',
    icon: '🕵️',
    effect_action: 'Ambil 2 Guard Point (GP) dari 1 atau 2 tim lawan saat Card Reveal.',
    copies: 3,
  },
  {
    type: 'Legendary',
    title: 'Gardian Unity',
    effect: 'Support',
    icon: '🤝',
    effect_action:
      'Semua team terlindungi dari serangan Gigarisk dan masing-masing +1 Guard Point (GP).',
    copies: 2,
  },
  {
    type: 'Legendary',
    title: 'Second Chance Card',
    effect: 'Heal',
    icon: '✨',
    effect_action:
      '(Passive Skill) Otomatis bangkit dengan penambahan +1 Guard Point (GP) saat Guard Point (GP) mencapai 0.',
    copies: 1,
  },
  {
    type: 'Rare',
    title: 'Fortune Draw Card',
    effect: 'Utility',
    icon: '🎴',
    effect_action: 'Pilih 1 kartu: Challenge 1–2 dari 3 kartu (2 Normal, 1 Rare); Challenge 3 dari 4 kartu (2 Normal, 1 Rare, 1 Epic). Batas rank tetap berlaku.',
    copies: 4,
    image: '/cards/Rare_Fortune_Draw Card.png',
  },
]

function designImage(design: CardDesign): string {
  if (design.image) return design.image
  const typePrefix = design.type === 'Legendary' ? 'Legend' : design.type
  return `/cards/${typePrefix}_${design.title}.png`
}

function copyName(design: CardDesign, copy: number): string {
  const base = `${design.type} ${design.title}`
  return design.copies === 1 ? base : `${base} #${String(copy).padStart(2, '0')}`
}

const IMAGE_BY_NAME = new Map<string, string>()

export const CARD_POOL: CardPoolDefinition[] = CARD_DESIGNS.flatMap((design) =>
  Array.from({ length: design.copies }, (_, index) => {
    const name = copyName(design, index + 1)
    IMAGE_BY_NAME.set(name, designImage(design))
    return {
      name,
      type: design.type,
      effect: design.effect,
      icon: design.icon,
      effect_action: design.effect_action,
    }
  })
)

export function cardImageFor(name: string): string | null {
  const renamed = name.replace(/^Epic Reflect Card/, 'Epic Swallow Card')
  return IMAGE_BY_NAME.get(renamed) ?? IMAGE_BY_NAME.get(`${renamed.replace(/ #\d+$/, '')} #01`) ?? null
}

/** Display the renamed action in old snapshots without changing ledger amounts. */
export function cardEffectLabel(effect: string): string {
  return englishText(effect.replace(/Reflect/g, 'Swallow').replace(/Swallow \(2 × 2 GP\)/g, 'Swallow'))
}

/** Numbered inventory copies of the same rarity/design share one identity. */
export function cardDesignKey(card: { name: string; type: CardType }): string {
  return `${card.type}|${cardImageFor(card.name) ?? cardTitleFor(card.name, card.type)}`
}

export function cardTitleFor(name: string, type: CardType): string {
  const design = CARD_DESIGNS.find((candidate) => cardImageFor(name) === designImage(candidate))
  return design && design.type === type ? design.title : name
}
