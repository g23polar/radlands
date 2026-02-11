/**
 * Camp card definitions
 *
 * In Radlands, each player has 3 camps. When all 3 are destroyed, that player loses.
 * Camps have unique abilities and some have special traits.
 */

import type { CampCard } from '../types/card.js';

/**
 * Starter camps for initial implementation.
 * The full game has 34 camps - players draft 3 from 6.
 */
export const camps: CampCard[] = [
  {
    id: 'camp_garage',
    name: 'Garage',
    type: 'camp',
    abilities: [
      {
        cost: 1,
        effects: [
          {
            type: 'restore',
            target: 'any_friendly_person',
            amount: 1,
          },
        ],
        description: 'Restore a friendly person.',
      },
    ],
    flavorText: 'Spare parts and second chances.',
  },
  {
    id: 'camp_watering_hole',
    name: 'Watering Hole',
    type: 'camp',
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
    flavorText: 'The most precious resource in the wasteland.',
  },
  {
    id: 'camp_bunker',
    name: 'Bunker',
    type: 'camp',
    traits: ['Shielded'],
    abilities: [],
    flavorText: 'Built to withstand the apocalypse.',
  },
  {
    id: 'camp_lookout_tower',
    name: 'Lookout Tower',
    type: 'camp',
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
    flavorText: 'See them coming from miles away.',
  },
  {
    id: 'camp_armory',
    name: 'Armory',
    type: 'camp',
    abilities: [
      {
        cost: 2,
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
    flavorText: 'Weapons for those who can afford them.',
  },
  {
    id: 'camp_headquarters',
    name: 'Headquarters',
    type: 'camp',
    abilities: [
      {
        cost: 1,
        effects: [
          {
            type: 'ready',
            target: 'any_friendly_person',
          },
        ],
        description: 'Ready a friendly person.',
      },
    ],
    flavorText: 'Orders from on high.',
  },
  {
    id: 'camp_refinery',
    name: 'Refinery',
    type: 'camp',
    abilities: [
      {
        cost: 0,
        effects: [
          {
            type: 'water',
            target: 'player',
            amount: 2,
          },
        ],
        requiresReady: true,
        makesUnready: true,
        description: 'Gain 2 water. This camp becomes unready.',
      },
    ],
    flavorText: 'Processing the lifeblood of survival.',
  },
  {
    id: 'camp_workshop',
    name: 'Workshop',
    type: 'camp',
    abilities: [
      {
        cost: 1,
        effects: [
          {
            type: 'punk',
            target: 'column',
          },
        ],
        description: 'Put a punk into play in this column.',
      },
    ],
    flavorText: 'Building soldiers from scraps.',
  },
  {
    id: 'camp_scrapyard',
    name: 'Scrapyard',
    type: 'camp',
    abilities: [
      {
        cost: 2,
        effects: [
          {
            type: 'draw',
            target: 'player',
            amount: 2,
          },
        ],
        description: 'Draw 2 cards.',
      },
    ],
    flavorText: 'One person\'s trash is another\'s treasure.',
  },
  {
    id: 'camp_infirmary',
    name: 'Infirmary',
    type: 'camp',
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
            target: 'same',
          },
        ],
        description: 'Restore and ready a friendly card.',
      },
    ],
    flavorText: 'Healing what the wasteland breaks.',
  },
  {
    id: 'camp_watchtower',
    name: 'Watchtower',
    type: 'camp',
    traits: ['Protected'],
    abilities: [],
    flavorText: 'Vigilance is survival.',
  },
  {
    id: 'camp_trading_post',
    name: 'Trading Post',
    type: 'camp',
    abilities: [
      {
        cost: 0,
        effects: [
          {
            type: 'discard',
            target: 'player',
            amount: 1,
          },
          {
            type: 'draw',
            target: 'player',
            amount: 2,
          },
        ],
        description: 'Discard a card, then draw 2 cards.',
      },
    ],
    flavorText: 'Everything has its price.',
  },
  {
    id: 'camp_generator',
    name: 'Generator',
    type: 'camp',
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
    flavorText: 'Power in the wasteland.',
  },
  {
    id: 'camp_barracks',
    name: 'Barracks',
    type: 'camp',
    abilities: [
      {
        cost: 2,
        effects: [
          {
            type: 'punk',
            target: 'any_column',
          },
          {
            type: 'punk',
            target: 'any_column',
          },
        ],
        description: 'Put 2 punks into play.',
      },
    ],
    flavorText: 'Soldiers ready for battle.',
  },
  {
    id: 'camp_fortress',
    name: 'Fortress',
    type: 'camp',
    traits: ['Shielded'],
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
    flavorText: 'Walls of steel and resolve.',
  },
];

/** Get a camp by ID */
export function getCamp(id: string): CampCard | undefined {
  return camps.find((c) => c.id === id);
}

/** Get all camp IDs */
export function getAllCampIds(): string[] {
  return camps.map((c) => c.id);
}
