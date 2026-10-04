import type { CardEffect, CardType } from '../../models'

export type GardimonPhase = 'Crime Scene' | 'Evidence' | 'Protocol'

export const GARDIMON_SECONDS_PER_QUESTION = 8 * 60
export const GARDIMON_PHASES: GardimonPhase[] = ['Crime Scene', 'Evidence', 'Protocol']

const PHASE_KEYS: Record<GardimonPhase, 'crimeScene' | 'evidence' | 'protocol'> = {
  'Crime Scene': 'crimeScene',
  Evidence: 'evidence',
  Protocol: 'protocol',
}

export interface GardimonCard {
  id: string
  name: string
  type: CardType
  effect: CardEffect
  icon: string
  charge: number
}

export interface GardimonOption {
  id: string
  label: string
  detail: string
}

export interface GardimonRound {
  id: string
  card: GardimonCard
  crimeScene: {
    prompt: string
    options: GardimonOption[]
    correctOptionId: string
  }
  evidence: {
    prompt: string
    options: GardimonOption[]
    correctOptionId: string
  }
  protocol: {
    prompt: string
    options: GardimonOption[]
    correctOptionId: string
  }
}

export const GARDIMON_ROUNDS: GardimonRound[] = [
  {
    id: 'gardimon-1',
    card: { id: 'gp-1', name: 'Scout Protocol', type: 'Normal', effect: 'Utility', icon: '🔀', charge: 10 },
    crimeScene: {
      prompt: 'Footprints stop at the atrium rail. Which scene is it?',
      options: [
        { id: 'a', label: 'Atrium break-in', detail: 'A rail-side intrusion with no forced door.' },
        { id: 'b', label: 'Rooftop chase', detail: 'Running marks that continue across the roof.' },
        { id: 'c', label: 'Loading bay swap', detail: 'Crates moved by forklift.' },
        { id: 'd', label: 'Garden trespass', detail: 'Wet soil prints near the hedges.' },
      ],
      correctOptionId: 'a',
    },
    evidence: {
      prompt: 'Which piece of evidence proves the entry route?',
      options: [
        { id: 'a', label: 'Unlatched inner door', detail: 'The door was opened from the inside.' },
        { id: 'b', label: 'Broken glass', detail: 'Shards lie outside the frame.' },
        { id: 'c', label: 'Spare key hook', detail: 'Hooks are empty on every floor.' },
        { id: 'd', label: 'Rain soaked coat', detail: 'A coat was left on a bench.' },
      ],
      correctOptionId: 'a',
    },
    protocol: {
      prompt: 'Pick the first protocol step.',
      options: [
        { id: 'a', label: 'Seal the inner door', detail: 'Lock the route before searching.' },
        { id: 'b', label: 'Chase the suspect', detail: 'Leave the scene unattended.' },
        { id: 'c', label: 'Announce on social media', detail: 'Post the details publicly.' },
        { id: 'd', label: 'Open every room', detail: 'Expose the whole building.' },
      ],
      correctOptionId: 'a',
    },
  },
  {
    id: 'gardimon-2',
    card: { id: 'gp-2', name: 'Signal Sweep', type: 'Rare', effect: 'Support', icon: '🤝', charge: 15 },
    crimeScene: {
      prompt: 'A server rack is warm and a badge log shows one entry. Which scene?',
      options: [
        { id: 'a', label: 'Server vault intrusion', detail: 'A single badge entered the vault.' },
        { id: 'b', label: 'Atrium break-in', detail: 'Footprints at the rail.' },
        { id: 'c', label: 'Harbour spill', detail: 'Fuel taken from a moored boat.' },
        { id: 'd', label: 'Gallery fire', detail: 'A pedestal overheated.' },
      ],
      correctOptionId: 'a',
    },
    evidence: {
      prompt: 'Which item is the real signal?',
      options: [
        { id: 'a', label: 'Badge timestamp', detail: '02:14 on the vault door.' },
        { id: 'b', label: 'Rack temperature', detail: 'Warm air, four degrees up.' },
        { id: 'c', label: 'Dust on the floor', detail: 'A swept patch by the door.' },
        { id: 'd', label: 'Coffee cup', detail: 'Left on the console.' },
      ],
      correctOptionId: 'a',
    },
    protocol: {
      prompt: 'Which protocol keeps the vault safe?',
      options: [
        { id: 'a', label: 'Rotate the badge and audit', detail: 'Revoke access, then read the log.' },
        { id: 'b', label: 'Delete the log', detail: 'Remove the evidence trail.' },
        { id: 'c', label: 'Power off immediately', detail: 'Shut everything down.' },
        { id: 'd', label: 'Let it run', detail: 'Wait for the next alarm.' },
      ],
      correctOptionId: 'a',
    },
  },
  {
    id: 'gardimon-3',
    card: { id: 'gp-3', name: 'Evidence Sweep', type: 'Normal', effect: 'Defense', icon: '🛡️', charge: 10 },
    crimeScene: {
      prompt: 'A harbour camera shows a boat swinging free. Which scene?',
      options: [
        { id: 'a', label: 'Harbour lock', detail: 'A moored vessel was left alone.' },
        { id: 'b', label: 'Observatory deck', detail: 'A dome door left open.' },
        { id: 'c', label: 'Ember gallery', detail: 'Heat damage around a pedestal.' },
        { id: 'd', label: 'Server vault', detail: 'A badge opened the door.' },
      ],
      correctOptionId: 'a',
    },
    evidence: {
      prompt: 'Which record settles the unattended vessel?',
      options: [
        { id: 'a', label: 'Mooring still frame', detail: 'The Tideless free of its lines.' },
        { id: 'b', label: 'Berth list', detail: 'Five berths, one unstaffed.' },
        { id: 'c', label: 'Fuel receipt', detail: 'Fuel drawn at 01:45.' },
        { id: 'd', label: 'Weather log', detail: 'Clear water, light wind.' },
      ],
      correctOptionId: 'a',
    },
    protocol: {
      prompt: 'What does the harbour protocol require?',
      options: [
        { id: 'a', label: 'Crew check then line check', detail: 'Confirm people, then confirm lines.' },
        { id: 'b', label: 'Tow the fleet out', detail: 'Move every boat to open water.' },
        { id: 'c', label: 'Ignore unstaffed berths', detail: 'Only staffed berths matter.' },
        { id: 'd', label: 'Wait for the tide', detail: 'Act once the water rises.' },
      ],
      correctOptionId: 'a',
    },
  },
  {
    id: 'gardimon-4',
    card: { id: 'gp-4', name: 'Containment Line', type: 'Rare', effect: 'Heal', icon: '❤️', charge: 15 },
    crimeScene: {
      prompt: 'Smoke is drifting from an exhibit case. Which scene?',
      options: [
        { id: 'a', label: 'Ember gallery', detail: 'A pedestal overheated.' },
        { id: 'b', label: 'Atrium break-in', detail: 'A rail-side intrusion.' },
        { id: 'c', label: 'Harbour lock', detail: 'A boat lost its mooring.' },
        { id: 'd', label: 'Observatory deck', detail: 'A cradle turned off centre.' },
      ],
      correctOptionId: 'a',
    },
    evidence: {
      prompt: 'Which detail proves an internal cause?',
      options: [
        { id: 'a', label: 'Soot ring on the pedestal', detail: 'Heat damage from the inside.' },
        { id: 'b', label: 'Open roof hatch', detail: 'The hatch was found open.' },
        { id: 'c', label: 'Wet footprints', detail: 'Water tracked across the floor.' },
        { id: 'd', label: 'Alarm call time', detail: 'The panel triggered at 02:14.' },
      ],
      correctOptionId: 'a',
    },
    protocol: {
      prompt: 'Which containment step comes first?',
      options: [
        { id: 'a', label: 'Cut power and cordon', detail: 'Stop the source, then close the room.' },
        { id: 'b', label: 'Open the case', detail: 'Expose the exhibit for viewing.' },
        { id: 'c', label: 'Move the exhibit outside', detail: 'Carry it into the rain.' },
        { id: 'd', label: 'Ventilate and wait', detail: 'Let the smoke clear on its own.' },
      ],
      correctOptionId: 'a',
    },
  },
  {
    id: 'gardimon-5',
    card: { id: 'gp-5', name: 'Core Recovery', type: 'Epic', effect: 'Attack', icon: '🗡️', charge: 25 },
    crimeScene: {
      prompt: 'A cradle is forty degrees off its mount. Which scene?',
      options: [
        { id: 'a', label: 'Observatory deck', detail: 'A telescope was moved.' },
        { id: 'b', label: 'Ember gallery', detail: 'Heat damage around a pedestal.' },
        { id: 'c', label: 'Harbour lock', detail: 'A boat lost its mooring.' },
        { id: 'd', label: 'Server vault', detail: 'A badge opened the door.' },
      ],
      correctOptionId: 'a',
    },
    evidence: {
      prompt: 'Which lens record confirms the move?',
      options: [
        { id: 'a', label: 'Unreturned lens tray', detail: 'One tray is still signed out.' },
        { id: 'b', label: 'Clear sky report', detail: 'Cloudless conditions.' },
        { id: 'c', label: 'Dome cooling', detail: 'Four degrees lost in minutes.' },
        { id: 'd', label: 'Suspect interview', detail: 'A confession about the harbour view.' },
      ],
      correctOptionId: 'a',
    },
    protocol: {
      prompt: 'What is the recovery protocol?',
      options: [
        { id: 'a', label: 'Mark, log, then return it', detail: 'Record the position before restoring.' },
        { id: 'b', label: 'Return it unmarked', detail: 'Put it back and say nothing.' },
        { id: 'c', label: 'Leave it for the next shift', detail: 'Someone else can deal with it.' },
        { id: 'd', label: 'Sell the lens', detail: 'Recover the value instead.' },
      ],
      correctOptionId: 'a',
    },
  },
]

export const GARDIMON_ROUND_COUNT = GARDIMON_ROUNDS.length
export const GARDIMON_CARD_COUNT = GARDIMON_ROUNDS.length
export const GARDIMON_POINTS_PER_PHASE = 10
export const GARDIMON_CHALLENGE_ID = '3b6e8d1a-52f4-4c07-9e3d-8a1f6b2c7d45'
export const GARDIMON_PERFECT_BONUS = 15

export function gardimonBlock(
  round: GardimonRound,
  phase: GardimonPhase
): GardimonRound['crimeScene'] {
  return round[PHASE_KEYS[phase]]
}

export function correctOptionFor(round: GardimonRound, phase: GardimonPhase): GardimonOption {
  const block = gardimonBlock(round, phase)
  return block.options.find((option) => option.id === block.correctOptionId) ?? block.options[0]
}

export function isCorrectPick(round: GardimonRound, phase: GardimonPhase, optionId: string): boolean {
  return gardimonBlock(round, phase).correctOptionId === optionId
}

export interface GardimonRoundOutcome {
  correctPhases: number
  score: number
  perfect: boolean
}

export function scoreGardimonRound(
  round: GardimonRound,
  pickedOptionIds: Partial<Record<GardimonPhase, string>>
): GardimonRoundOutcome {
  const correctPhases = GARDIMON_PHASES.filter((phase) => {
    const picked = pickedOptionIds[phase]
    return picked !== undefined && isCorrectPick(round, phase, picked)
  }).length
  const perfect = correctPhases === GARDIMON_PHASES.length
  return {
    correctPhases,
    score: correctPhases * GARDIMON_POINTS_PER_PHASE + (perfect ? GARDIMON_PERFECT_BONUS : 0),
    perfect,
  }
}

export function gardimonMaximumScore(): number {
  return GARDIMON_ROUND_COUNT * (GARDIMON_PHASES.length * GARDIMON_POINTS_PER_PHASE + GARDIMON_PERFECT_BONUS)
}