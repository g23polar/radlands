/**
 * Effect resolution system
 *
 * Effects are declarative descriptions of what should happen.
 * This module interprets and applies effects to game state.
 */

import type { GameState, PlayerId, GameEvent } from '../types/game.js';
import type {
  CardInstanceId,
  Effect,
  EffectCondition,
} from '../types/card.js';
import {
  getCardInstance,
  cloneState,
  generateInstanceId,
} from '../game/state.js';
import { getCard } from '../cards/index.js';
import { findCardLocation } from './protection.js';

/** Result of applying an effect */
export interface EffectResult {
  state: GameState;
  events: GameEvent[];
  success: boolean;
  error?: string;
}

/**
 * Check if an effect condition is met
 */
export function checkCondition(
  state: GameState,
  condition: EffectCondition,
  targetId: CardInstanceId
): boolean {
  const instance = getCardInstance(state, targetId);
  if (!instance) return false;

  switch (condition.type) {
    case 'if_damaged':
      return instance.isDamaged;
    case 'if_ready':
      return instance.isReady;
    case 'if_unready':
      return !instance.isReady;
    case 'if_protected':
      // Would need to check protection - simplified for now
      return false;
    case 'if_unprotected':
      return true; // Simplified
    default:
      return true;
  }
}

/**
 * Apply damage to a card
 */
export function applyDamage(
  state: GameState,
  targetId: CardInstanceId,
  _amount: number = 1
): EffectResult {
  const newState = cloneState(state);
  const instance = newState.cardInstances[targetId];
  const events: GameEvent[] = [];

  if (!instance) {
    return { state, events: [], success: false, error: 'Target not found' };
  }

  // Punks are instantly destroyed when damaged
  if (instance.isPunk) {
    return destroyCard(state, targetId);
  }

  // If already damaged, destroy it
  if (instance.isDamaged) {
    return destroyCard(state, targetId);
  }

  // Apply damage
  instance.isDamaged = true;
  instance.isReady = false; // Damaged cards are not ready

  // Get card location for animation position data
  const location = findCardLocation(state, targetId);

  events.push({
    type: 'card_damaged',
    data: {
      instanceId: targetId,
      cardId: instance.cardId,
      playerId: location?.playerId,
      columnIndex: location?.columnIndex,
      position: location?.type as 'camp' | 'person' | undefined,
      personIndex: location?.type === 'person' ? location.personIndex : undefined,
    },
  });

  return { state: newState, events, success: true };
}

/**
 * Destroy a card (remove from play)
 */
export function destroyCard(
  state: GameState,
  targetId: CardInstanceId
): EffectResult {
  const newState = cloneState(state);
  const instance = newState.cardInstances[targetId];
  const events: GameEvent[] = [];

  if (!instance) {
    return { state, events: [], success: false, error: 'Target not found' };
  }

  const location = findCardLocation(state, targetId);
  if (!location) {
    return { state, events: [], success: false, error: 'Card location not found' };
  }

  const player = newState.players[location.playerId];
  if (!player) {
    return { state, events: [], success: false, error: 'Player not found' };
  }

  const card = getCard(instance.cardId);

  // Remove from board based on location
  if (location.type === 'person' && location.columnIndex !== undefined) {
    const column = player.columns[location.columnIndex];
    if (column) {
      column.personInstanceIds = column.personInstanceIds.filter(
        (id) => id !== targetId
      );
    }

    // People go to discard when destroyed
    player.discard.push(targetId);
  } else if (location.type === 'camp' && location.columnIndex !== undefined) {
    // Camps are removed from play (not to discard)
    const column = player.columns[location.columnIndex];
    if (column) {
      column.campInstanceId = ''; // Mark as destroyed
    }
    // Remove the instance entirely
    delete newState.cardInstances[targetId];
  }

  events.push({
    type: 'card_destroyed',
    data: {
      instanceId: targetId,
      cardId: instance.cardId,
      cardType: card?.type,
      playerId: location.playerId,
      columnIndex: location.columnIndex,
      position: location.type as 'camp' | 'person',
      personIndex: location.type === 'person' ? location.personIndex : undefined,
    },
  });

  return { state: newState, events, success: true };
}

/**
 * Restore a damaged card
 */
export function restoreCard(
  state: GameState,
  targetId: CardInstanceId
): EffectResult {
  const newState = cloneState(state);
  const instance = newState.cardInstances[targetId];
  const events: GameEvent[] = [];

  if (!instance) {
    return { state, events: [], success: false, error: 'Target not found' };
  }

  if (!instance.isDamaged) {
    return { state, events: [], success: false, error: 'Card is not damaged' };
  }

  instance.isDamaged = false;
  instance.isReady = false; // Restored cards are not ready

  // Get card location for animation position data
  const location = findCardLocation(state, targetId);

  events.push({
    type: 'card_restored',
    data: {
      instanceId: targetId,
      cardId: instance.cardId,
      playerId: location?.playerId,
      columnIndex: location?.columnIndex,
      position: location?.type as 'camp' | 'person' | undefined,
      personIndex: location?.type === 'person' ? location.personIndex : undefined,
    },
  });

  return { state: newState, events, success: true };
}

/**
 * Draw cards for a player
 */
export function drawCards(
  state: GameState,
  playerId: PlayerId,
  amount: number = 1
): EffectResult {
  const newState = cloneState(state);
  const player = newState.players[playerId];
  const events: GameEvent[] = [];

  if (!player) {
    return { state, events: [], success: false, error: 'Player not found' };
  }

  for (let i = 0; i < amount; i++) {
    if (player.deck.length === 0) {
      // Reshuffle discard into deck if empty
      if (player.discard.length === 0) {
        // No cards left to draw - this could trigger deck-out
        break;
      }
      player.deck = [...player.discard];
      player.discard = [];
      // TODO: Shuffle using seeded RNG
    }

    const drawnId = player.deck.pop();
    if (drawnId) {
      player.hand.push(drawnId);
      events.push({
        type: 'card_drawn',
        data: { playerId, instanceId: drawnId },
      });
    }
  }

  return { state: newState, events, success: true };
}

/**
 * Add water to a player
 */
export function addWater(
  state: GameState,
  playerId: PlayerId,
  amount: number
): EffectResult {
  const newState = cloneState(state);
  const player = newState.players[playerId];
  const events: GameEvent[] = [];

  if (!player) {
    return { state, events: [], success: false, error: 'Player not found' };
  }

  player.water += amount;

  events.push({
    type: 'water_changed',
    data: { playerId, amount, newTotal: player.water },
  });

  return { state: newState, events, success: true };
}

/**
 * Spend water from a player
 */
export function spendWater(
  state: GameState,
  playerId: PlayerId,
  amount: number
): EffectResult {
  const newState = cloneState(state);
  const player = newState.players[playerId];
  const events: GameEvent[] = [];

  if (!player) {
    return { state, events: [], success: false, error: 'Player not found' };
  }

  if (player.water < amount) {
    return { state, events: [], success: false, error: 'Not enough water' };
  }

  player.water -= amount;

  events.push({
    type: 'water_changed',
    data: { playerId, amount: -amount, newTotal: player.water },
  });

  return { state: newState, events, success: true };
}

/**
 * Create a punk in a column
 */
export function createPunk(
  state: GameState,
  playerId: PlayerId,
  columnIndex: number
): EffectResult {
  const newState = cloneState(state);
  const player = newState.players[playerId];
  const events: GameEvent[] = [];

  if (!player) {
    return { state, events: [], success: false, error: 'Player not found' };
  }

  const column = player.columns[columnIndex];
  if (!column) {
    return { state, events: [], success: false, error: 'Invalid column' };
  }

  // Max 2 people per column
  if (column.personInstanceIds.length >= 2) {
    return { state, events: [], success: false, error: 'Column is full' };
  }

  // Create a punk instance (no card ID needed - it's face-down)
  const punkInstance: CardInstanceId = generateInstanceId();
  newState.cardInstances[punkInstance] = {
    instanceId: punkInstance,
    cardId: 'punk', // Special ID for punks
    ownerId: playerId,
    isDamaged: false,
    isReady: false,
    isPunk: true,
    turnPlayed: newState.currentTurn,
  };

  // Add to front of column (index 0)
  column.personInstanceIds.unshift(punkInstance);

  events.push({
    type: 'punk_created',
    data: { playerId, columnIndex, instanceId: punkInstance },
  });

  return { state: newState, events, success: true };
}

/**
 * Apply a single effect
 */
export function applyEffect(
  state: GameState,
  effect: Effect,
  sourcePlayerId: PlayerId,
  targetId?: CardInstanceId,
  columnIndex?: number
): EffectResult {
  // Check condition if present
  if (effect.condition && targetId) {
    if (!checkCondition(state, effect.condition, targetId)) {
      return {
        state,
        events: [],
        success: false,
        error: 'Condition not met',
      };
    }
  }

  switch (effect.type) {
    case 'damage':
    case 'injure':
      if (!targetId) {
        return { state, events: [], success: false, error: 'No target for damage' };
      }
      return applyDamage(state, targetId, effect.amount ?? 1);

    case 'destroy':
      if (!targetId) {
        return { state, events: [], success: false, error: 'No target for destroy' };
      }
      return destroyCard(state, targetId);

    case 'restore':
      if (!targetId) {
        return { state, events: [], success: false, error: 'No target for restore' };
      }
      return restoreCard(state, targetId);

    case 'draw':
      return drawCards(state, sourcePlayerId, effect.amount ?? 1);

    case 'water':
      return addWater(state, sourcePlayerId, effect.amount ?? 1);

    case 'punk':
      if (columnIndex === undefined) {
        return { state, events: [], success: false, error: 'No column for punk' };
      }
      return createPunk(state, sourcePlayerId, columnIndex);

    case 'raid':
      // Raid is damage that bypasses protection
      if (!targetId) {
        return { state, events: [], success: false, error: 'No target for raid' };
      }
      return applyDamage(state, targetId, effect.amount ?? 1);

    case 'ready':
      if (targetId) {
        const newState = cloneState(state);
        const instance = newState.cardInstances[targetId];
        if (instance) {
          instance.isReady = true;
        }
        return { state: newState, events: [], success: true };
      }
      return { state, events: [], success: false, error: 'No target for ready' };

    case 'unready':
      if (targetId) {
        const newState = cloneState(state);
        const instance = newState.cardInstances[targetId];
        if (instance) {
          instance.isReady = false;
        }
        return { state: newState, events: [], success: true };
      }
      return { state, events: [], success: false, error: 'No target for unready' };

    default:
      return {
        state,
        events: [],
        success: false,
        error: `Unknown effect type: ${effect.type}`,
      };
  }
}

/**
 * Apply multiple effects in sequence
 */
export function applyEffects(
  state: GameState,
  effects: Effect[],
  sourcePlayerId: PlayerId,
  targets: CardInstanceId[] = [],
  columnIndices: number[] = []
): EffectResult {
  let currentState = state;
  const allEvents: GameEvent[] = [];
  let targetIndex = 0;
  let columnIndex = 0;

  for (const effect of effects) {
    const target = targets[targetIndex];
    const column = columnIndices[columnIndex];

    const result = applyEffect(
      currentState,
      effect,
      sourcePlayerId,
      target,
      column
    );

    if (!result.success) {
      return {
        state: currentState,
        events: allEvents,
        success: false,
        error: result.error ?? 'Effect application failed',
      };
    }

    currentState = result.state;
    allEvents.push(...result.events);

    // Advance indices based on effect type
    if (
      effect.target !== 'player' &&
      effect.target !== 'none' &&
      effect.type !== 'punk'
    ) {
      targetIndex++;
    }
    if (effect.type === 'punk') {
      columnIndex++;
    }
  }

  return { state: currentState, events: allEvents, success: true };
}
