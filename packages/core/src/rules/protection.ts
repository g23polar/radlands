/**
 * Protection mechanics
 *
 * In Radlands, cards protect the cards behind them:
 * - People in front protect people behind them and camps
 * - Damage/destroy effects can only target unprotected cards (unless otherwise specified)
 * - Raids bypass protection (can target camps directly)
 */

import type { GameState, PlayerId } from '../types/game.js';
import type { CardInstanceId } from '../types/card.js';
import { getCardInstance, getPlayer, getOpponentId } from '../game/state.js';
import { getCard } from '../cards/index.js';

/** Location of a card on the board */
export interface CardLocation {
  playerId: PlayerId;
  type: 'camp' | 'person' | 'hand' | 'event_queue' | 'deck' | 'discard';
  columnIndex?: number; // 0-2 for camps/people
  personIndex?: number; // 0-1 for position in column (0 = front)
  queueSlot?: number; // 0-2 for event queue
}

/** Find where a card instance is located */
export function findCardLocation(
  state: GameState,
  instanceId: CardInstanceId
): CardLocation | null {
  for (const playerId of state.playerOrder) {
    const player = getPlayer(state, playerId);
    if (!player) continue;

    // Check columns (camps and people)
    for (let colIdx = 0; colIdx < 3; colIdx++) {
      const column = player.columns[colIdx]!;

      // Check if it's the camp
      if (column.campInstanceId === instanceId) {
        return { playerId, type: 'camp', columnIndex: colIdx };
      }

      // Check people in column
      for (let personIdx = 0; personIdx < column.personInstanceIds.length; personIdx++) {
        if (column.personInstanceIds[personIdx] === instanceId) {
          return {
            playerId,
            type: 'person',
            columnIndex: colIdx,
            personIndex: personIdx,
          };
        }
      }
    }

    // Check hand
    if (player.hand.includes(instanceId)) {
      return { playerId, type: 'hand' };
    }

    // Check event queue
    for (let slot = 0; slot < 3; slot++) {
      if (player.eventQueue[slot]?.eventInstanceId === instanceId) {
        return { playerId, type: 'event_queue', queueSlot: slot };
      }
    }

    // Check deck
    if (player.deck.includes(instanceId)) {
      return { playerId, type: 'deck' };
    }

    // Check discard
    if (player.discard.includes(instanceId)) {
      return { playerId, type: 'discard' };
    }
  }

  return null;
}

/**
 * Check if a card is protected
 * A card is protected if there's another card in front of it in the same column
 */
export function isProtected(
  state: GameState,
  instanceId: CardInstanceId
): boolean {
  const location = findCardLocation(state, instanceId);
  if (!location) return false;

  const player = getPlayer(state, location.playerId);
  if (!player) return false;

  // Only camps and people on the board can be protected
  if (location.type !== 'camp' && location.type !== 'person') {
    return false;
  }

  const columnIndex = location.columnIndex;
  if (columnIndex === undefined) return false;

  const column = player.columns[columnIndex];
  if (!column) return false;

  // Check for Shielded trait (provides innate protection)
  const instance = getCardInstance(state, instanceId);
  if (instance) {
    const card = getCard(instance.cardId);
    if (card?.traits?.includes('Shielded')) {
      return true;
    }
  }

  if (location.type === 'camp') {
    // Camp is protected if there are any people in the column
    return column.personInstanceIds.length > 0;
  }

  if (location.type === 'person') {
    // Person is protected if there's another person in front of them
    // personIndex 0 = front (unprotected), personIndex 1 = back (protected by front)
    return location.personIndex !== undefined && location.personIndex > 0;
  }

  return false;
}

/**
 * Get all unprotected cards for a player
 */
export function getUnprotectedCards(
  state: GameState,
  playerId: PlayerId
): CardInstanceId[] {
  const player = getPlayer(state, playerId);
  if (!player) return [];

  const unprotected: CardInstanceId[] = [];

  for (const column of player.columns) {
    // If no people, camp is unprotected
    if (column.personInstanceIds.length === 0) {
      if (column.campInstanceId) {
        unprotected.push(column.campInstanceId);
      }
    } else {
      // Front person (index 0) is always unprotected
      const frontPerson = column.personInstanceIds[0];
      if (frontPerson && !isProtected(state, frontPerson)) {
        unprotected.push(frontPerson);
      }
    }
  }

  return unprotected;
}

/**
 * Get all cards that can be targeted by damage/destroy (respecting protection)
 */
export function getValidDamageTargets(
  state: GameState,
  attackingPlayerId: PlayerId,
  ignoreProtection: boolean = false
): CardInstanceId[] {
  const opponentId = getOpponentId(state, attackingPlayerId);
  const opponent = getPlayer(state, opponentId);
  if (!opponent) return [];

  if (ignoreProtection) {
    // Return all enemy cards on the board
    const allTargets: CardInstanceId[] = [];
    for (const column of opponent.columns) {
      if (column.campInstanceId) {
        allTargets.push(column.campInstanceId);
      }
      allTargets.push(...column.personInstanceIds);
    }
    return allTargets;
  }

  return getUnprotectedCards(state, opponentId);
}

/**
 * Get all camps that can be targeted by raid (raids bypass protection)
 */
export function getValidRaidTargets(
  state: GameState,
  attackingPlayerId: PlayerId
): CardInstanceId[] {
  const opponentId = getOpponentId(state, attackingPlayerId);
  const opponent = getPlayer(state, opponentId);
  if (!opponent) return [];

  return opponent.columns
    .map((col) => col.campInstanceId)
    .filter((id): id is CardInstanceId => id !== '');
}

/**
 * Check if a card can be targeted based on target type
 */
export function canTarget(
  state: GameState,
  sourcePlayerId: PlayerId,
  targetInstanceId: CardInstanceId,
  targetType: string
): boolean {
  const location = findCardLocation(state, targetInstanceId);
  if (!location) return false;

  const instance = getCardInstance(state, targetInstanceId);
  if (!instance) return false;

  const card = getCard(instance.cardId);
  if (!card) return false;

  const isEnemy = location.playerId !== sourcePlayerId;
  const isFriendly = location.playerId === sourcePlayerId;
  const isPerson = card.type === 'person';
  const isCamp = card.type === 'camp';
  const isUnprotected = !isProtected(state, targetInstanceId);

  switch (targetType) {
    case 'any_card':
      return location.type === 'camp' || location.type === 'person';
    case 'any_person':
      return isPerson && location.type === 'person';
    case 'any_camp':
      return isCamp && location.type === 'camp';
    case 'any_enemy':
      return isEnemy && (location.type === 'camp' || location.type === 'person');
    case 'any_enemy_person':
      return isEnemy && isPerson && location.type === 'person';
    case 'any_enemy_camp':
      return isEnemy && isCamp && location.type === 'camp';
    case 'any_friendly':
      return isFriendly && (location.type === 'camp' || location.type === 'person');
    case 'any_friendly_person':
      return isFriendly && isPerson && location.type === 'person';
    case 'unprotected_enemy':
      return isEnemy && isUnprotected && (location.type === 'camp' || location.type === 'person');
    case 'unprotected_enemy_person':
      return isEnemy && isPerson && isUnprotected && location.type === 'person';
    case 'unprotected_enemy_camp':
      return isEnemy && isCamp && isUnprotected && location.type === 'camp';
    default:
      return false;
  }
}
