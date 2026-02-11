/**
 * Card exports and unified card registry
 */

import type { Card, CardId } from '../types/card.js';
import { camps, getCamp, getAllCampIds } from './camps.js';
import { people, getPerson, getAllPersonIds } from './people.js';
import { events, getEvent, getAllEventIds } from './events.js';

export { camps, getCamp, getAllCampIds } from './camps.js';
export { people, getPerson, getAllPersonIds } from './people.js';
export { events, getEvent, getAllEventIds } from './events.js';

/** All cards in the game */
export const allCards: Card[] = [...camps, ...people, ...events];

/** Get any card by ID */
export function getCard(id: CardId): Card | undefined {
  return getCamp(id) ?? getPerson(id) ?? getEvent(id);
}

/** Get card with type narrowing */
export function getCardAs<T extends Card>(
  id: CardId,
  type: T['type']
): T | undefined {
  const card = getCard(id);
  if (card?.type === type) {
    return card as T;
  }
  return undefined;
}

/** Card registry for fast lookups */
const cardRegistry = new Map<CardId, Card>();

// Initialize registry
for (const card of allCards) {
  cardRegistry.set(card.id, card);
}

/** Get card from registry (faster than searching arrays) */
export function getCardFromRegistry(id: CardId): Card | undefined {
  return cardRegistry.get(id);
}

/** Build the draw deck (all people + events) */
export function buildDrawDeck(): CardId[] {
  return [...getAllPersonIds(), ...getAllEventIds()];
}

/** Build the camp draft pool */
export function buildCampPool(): CardId[] {
  return getAllCampIds();
}

/** Deck building stats */
export const deckStats = {
  totalCamps: camps.length,
  totalPeople: people.length,
  totalEvents: events.length,
  totalDrawDeck: people.length + events.length,
} as const;
