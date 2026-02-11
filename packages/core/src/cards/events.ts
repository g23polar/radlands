/**
 * Event card definitions
 *
 * Events are played into a 3-slot queue. Each turn, the event in slot 1 resolves,
 * then all events advance forward. Events bypass protection rules.
 */

import type { EventCard } from '../types/card.js';

/**
 * Starter event cards for initial implementation.
 * The full game has 20 event cards.
 */
export const events: EventCard[] = [
  // === DAMAGE JUNK EVENTS ===
  {
    id: 'event_bombardment',
    name: 'Bombardment',
    type: 'event',
    cost: 2,
    junkIcon: 'damage',
    effects: [
      {
        type: 'damage',
        target: 'any_enemy',
        amount: 1,
      },
      {
        type: 'damage',
        target: 'any_enemy',
        amount: 1,
      },
    ],
    flavorText: 'Death from above.',
  },
  {
    id: 'event_ambush',
    name: 'Ambush',
    type: 'event',
    cost: 1,
    junkIcon: 'damage',
    effects: [
      {
        type: 'destroy',
        target: 'any_enemy_person',
        condition: {
          type: 'if_unready',
        },
      },
    ],
    flavorText: 'They never saw it coming.',
  },

  // === DRAW JUNK EVENTS ===
  {
    id: 'event_cache_discovery',
    name: 'Cache Discovery',
    type: 'event',
    cost: 1,
    junkIcon: 'draw',
    effects: [
      {
        type: 'draw',
        target: 'player',
        amount: 2,
      },
    ],
    flavorText: 'A lucky find in the wasteland.',
  },
  {
    id: 'event_intelligence',
    name: 'Intelligence',
    type: 'event',
    cost: 0,
    junkIcon: 'draw',
    effects: [
      {
        type: 'draw',
        target: 'player',
        amount: 1,
      },
      {
        type: 'water',
        target: 'player',
        amount: 1,
      },
    ],
    flavorText: 'Information is power.',
  },

  // === RESTORE JUNK EVENTS ===
  {
    id: 'event_reinforcements',
    name: 'Reinforcements',
    type: 'event',
    cost: 2,
    junkIcon: 'restore',
    effects: [
      {
        type: 'restore',
        target: 'any_friendly',
        amount: 1,
      },
      {
        type: 'punk',
        target: 'column',
      },
    ],
    flavorText: 'Help arrives just in time.',
  },
  {
    id: 'event_repair_crew',
    name: 'Repair Crew',
    type: 'event',
    cost: 1,
    junkIcon: 'restore',
    effects: [
      {
        type: 'restore',
        target: 'any_friendly',
        amount: 1,
      },
      {
        type: 'restore',
        target: 'any_friendly',
        amount: 1,
      },
    ],
    flavorText: 'Good as new. Almost.',
  },

  // === PUNK JUNK EVENTS ===
  {
    id: 'event_rally',
    name: 'Rally',
    type: 'event',
    cost: 2,
    junkIcon: 'punk',
    effects: [
      {
        type: 'punk',
        target: 'column',
      },
      {
        type: 'punk',
        target: 'column',
      },
      {
        type: 'punk',
        target: 'column',
      },
    ],
    flavorText: 'The tribe answers the call.',
  },

  // === WATER JUNK EVENTS ===
  {
    id: 'event_water_raid',
    name: 'Water Raid',
    type: 'event',
    cost: 1,
    junkIcon: 'water',
    effects: [
      {
        type: 'water',
        target: 'player',
        amount: 3,
      },
    ],
    flavorText: 'Take what you need.',
  },

  // === RAID JUNK EVENTS ===
  {
    id: 'event_siege',
    name: 'Siege',
    type: 'event',
    cost: 3,
    junkIcon: 'raid',
    effects: [
      {
        type: 'raid',
        target: 'any_enemy_camp',
        amount: 1,
      },
      {
        type: 'raid',
        target: 'any_enemy_camp',
        amount: 1,
      },
    ],
    flavorText: 'Walls mean nothing to those with patience.',
  },
  {
    id: 'event_assassin',
    name: 'Assassin',
    type: 'event',
    cost: 2,
    junkIcon: 'raid',
    effects: [
      {
        type: 'destroy',
        target: 'any_enemy_person',
      },
    ],
    flavorText: 'Silent and deadly.',
  },
];

/** Get an event card by ID */
export function getEvent(id: string): EventCard | undefined {
  return events.find((e) => e.id === id);
}

/** Get all event card IDs */
export function getAllEventIds(): string[] {
  return events.map((e) => e.id);
}
