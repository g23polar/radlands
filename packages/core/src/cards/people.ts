/**
 * People card definitions
 *
 * People are played in columns in front of camps. They protect cards behind them
 * and can have abilities. Max 2 people per column (6 total per player).
 */

import type { PersonCard } from '../types/card.js';

/**
 * Starter people cards for initial implementation.
 * The full game has 46 people cards.
 */
export const people: PersonCard[] = [
  // === DAMAGE JUNK CARDS ===
  {
    id: 'person_gunner',
    name: 'Gunner',
    type: 'person',
    cost: 2,
    junkIcon: 'damage',
    abilities: [
      {
        cost: 1,
        effects: [
          {
            type: 'damage',
            target: 'unprotected_enemy',
            amount: 1,
          },
        ],
        description: 'Damage an unprotected enemy card.',
      },
    ],
    flavorText: 'One shot, one less problem.',
  },
  {
    id: 'person_sniper',
    name: 'Sniper',
    type: 'person',
    cost: 3,
    junkIcon: 'damage',
    abilities: [
      {
        cost: 2,
        effects: [
          {
            type: 'damage',
            target: 'any_enemy',
            amount: 1,
          },
        ],
        description: 'Damage any enemy card (ignores protection).',
      },
    ],
    flavorText: 'Distance makes safety an illusion.',
  },
  {
    id: 'person_militia',
    name: 'Militia',
    type: 'person',
    cost: 1,
    junkIcon: 'damage',
    abilities: [],
    flavorText: 'Warm bodies for the front line.',
  },

  // === DRAW JUNK CARDS ===
  {
    id: 'person_scout',
    name: 'Scout',
    type: 'person',
    cost: 1,
    junkIcon: 'draw',
    abilities: [
      {
        cost: 1,
        effects: [
          {
            type: 'draw',
            target: 'player',
            amount: 1,
          },
        ],
        description: 'Draw a card.',
      },
    ],
    flavorText: 'Knowledge is survival.',
  },
  {
    id: 'person_scavenger',
    name: 'Scavenger',
    type: 'person',
    cost: 2,
    junkIcon: 'draw',
    abilities: [
      {
        cost: 0,
        effects: [
          {
            type: 'draw',
            target: 'player',
            amount: 1,
          },
        ],
        requiresReady: true,
        makesUnready: true,
        description: 'Draw a card. This card becomes unready.',
      },
    ],
    flavorText: 'One person\'s trash is another\'s treasure.',
  },

  // === RESTORE JUNK CARDS ===
  {
    id: 'person_medic',
    name: 'Medic',
    type: 'person',
    cost: 2,
    junkIcon: 'restore',
    abilities: [
      {
        cost: 1,
        effects: [
          {
            type: 'restore',
            target: 'any_friendly',
            amount: 1,
          },
        ],
        description: 'Restore a friendly card.',
      },
    ],
    flavorText: 'Healing hands in a broken world.',
  },
  {
    id: 'person_mechanic',
    name: 'Mechanic',
    type: 'person',
    cost: 1,
    junkIcon: 'restore',
    abilities: [
      {
        cost: 2,
        effects: [
          {
            type: 'restore',
            target: 'any_friendly',
            amount: 1,
          },
          {
            type: 'ready',
            target: 'self',
          },
        ],
        description: 'Restore a friendly card. This card stays ready.',
      },
    ],
    flavorText: 'If it\'s broken, she can fix it.',
  },

  // === PUNK JUNK CARDS ===
  {
    id: 'person_recruiter',
    name: 'Recruiter',
    type: 'person',
    cost: 2,
    junkIcon: 'punk',
    abilities: [
      {
        cost: 1,
        effects: [
          {
            type: 'punk',
            target: 'column',
          },
        ],
        description: 'Put a punk into play in any column.',
      },
    ],
    flavorText: 'Always looking for fresh meat.',
  },
  {
    id: 'person_warlord',
    name: 'Warlord',
    type: 'person',
    cost: 3,
    junkIcon: 'punk',
    abilities: [
      {
        cost: 2,
        effects: [
          {
            type: 'punk',
            target: 'column',
          },
          {
            type: 'punk',
            target: 'column',
          },
        ],
        description: 'Put 2 punks into play.',
      },
    ],
    flavorText: 'An army rises at her command.',
  },

  // === WATER JUNK CARDS ===
  {
    id: 'person_water_carrier',
    name: 'Water Carrier',
    type: 'person',
    cost: 1,
    junkIcon: 'water',
    abilities: [
      {
        cost: 0,
        effects: [
          {
            type: 'water',
            target: 'player',
            amount: 1,
          },
        ],
        description: 'Gain 1 water.',
      },
    ],
    flavorText: 'Worth their weight in gold.',
  },
  {
    id: 'person_prospector',
    name: 'Prospector',
    type: 'person',
    cost: 2,
    junkIcon: 'water',
    abilities: [
      {
        cost: 1,
        effects: [
          {
            type: 'water',
            target: 'player',
            amount: 2,
          },
        ],
        description: 'Gain 2 water.',
      },
    ],
    flavorText: 'She knows where to dig.',
  },

  // === RAID JUNK CARDS ===
  {
    id: 'person_raider',
    name: 'Raider',
    type: 'person',
    cost: 2,
    junkIcon: 'raid',
    abilities: [
      {
        cost: 2,
        effects: [
          {
            type: 'raid',
            target: 'any_enemy_camp',
            amount: 1,
          },
        ],
        description: 'Raid: Damage any enemy camp.',
      },
    ],
    flavorText: 'Strike fast, strike hard.',
  },
  {
    id: 'person_saboteur',
    name: 'Saboteur',
    type: 'person',
    cost: 3,
    junkIcon: 'raid',
    abilities: [
      {
        cost: 1,
        effects: [
          {
            type: 'destroy',
            target: 'any_enemy_person',
            condition: {
              type: 'if_damaged',
            },
          },
        ],
        description: 'Destroy a damaged enemy person.',
      },
    ],
    flavorText: 'Finish what others started.',
  },
];

/** Get a person card by ID */
export function getPerson(id: string): PersonCard | undefined {
  return people.find((p) => p.id === id);
}

/** Get all person card IDs */
export function getAllPersonIds(): string[] {
  return people.map((p) => p.id);
}
