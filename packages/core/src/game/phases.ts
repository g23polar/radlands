/**
 * Turn phase management
 *
 * Handles the four phases of a turn in Radlands:
 * 1. Events - Resolve event in queue slot 0, advance all events forward
 * 2. Replenish - Draw 1 card, set water to 3, ready all cards
 * 3. Actions - Player takes actions (handled by action dispatcher)
 * 4. End - Cleanup, check win condition, switch to next player
 */

import type { GameState, PlayerId, GameEvent } from '../types/game.js';
import {
  getPlayer,
  getCardInstance,
  cloneState,
  getOpponentId,
} from './state.js';
import { getCard } from '../cards/index.js';
import { isEventCard } from '../types/card.js';
import { applyEffects } from '../rules/effects.js';
import { drawCards } from '../rules/effects.js';
import { readyAllPlayerCards } from '../rules/ready.js';

/**
 * Result of processing a phase
 */
export interface PhaseResult {
  state: GameState;
  events: GameEvent[];
}

/**
 * Start a new turn
 * - Set phase to 'events'
 * - Increment turn counter
 */
export function startTurn(state: GameState): GameState {
  const newState = cloneState(state);

  newState.currentTurn += 1;
  newState.turnPhase = 'events';

  return newState;
}

/**
 * Process the events phase
 * - Check active player's queue slot 0 for an event
 * - If event exists, resolve its effects
 * - Advance all events: slot 1 → slot 0, slot 2 → slot 1, slot 2 becomes empty
 * - Move to replenish phase
 */
export function processEventsPhase(state: GameState): PhaseResult {
  let currentState = cloneState(state);
  const events: GameEvent[] = [];

  const activePlayer = getPlayer(currentState, currentState.activePlayerId);
  if (!activePlayer) {
    return { state: currentState, events };
  }

  // Check if there's an event in slot 0
  const eventInstanceId = activePlayer.eventQueue[0]?.eventInstanceId;

  if (eventInstanceId) {
    const eventInstance = getCardInstance(currentState, eventInstanceId);

    if (eventInstance) {
      const eventCard = getCard(eventInstance.cardId);

      if (eventCard && isEventCard(eventCard)) {
        // Resolve the event's effects
        const result = applyEffects(
          currentState,
          eventCard.effects,
          currentState.activePlayerId
        );

        currentState = result.state;
        events.push(...result.events);

        // Add event resolved notification
        events.push({
          type: 'event_resolved',
          data: {
            instanceId: eventInstanceId,
            cardId: eventInstance.cardId,
            playerId: currentState.activePlayerId,
          },
        });
      }

      // Move event to discard
      const player = currentState.players[currentState.activePlayerId];
      if (player) {
        player.discard.push(eventInstanceId);
      }
    }
  }

  // Advance all events in the queue
  const player = currentState.players[currentState.activePlayerId];
  if (player) {
    // Slot 1 → Slot 0
    player.eventQueue[0] = { eventInstanceId: player.eventQueue[1]?.eventInstanceId ?? null };
    // Slot 2 → Slot 1
    player.eventQueue[1] = { eventInstanceId: player.eventQueue[2]?.eventInstanceId ?? null };
    // Slot 2 becomes empty
    player.eventQueue[2] = { eventInstanceId: null };

    events.push({
      type: 'event_advanced',
      data: { playerId: currentState.activePlayerId },
    });
  }

  // Move to replenish phase
  currentState.turnPhase = 'replenish';

  return { state: currentState, events };
}

/**
 * Process the replenish phase
 * - Draw 1 card for active player
 * - Set water to 3 (not add 3 - it resets each turn)
 * - Ready all active player's cards
 * - Move to actions phase
 */
export function processReplenishPhase(state: GameState): PhaseResult {
  let currentState = cloneState(state);
  const events: GameEvent[] = [];

  const activePlayerId = currentState.activePlayerId;

  // Draw 1 card
  const drawResult = drawCards(currentState, activePlayerId, 1);
  currentState = drawResult.state;
  events.push(...drawResult.events);

  // Set water to 3 (reset, not add)
  const player = currentState.players[activePlayerId];
  if (player) {
    const oldWater = player.water;
    player.water = 3;

    if (oldWater !== 3) {
      events.push({
        type: 'water_changed',
        data: {
          playerId: activePlayerId,
          amount: 3 - oldWater,
          newTotal: 3,
        },
      });
    }
  }

  // Ready all player's cards
  currentState = readyAllPlayerCards(currentState, activePlayerId);

  // Move to actions phase
  currentState.turnPhase = 'actions';

  return { state: currentState, events };
}

/**
 * End the current turn
 * - Check win condition (all opponent camps destroyed)
 * - If no winner, switch active player and start their turn
 * - If winner, set game phase to 'ended'
 */
export function endTurn(state: GameState): GameState {
  let newState = cloneState(state);

  // Add turn ended event
  const events: GameEvent[] = [{
    type: 'turn_ended',
    data: { playerId: newState.activePlayerId, turn: newState.currentTurn },
  }];

  // Check win condition
  const winnerId = checkWinCondition(newState);

  if (winnerId) {
    // Game over
    newState.phase = 'ended';
    newState.winnerId = winnerId;
    newState.endReason = 'camps_destroyed';

    events.push({
      type: 'game_ended',
      data: {
        winnerId,
        reason: 'camps_destroyed',
      },
    });

    return newState;
  }

  // Switch active player
  const opponentId = getOpponentId(newState, newState.activePlayerId);
  newState.activePlayerId = opponentId;

  // Start next turn
  newState = startTurn(newState);

  events.push({
    type: 'turn_started',
    data: { playerId: opponentId, turn: newState.currentTurn },
  });

  return newState;
}

/**
 * Check if game is over and return winner ID
 * Returns null if game is still ongoing
 *
 * Win condition: All opponent camps destroyed (empty string '')
 */
export function checkWinCondition(state: GameState): PlayerId | null {
  const activePlayerId = state.activePlayerId;
  const opponentId = getOpponentId(state, activePlayerId);
  const opponent = getPlayer(state, opponentId);

  if (!opponent) {
    return null;
  }

  // Check if all opponent camps are destroyed
  const allCampsDestroyed = opponent.columns.every(
    (column) => column.campInstanceId === ''
  );

  if (allCampsDestroyed) {
    return activePlayerId; // Active player wins
  }

  // Could also check if active player lost (all their camps destroyed)
  // This would be a draw/loss condition
  const activePlayer = getPlayer(state, activePlayerId);
  if (activePlayer) {
    const activePlayerLost = activePlayer.columns.every(
      (column) => column.campInstanceId === ''
    );

    if (activePlayerLost) {
      return opponentId; // Opponent wins
    }
  }

  return null;
}
