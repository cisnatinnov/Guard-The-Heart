import type { CardEffect, CardType } from '../models'

interface CardPoolDefinition {
  name: string
  type: CardType
  effect: CardEffect
  icon: string
  effect_action: string
}

type CardDefinition = [name: string, effect: CardEffect]

const ICONS: Record<CardEffect, string> = {
  Defense: '🛡️',
  Attack: '🗡️',
  Heal: '❤️',
  Utility: '🔀',
  Support: '🤝',
  Thief: '🕵️',
}

const ACTIONS: Record<CardType, Record<CardEffect, string>> = {
  Normal: {
    Defense: 'Block one Attack effect aimed at your team.',
    Attack: 'Reduce a rival team’s next challenge score by 5 points.',
    Heal: 'Restore 5 points to one of your team’s challenge scores.',
    Utility: 'Reroll one die before accepting its result.',
    Support: 'Grant one allied team +1 Guard Power.',
    Thief: 'Steal a random low-value card from a rival team’s collection.',
  },
  Rare: {
    Defense: 'Block one Attack effect aimed at your team and an ally.',
    Attack: 'Reduce a rival team’s next challenge score by 10 points.',
    Heal: 'Restore 10 points to one of your team’s challenge scores.',
    Utility: 'Reroll a die and choose which of the two results to keep.',
    Support: 'Grant one allied team +2 Guard Power.',
    Thief: 'Steal one random card from a rival team’s collection.',
  },
  Epic: {
    Defense: 'Block the next Attack effect aimed at your team this round.',
    Attack: 'Reduce a rival team’s next challenge score by 20 points.',
    Heal: 'Restore 20 points to one of your team’s challenge scores.',
    Utility: 'Reroll any one die and choose which result to keep.',
    Support: 'Grant one allied team +3 Guard Power.',
    Thief: 'Steal the next rare card from a rival team’s pool before scoring closes.',
  },
  Legendary: {
    Defense: 'Ward the entire team from the next attack this round.',
    Attack: 'Reduce a rival team’s next challenge score by 30 points.',
    Heal: 'Restore 30 points to one of your team’s challenge scores.',
    Utility: 'Rework any one challenge result after the fact.',
    Support: 'Grant one allied team +5 Guard Power.',
    Thief: 'Take a random card from a rival team and keep it in your collection.',
  },
}

const CARD_DEFINITIONS: Array<{ type: CardType; cards: CardDefinition[] }> = [
  {
    type: 'Normal',
    cards: [
      ['Aegis Guard', 'Defense'],
      ['Ironwall Shield', 'Defense'],
      ['Safe Harbor', 'Defense'],
      ['Guardian Plate', 'Defense'],
      ['Bastion Ward', 'Defense'],
      ['Sentinel Barrier', 'Defense'],
      ['Fortress Emblem', 'Defense'],
      ['Vigilant Buckler', 'Defense'],
      ['Heartguard Armor', 'Defense'],
      ['Steadfast Rampart', 'Defense'],
      ['Ember Blade', 'Attack'],
      ['Risk Taker', 'Attack'],
      ['Dragon Fang', 'Attack'],
      ['Quick Strike', 'Attack'],
      ['Flame Breaker', 'Attack'],
      ['Shadow Lunge', 'Attack'],
      ['Storm Edge', 'Attack'],
      ['Giga Slash', 'Attack'],
      ['Daring Charge', 'Attack'],
      ['Cinder Claw', 'Attack'],
      ['Heart Mend', 'Heal'],
      ['Healing Light', 'Heal'],
      ['Vital Spark', 'Heal'],
      ['Kindness Bloom', 'Heal'],
      ['Renewal Seed', 'Heal'],
      ['Warm Embrace', 'Heal'],
      ['Lifeline Charm', 'Heal'],
      ['Fresh Start', 'Heal'],
      ['Hopeful Pulse', 'Heal'],
      ['Restore Gem', 'Heal'],
      ['Lucky Compass', 'Utility'],
      ['Time Turner', 'Utility'],
      ['Tactical Map', 'Utility'],
      ['Quick Switch', 'Utility'],
      ['Mystery Key', 'Utility'],
      ['Clever Detour', 'Utility'],
      ['Fortune Die', 'Utility'],
      ['Hidden Passage', 'Utility'],
      ['Bright Idea', 'Utility'],
      ['Adaptation Kit', 'Utility'],
      ['Trusted Ally', 'Support'],
      ['Team Spirit', 'Support'],
      ['Helping Hand', 'Support'],
      ['Shared Courage', 'Support'],
      ['Guiding Star', 'Support'],
      ['Circle of Friends', 'Support'],
      ['Guardian Bond', 'Support'],
      ['Unity Signal', 'Support'],
    ],
  },
  {
    type: 'Rare',
    cards: [
      ['Aegis of Dawn', 'Defense'],
      ['Citadel Keeper', 'Defense'],
      ['Bulwark of Hope', 'Defense'],
      ['Dragonsteel Shield', 'Defense'],
      ['Tempest Edge', 'Attack'],
      ['Inferno Strike', 'Attack'],
      ['Gigarisk Talon', 'Attack'],
      ['Phantom Breaker', 'Attack'],
      ['Heart of Renewal', 'Heal'],
      ['Phoenix Remedy', 'Heal'],
      ['Sanctuary Spring', 'Heal'],
      ['Radiant Rebirth', 'Heal'],
      ['Fate Weaver', 'Utility'],
      ['Chrono Compass', 'Utility'],
      ['Master Tactician', 'Utility'],
      ['Mirrored Path', 'Utility'],
      ['Unbroken Alliance', 'Support'],
      ['Guardian’s Promise', 'Support'],
      ['Rally of Heroes', 'Support'],
      ['Heartlink Banner', 'Support'],
      ['Core Ward', 'Defense'],
      ['Risk Reversal', 'Attack'],
      ['Lifeweaver Sigil', 'Heal'],
      ['Destiny Shifter', 'Utility'],
    ],
  },
  {
    type: 'Epic',
    cards: [
      ['Eternal Aegis', 'Defense'],
      ['Heartbreaker Nova', 'Attack'],
      ['Phoenix Core', 'Heal'],
      ['Worldsinger’s Compass', 'Utility'],
      ['Guardians United', 'Support'],
      ['Giga Risk Ascendant', 'Attack'],
    ],
  },
  {
    type: 'Legendary',
    cards: [
      ['Moonlit Misdirect', 'Thief'],
      ['Stormglass Crown', 'Support'],
    ],
  },
]

export const CARD_POOL: CardPoolDefinition[] = CARD_DEFINITIONS.flatMap(({ type, cards }) =>
  cards.map(([name, effect]) => ({
    name,
    type,
    effect,
    icon: ICONS[effect],
    effect_action: ACTIONS[type][effect],
  }))
)
