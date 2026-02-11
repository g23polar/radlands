/**
 * Ready state mechanics
 *
 * Cards have a "ready" state that affects when they can act:
 * - Cards are NOT ready when first played or restored
 * - Cards become ready at the start of their owner's next turn
 * - Using an ability typically makes a card unready
 * - Some abilities don't require readiness or don't make the card unready
 */

import type { GameState, PlayerId } from '../types/game.js';
import type { CardInstanceId, Ability } from '../types/card.js';
import { getCardInstance, getPlayer, cloneState } from '../game/state.js';
import { getCard } from '../cards/index.js';

/**
 * Check if a card can use an ability (considering ready state)
 */
export function canUseAbility(
  state: GameState,
  instanceId: CardInstanceId,
  abilityIndex: number
): { canUse: boolean; reason?: string } {
  const instance = getCardInstance(state, instanceId);
  if (!instance) {
    return { canUse: false, reason: 'Card not found' };
  }

  const card = getCard(instance.cardId);
  if (!card) {
    return { canUse: false, reason: 'Card definition not found' };
  }

  // Punks have no abilities
  if (instance.isPunk) {
    return { canUse: false, reason: 'Punks have no abilities' };
  }

  const abilities = card.abilities ?? [];
  if (abilityIndex < 0 || abilityIndex >= abilities.length) {
    return { canUse: false, reason: 'Invalid ability index' };
  }

  const ability = abilities[abilityIndex]!;

  // Check ready state (default: ability requires ready)
  const requiresReady = ability.requiresReady !== false;
  if (requiresReady && !instance.isReady) {
    return { canUse: false, reason: 'Card is not ready' };
  }

  // Check if card is damaged (damaged cards cannot use abilities)
  if (instance.isDamaged) {
    return { canUse: false, reason: 'Damaged cards cannot use abilities' };
  }

  // Check water cost
  const player = getPlayer(state, instance.ownerId);
  if (!player) {
    return { canUse: false, reason: 'Player not found' };
  }

  if (player.water < ability.cost) {
    return { canUse: false, reason: 'Not enough water' };
  }

  return { canUse: true };
}

/**
 * Make a card ready
 */
export function makeReady(
  state: GameState,
  instanceId: CardInstanceId
): GameState {
  const newState = cloneState(state);
  const instance = newState.cardInstances[instanceId];
  if (instance) {
    instance.isReady = true;
  }
  return newState;
}

/**
 * Make a card unready
 */
export function makeUnready(
  state: GameState,
  instanceId: CardInstanceId
): GameState {
  const newState = cloneState(state);
  const instance = newState.cardInstances[instanceId];
  if (instance) {
    instance.isReady = false;
  }
  return newState;
}

/**
 * Ready all cards owned by a player (called at start of turn)
 */
export function readyAllPlayerCards(
  state: GameState,
  playerId: PlayerId
): GameState {
  const newState = cloneState(state);
  const player = newState.players[playerId];
  if (!player) return newState;

  // Ready all camps
  for (const column of player.columns) {
    const campInstance = newState.cardInstances[column.campInstanceId];
    if (campInstance && !campInstance.isDamaged) {
      campInstance.isReady = true;
    }

    // Ready all people
    for (const personId of column.personInstanceIds) {
      const personInstance = newState.cardInstances[personId];
      if (personInstance && !personInstance.isDamaged) {
        personInstance.isReady = true;
      }
    }
  }

  return newState;
}

/**
 * Check if using an ability should make the card unready
 */
export function shouldMakeUnready(ability: Ability): boolean {
  // Default is true - using ability makes card unready
  return ability.makesUnready !== false;
}

/**
 * Mark a card as having acted this turn
 */
export function markActed(
  state: GameState,
  instanceId: CardInstanceId,
  ability: Ability
): GameState {
  if (!shouldMakeUnready(ability)) {
    return state;
  }

  const newState = cloneState(state);
  const instance = newState.cardInstances[instanceId];
  if (instance) {
    instance.isReady = false;
    instance.turnActed = newState.currentTurn;
  }
  return newState;
}

/**
 * Check if a card was played this turn (for ready state purposes)
 */
export function wasPlayedThisTurn(
  state: GameState,
  instanceId: CardInstanceId
): boolean {
  const instance = getCardInstance(state, instanceId);
  if (!instance) return false;
  return instance.turnPlayed === state.currentTurn;
}

/**
 * Get all ready cards for a player that can use abilities
 */
export function getReadyCardsWithAbilities(
  state: GameState,
  playerId: PlayerId
): CardInstanceId[] {
  const player = getPlayer(state, playerId);
  if (!player) return [];

  const readyCards: CardInstanceId[] = [];

  for (const column of player.columns) {
    // Check camp
    const campInstance = getCardInstance(state, column.campInstanceId);
    if (campInstance?.isReady && !campInstance.isDamaged) {
      const card = getCard(campInstance.cardId);
      if (card?.abilities && card.abilities.length > 0) {
        readyCards.push(column.campInstanceId);
      }
    }

    // Check people
    for (const personId of column.personInstanceIds) {
      const personInstance = getCardInstance(state, personId);
      if (personInstance?.isReady && !personInstance.isDamaged && !personInstance.isPunk) {
        const card = getCard(personInstance.cardId);
        if (card?.abilities && card.abilities.length > 0) {
          readyCards.push(personId);
        }
      }
    }
  }

  return readyCards;
}
