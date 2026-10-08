import type { CardEffect, CardType } from '../models'

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
}

export const CARD_BACK_IMAGE = '/cards/0_BACK CARD.png'

const CARD_DESIGNS: CardDesign[] = [
  {
    type: 'Normal',
    title: 'Heal Card',
    effect: 'Heal',
    icon: '💚',
    effect_action: 'Menambah 1-2 Guard Point (GP).',
    copies: 16,
  },
  {
    type: 'Normal',
    title: 'Shield Card',
    effect: 'Defense',
    icon: '🛡️',
    effect_action: 'Mengurangi 1-2 damage Gigarisk.',
    copies: 16,
  },
  {
    type: 'Normal',
    title: 'Thief Card',
    effect: 'Thief',
    icon: '🕵️',
    effect_action: 'Ambil 1 Guard Point (GP) dari satu tim lawan.',
    copies: 16,
  },
  {
    type: 'Rare',
    title: 'Heal Card',
    effect: 'Heal',
    icon: '💚',
    effect_action: 'Menambah +3 Guard Point (GP).',
    copies: 6,
  },
  {
    type: 'Rare',
    title: 'Protect Card',
    effect: 'Defense',
    icon: '🛡️',
    effect_action: 'Target tim tidak kehilangan Guard Point (GP) dari satu kali serangan Gigarisk.',
    copies: 6,
  },
  {
    type: 'Rare',
    title: 'Reverse Card',
    effect: 'Utility',
    icon: '🔄',
    effect_action: 'Ambil 1 Guard Point (GP) dari setiap tim lawan.',
    copies: 6,
  },
  {
    type: 'Rare',
    title: 'Thief Card',
    effect: 'Thief',
    icon: '🕵️',
    effect_action: 'Ambil 2 Guard Point (GP) dari satu tim lawan.',
    copies: 6,
  },
  {
    type: 'Epic',
    title: 'Reflect Card',
    effect: 'Defense',
    icon: '💥',
    effect_action: 'Damage Gigarisk yang diterima dikonversi menjadi Guard Point (GP).',
    copies: 3,
  },
  {
    type: 'Epic',
    title: 'Reverse Card',
    effect: 'Utility',
    icon: '🔄',
    effect_action: 'Ambil 2 Guard Point (GP) dari setiap tim lawan.',
    copies: 3,
  },
  {
    type: 'Legendary',
    title: 'Gardian Unity',
    effect: 'Support',
    icon: '🤝',
    effect_action:
      'Semua tim terlindungi dari serangan Gigarisk dan masing-masing mendapat +1 Guard Point (GP).',
    copies: 1,
  },
  {
    type: 'Legendary',
    title: 'Second Chance Card',
    effect: 'Heal',
    icon: '✨',
    effect_action:
      '(Passive Skill) Otomatis bangkit dengan tambahan +1 Guard Point (GP) saat Guard Point (GP) mencapai 0.',
    copies: 1,
  },
]

function designImage(design: CardDesign): string {
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
  return IMAGE_BY_NAME.get(name) ?? null
}

export function cardTitleFor(name: string, type: CardType): string {
  const design = CARD_DESIGNS.find((candidate) => IMAGE_BY_NAME.get(name) === designImage(candidate))
  return design && design.type === type ? design.title : name
}
