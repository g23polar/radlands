/**
 * Game reducer - main state machine that processes actions
 *
 * All game mutations go through this reducer using the command pattern.
 * Actions are validated, applied, and recorded in history.
 */

import type {
  GameState,
  GameAction,
  ActionResult,
  PlayPersonAction,
  PlayEventAction,
  PlayPunkAction,
  UseAbilityAction,
  JunkCardAction,
  EndTurnAction,
  SelectCampAction,
  ConfirmCampsAction,
  GameEvent,
} from '../types/game.js';
import type { JunkIcon } from '../types/card.js';
import {
  cloneState,
  getPlayer,
  getCardInstance,
  createCardInstance,
  getOpponentId,
  hasPlayerLost,
  getCardForInstance,
} from './state.js';
import {
  spendWater,
  applyDamage,
  restoreCard,
  drawCards,
  addWater,
  createPunk,
  applyEffects,
} from '../rules/effects.js';
import { getCard } from '../cards/index.js';
import { processEventsPhase, processReplenishPhase } from './phases.js';

/**
 * Apply an action to the game state
 *
 * Validates the action, applies it based on type, adds to history,
 * and returns the result with any generated events.
 */
export function applyAction(
  state: GameState,
  action: GameAction
): ActionResult {
  // Validation would go here
  // const validation = validateAction(state, action);
  // if (!validation.valid) {
  //   return { success: false, error: validation.error };
  // }

  // Route to appropriate handler based on action type
  let result: ActionResult;

  switch (action.type) {
    case 'play_person':
      result = handlePlayPerson(state, action);
      break;
    case 'play_event':
      result = handlePlayEvent(state, action);
      break;
    case 'play_punk':
      result = handlePlayPunk(state, action);
      break;
    case 'use_ability':
      result = handleUseAbility(state, action);
      break;
    case 'junk_card':
      result = handleJunkCard(state, action);
      break;
    case 'end_turn':
      result = handleEndTurn(state, action);
      break;
    case 'select_camp':
      result = handleSelectCamp(state, action);
      break;
    case 'confirm_camps':
      result = handleConfirmCamps(state, action);
      break;
    default:
      return {
        success: false,
        error: `Unknown action type: ${(action as GameAction).type}`,
      };
  }

  // If successful, add action to history
  if (result.success && result.newState) {
    result.newState.history.push(action);
  }

  return result;
}

/**
 * Handle playing a person card from hand
 */
function handlePlayPerson(
  state: GameState,
  action: PlayPersonAction
): ActionResult {
  const newState = cloneState(state);
  const player = getPlayer(newState, action.playerId);
  const instance = getCardInstance(newState, action.cardInstanceId);

  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  if (!instance) {
    return { success: false, error: 'Card instance not found' };
  }

  // Verify card is in hand
  if (!player.hand.includes(action.cardInstanceId)) {
    return { success: false, error: 'Card not in hand' };
  }

  const card = getCard(instance.cardId);
  if (!card || card.type !== 'person') {
    return { success: false, error: 'Card is not a person' };
  }

  // Check water cost
  if (player.water < card.cost) {
    return { success: false, error: 'Not enough water' };
  }

  // Check column validity
  const column = player.columns[action.columnIndex];
  if (!column) {
    return { success: false, error: 'Invalid column index' };
  }

  // Max 2 people per column
  if (column.personInstanceIds.length >= 2) {
    return { success: false, error: 'Column is full' };
  }

  const events: GameEvent[] = [];

  // Spend water
  const waterResult = spendWater(newState, action.playerId, card.cost);
  if (!waterResult.success) {
    return { success: false, error: waterResult.error ?? 'Failed to spend water' };
  }
  events.push(...waterResult.events);

  // Remove from hand
  player.hand = player.hand.filter((id) => id !== action.cardInstanceId);

  // Update instance state
  const newInstance = newState.cardInstances[action.cardInstanceId];
  if (newInstance) {
    newInstance.isReady = false;
    newInstance.turnPlayed = newState.currentTurn;
    newInstance.isPunk = false;
  }

  // Add to front of column (index 0)
  column.personInstanceIds.unshift(action.cardInstanceId);

  events.push({
    type: 'card_played',
    data: {
      playerId: action.playerId,
      instanceId: action.cardInstanceId,
      cardId: instance.cardId,
      columnIndex: action.columnIndex,
    },
  });

  return {
    success: true,
    newState: waterResult.state,
    events,
  };
}

/**
 * Handle playing an event card from hand
 */
function handlePlayEvent(
  state: GameState,
  action: PlayEventAction
): ActionResult {
  const newState = cloneState(state);
  const player = getPlayer(newState, action.playerId);
  const instance = getCardInstance(newState, action.cardInstanceId);

  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  if (!instance) {
    return { success: false, error: 'Card instance not found' };
  }

  // Verify card is in hand
  if (!player.hand.includes(action.cardInstanceId)) {
    return { success: false, error: 'Card not in hand' };
  }

  const card = getCard(instance.cardId);
  if (!card || card.type !== 'event') {
    return { success: false, error: 'Card is not an event' };
  }

  // Check water cost
  if (player.water < card.cost) {
    return { success: false, error: 'Not enough water' };
  }

  // Check queue slot validity
  const queueSlot = player.eventQueue[action.queuePosition];
  if (!queueSlot) {
    return { success: false, error: 'Invalid queue position' };
  }

  // Validate slot is empty
  if (queueSlot.eventInstanceId !== null) {
    return { success: false, error: 'Queue slot is not empty' };
  }

  const events: GameEvent[] = [];

  // Spend water
  const waterResult = spendWater(newState, action.playerId, card.cost);
  if (!waterResult.success) {
    return { success: false, error: waterResult.error ?? 'Failed to spend water' };
  }
  events.push(...waterResult.events);

  // Remove from hand
  player.hand = player.hand.filter((id) => id !== action.cardInstanceId);

  // Update instance state
  const newInstance = newState.cardInstances[action.cardInstanceId];
  if (newInstance) {
    newInstance.isReady = false;
    newInstance.turnPlayed = newState.currentTurn;
  }

  // Place in queue
  queueSlot.eventInstanceId = action.cardInstanceId;

  events.push({
    type: 'card_played',
    data: {
      playerId: action.playerId,
      instanceId: action.cardInstanceId,
      cardId: instance.cardId,
      queuePosition: action.queuePosition,
    },
  });

  return {
    success: true,
    newState: waterResult.state,
    events,
  };
}

/**
 * Handle playing a card face-down as a punk
 */
function handlePlayPunk(
  state: GameState,
  action: PlayPunkAction
): ActionResult {
  const newState = cloneState(state);
  const player = getPlayer(newState, action.playerId);
  const instance = getCardInstance(newState, action.cardInstanceId);

  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  if (!instance) {
    return { success: false, error: 'Card instance not found' };
  }

  // Verify card is in hand
  if (!player.hand.includes(action.cardInstanceId)) {
    return { success: false, error: 'Card not in hand' };
  }

  // Check column validity
  const column = player.columns[action.columnIndex];
  if (!column) {
    return { success: false, error: 'Invalid column index' };
  }

  // Max 2 people per column
  if (column.personInstanceIds.length >= 2) {
    return { success: false, error: 'Column is full' };
  }

  const events: GameEvent[] = [];

  // Remove from hand and add to discard
  player.hand = player.hand.filter((id) => id !== action.cardInstanceId);
  player.discard.push(action.cardInstanceId);

  // Create new punk instance
  const punkResult = createPunk(newState, action.playerId, action.columnIndex);
  if (!punkResult.success) {
    return { success: false, error: punkResult.error ?? 'Failed to create punk' };
  }

  events.push(...punkResult.events);

  return {
    success: true,
    newState: punkResult.state,
    events,
  };
}

/**
 * Handle using an ability on a card
 */
function handleUseAbility(
  state: GameState,
  action: UseAbilityAction
): ActionResult {
  const newState = cloneState(state);
  const player = getPlayer(newState, action.playerId);
  const instance = getCardInstance(newState, action.sourceInstanceId);

  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  if (!instance) {
    return { success: false, error: 'Card instance not found' };
  }

  // Verify ownership
  if (instance.ownerId !== action.playerId) {
    return { success: false, error: 'Card does not belong to player' };
  }

  const card = getCardForInstance(newState, action.sourceInstanceId);
  if (!card) {
    return { success: false, error: 'Card definition not found' };
  }

  // Verify ability exists
  if (!card.abilities || !card.abilities[action.abilityIndex]) {
    return { success: false, error: 'Ability not found' };
  }

  const ability = card.abilities[action.abilityIndex];

  if (!ability) {
    return { success: false, error: 'Ability not found' };
  }

  // Check if card is ready (default requirement)
  if (ability.requiresReady !== false && !instance.isReady) {
    return { success: false, error: 'Card is not ready' };
  }

  // Check water cost
  if (player.water < ability.cost) {
    return { success: false, error: 'Not enough water' };
  }

  const events: GameEvent[] = [];

  // Spend water
  const waterResult = spendWater(newState, action.playerId, ability.cost);
  if (!waterResult.success) {
    return { success: false, error: waterResult.error ?? 'Failed to spend water for ability' };
  }
  events.push(...waterResult.events);

  // Apply ability effects
  const targets = action.targetInstanceId
    ? [action.targetInstanceId, ...(action.additionalTargets || [])]
    : [];

  const effectsResult = applyEffects(
    waterResult.state,
    ability.effects,
    action.playerId,
    targets
  );

  if (!effectsResult.success) {
    return { success: false, error: effectsResult.error ?? 'Failed to apply ability effects' };
  }

  events.push(...effectsResult.events);

  // Mark card as acted (default behavior)
  if (ability.makesUnready !== false) {
    const updatedInstance = effectsResult.state.cardInstances[action.sourceInstanceId];
    if (updatedInstance) {
      updatedInstance.isReady = false;
      updatedInstance.turnActed = effectsResult.state.currentTurn;
    }
  }

  events.push({
    type: 'ability_used',
    data: {
      playerId: action.playerId,
      sourceInstanceId: action.sourceInstanceId,
      abilityIndex: action.abilityIndex,
      targetInstanceId: action.targetInstanceId,
    },
  });

  return {
    success: true,
    newState: effectsResult.state,
    events,
  };
}

/**
 * Handle junking a card from hand for its icon effect
 */
function handleJunkCard(
  state: GameState,
  action: JunkCardAction
): ActionResult {
  const newState = cloneState(state);
  const player = getPlayer(newState, action.playerId);
  const instance = getCardInstance(newState, action.cardInstanceId);

  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  if (!instance) {
    return { success: false, error: 'Card instance not found' };
  }

  // Verify card is in hand
  if (!player.hand.includes(action.cardInstanceId)) {
    return { success: false, error: 'Card not in hand' };
  }

  const card = getCard(instance.cardId);
  if (!card) {
    return { success: false, error: 'Card definition not found' };
  }

  // Get junk icon (only person and event cards have junk icons)
  let junkIcon: JunkIcon | undefined;
  if (card.type === 'person' || card.type === 'event') {
    junkIcon = card.junkIcon;
  }

  if (!junkIcon) {
    return { success: false, error: 'Card has no junk icon' };
  }

  const events: GameEvent[] = [];

  // Remove from hand and add to discard
  player.hand = player.hand.filter((id) => id !== action.cardInstanceId);
  player.discard.push(action.cardInstanceId);

  events.push({
    type: 'card_junked',
    data: {
      playerId: action.playerId,
      instanceId: action.cardInstanceId,
      cardId: instance.cardId,
      junkIcon,
    },
  });

  // Apply junk icon effect
  let effectState = newState;
  let effectResult;

  switch (junkIcon) {
    case 'damage':
      if (!action.targetInstanceId) {
        return { success: false, error: 'Damage junk requires a target' };
      }
      effectResult = applyDamage(effectState, action.targetInstanceId);
      if (!effectResult.success) {
        return { success: false, error: effectResult.error ?? 'Failed to apply damage' };
      }
      effectState = effectResult.state;
      events.push(...effectResult.events);
      break;

    case 'draw':
      effectResult = drawCards(effectState, action.playerId, 1);
      if (!effectResult.success) {
        return { success: false, error: effectResult.error ?? 'Failed to draw card' };
      }
      effectState = effectResult.state;
      events.push(...effectResult.events);
      break;

    case 'restore':
      if (!action.targetInstanceId) {
        return { success: false, error: 'Restore junk requires a target' };
      }
      effectResult = restoreCard(effectState, action.targetInstanceId);
      if (!effectResult.success) {
        return { success: false, error: effectResult.error ?? 'Failed to restore card' };
      }
      effectState = effectResult.state;
      events.push(...effectResult.events);
      break;

    case 'punk':
      // Find first column with room
      let punkColumnIndex = -1;
      for (let i = 0; i < 3; i++) {
        const col = player.columns[i];
        if (col && col.personInstanceIds.length < 2) {
          punkColumnIndex = i;
          break;
        }
      }
      if (punkColumnIndex === -1) {
        return { success: false, error: 'No column available for punk' };
      }
      effectResult = createPunk(effectState, action.playerId, punkColumnIndex);
      if (!effectResult.success) {
        return { success: false, error: effectResult.error ?? 'Failed to create punk' };
      }
      effectState = effectResult.state;
      events.push(...effectResult.events);
      break;

    case 'water':
      effectResult = addWater(effectState, action.playerId, 1);
      if (!effectResult.success) {
        return { success: false, error: effectResult.error ?? 'Failed to add water' };
      }
      effectState = effectResult.state;
      events.push(...effectResult.events);
      break;

    case 'raid':
      if (!action.targetInstanceId) {
        return { success: false, error: 'Raid junk requires a target' };
      }
      // Raid bypasses protection - just apply damage directly to any enemy camp
      effectResult = applyDamage(effectState, action.targetInstanceId);
      if (!effectResult.success) {
        return { success: false, error: effectResult.error ?? 'Failed to apply damage' };
      }
      effectState = effectResult.state;
      events.push(...effectResult.events);
      break;

    default:
      return { success: false, error: `Unknown junk icon: ${junkIcon}` };
  }

  return {
    success: true,
    newState: effectState,
    events,
  };
}

/**
 * Handle ending the current turn
 */
function handleEndTurn(state: GameState, action: EndTurnAction): ActionResult {
  // When phases.ts exists, this will call endTurn from there
  // For now, implement basic turn end logic

  const newState = cloneState(state);
  const events: GameEvent[] = [];

  // Check for win condition
  const opponentId = getOpponentId(newState, action.playerId);
  if (hasPlayerLost(newState, opponentId)) {
    newState.phase = 'ended';
    newState.winnerId = action.playerId;
    newState.endReason = 'camps_destroyed';

    events.push({
      type: 'game_ended',
      data: {
        winnerId: action.playerId,
        loserId: opponentId,
        reason: 'camps_destroyed',
      },
    });

    return { success: true, newState, events };
  }

  // Switch active player
  const currentIndex = newState.playerOrder.indexOf(action.playerId);
  const nextIndex = (currentIndex + 1) % 2;
  const nextPlayerId = newState.playerOrder[nextIndex];
  if (!nextPlayerId) {
    return { success: false, error: 'Invalid player order' };
  }
  newState.activePlayerId = nextPlayerId;

  // Increment turn if we wrapped around to first player
  if (nextIndex === 0) {
    newState.currentTurn++;
  }

  events.push({
    type: 'turn_ended',
    data: {
      playerId: action.playerId,
      nextPlayerId: newState.activePlayerId,
      turn: newState.currentTurn,
    },
  });

  events.push({
    type: 'turn_started',
    data: {
      playerId: newState.activePlayerId,
      turn: newState.currentTurn,
      phase: 'events',
    },
  });

  // Auto-process events phase
  newState.turnPhase = 'events';
  const eventsResult = processEventsPhase(newState);
  events.push(...eventsResult.events);

  // Auto-process replenish phase
  const replenishResult = processReplenishPhase(eventsResult.state);
  events.push(...replenishResult.events);

  // Now in actions phase
  return {
    success: true,
    newState: replenishResult.state,
    events,
  };
}

/**
 * Handle selecting a camp during draft
 */
function handleSelectCamp(
  state: GameState,
  action: SelectCampAction
): ActionResult {
  if (state.phase !== 'draft') {
    return { success: false, error: 'Not in draft phase' };
  }

  const newState = cloneState(state);
  const player = getPlayer(newState, action.playerId);

  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  if (!player.draftPool || !player.selectedCamps) {
    return { success: false, error: 'Player draft state not initialized' };
  }

  // Check if camp is in player's draft pool
  if (!player.draftPool.includes(action.campId)) {
    return { success: false, error: 'Camp not in draft pool' };
  }

  // Check if already selected
  if (player.selectedCamps.includes(action.campId)) {
    return { success: false, error: 'Camp already selected' };
  }

  // Max 3 camps
  if (player.selectedCamps.length >= 3) {
    return { success: false, error: 'Already selected 3 camps' };
  }

  player.selectedCamps.push(action.campId);

  return {
    success: true,
    newState,
    events: [
      {
        type: 'card_played',
        data: {
          playerId: action.playerId,
          campId: action.campId,
          selectedCount: player.selectedCamps.length,
        },
      },
    ],
  };
}

/**
 * Handle confirming camp selections and starting the game
 */
function handleConfirmCamps(
  state: GameState,
  _action: ConfirmCampsAction
): ActionResult {
  if (state.phase !== 'draft') {
    return { success: false, error: 'Not in draft phase' };
  }

  const newState = cloneState(state);
  const events: GameEvent[] = [];

  // Verify both players have selected exactly 3 camps
  for (const playerId of newState.playerOrder) {
    const player = getPlayer(newState, playerId);
    if (!player || !player.selectedCamps || player.selectedCamps.length !== 3) {
      return {
        success: false,
        error: 'All players must select exactly 3 camps before confirming',
      };
    }
  }

  // Create camp instances for each player
  for (const playerId of newState.playerOrder) {
    const player = newState.players[playerId];
    if (!player || !player.selectedCamps) continue;

    for (let i = 0; i < 3; i++) {
      const campId = player.selectedCamps[i];
      if (!campId) continue;

      // Create camp instance
      const campInstance = createCardInstance(campId, playerId, {
        isReady: true, // Camps start ready
        isDamaged: false,
      });

      // Add to card instances
      newState.cardInstances[campInstance.instanceId] = campInstance;

      // Assign to column
      const column = player.columns[i];
      if (column) {
        column.campInstanceId = campInstance.instanceId;
      }

      events.push({
        type: 'card_played',
        data: {
          playerId,
          instanceId: campInstance.instanceId,
          cardId: campId,
          columnIndex: i,
        },
      });
    }

    // Clean up draft state
    delete player.draftPool;
    delete player.selectedCamps;
  }

  // Deal initial hands (6 cards each)
  for (const playerId of newState.playerOrder) {
    const drawResult = drawCards(newState, playerId, 6);
    if (!drawResult.success) {
      return { success: false, error: `Failed to draw initial hand: ${drawResult.error}` };
    }
    events.push(...drawResult.events);
  }

  // Start the game
  newState.phase = 'playing';
  newState.currentTurn = 1;

  events.push({
    type: 'turn_started',
    data: {
      playerId: newState.activePlayerId,
      turn: newState.currentTurn,
      phase: 'events',
    },
  });

  // Auto-process events phase (no events on turn 1, but still advance queue)
  newState.turnPhase = 'events';
  const eventsResult = processEventsPhase(newState);
  events.push(...eventsResult.events);

  // Auto-process replenish phase (draw card, set water to 3, ready cards)
  const replenishResult = processReplenishPhase(eventsResult.state);
  events.push(...replenishResult.events);

  // Now in actions phase, player can take actions
  return {
    success: true,
    newState: replenishResult.state,
    events,
  };
}
