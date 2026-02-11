/**
 * Action validation module
 *
 * Validates game actions before they're applied to ensure they follow game rules.
 * Returns validation results with clear error messages for invalid actions.
 */

import type {
  GameState,
  GameAction,
  PlayerId,
  PlayPersonAction,
  PlayEventAction,
  PlayPunkAction,
  UseAbilityAction,
  JunkCardAction,
  EndTurnAction,
  SelectCampAction,
  ConfirmCampsAction,
} from '../types/index.js';
import type { JunkIcon } from '../types/card.js';
import {
  getPlayer,
  getCardInstance,
} from '../game/state.js';
import { getCard } from '../cards/index.js';
import { canUseAbility } from './ready.js';
import { canTarget, findCardLocation, getValidRaidTargets } from './protection.js';

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a PlayPerson action
 * Requirements:
 * - Card must be in hand
 * - Must be a person card
 * - Player must have enough water
 * - Column must have room (max 2 people)
 * - Must be player's turn
 * - Must be in actions phase
 */
function validatePlayPerson(
  state: GameState,
  action: PlayPersonAction
): ValidationResult {
  // Check if it's the player's turn
  if (state.activePlayerId !== action.playerId) {
    return { valid: false, error: 'Not your turn' };
  }

  // Check if in correct phase
  if (state.phase !== 'playing') {
    return { valid: false, error: 'Can only play cards during the game' };
  }

  if (state.turnPhase !== 'actions') {
    return { valid: false, error: 'Can only play cards during actions phase' };
  }

  const player = getPlayer(state, action.playerId);
  if (!player) {
    return { valid: false, error: 'Player not found' };
  }

  // Check if card is in hand
  if (!player.hand.includes(action.cardInstanceId)) {
    return { valid: false, error: 'Card not in hand' };
  }

  const instance = getCardInstance(state, action.cardInstanceId);
  if (!instance) {
    return { valid: false, error: 'Card instance not found' };
  }

  const card = getCard(instance.cardId);
  if (!card) {
    return { valid: false, error: 'Card definition not found' };
  }

  // Check if it's a person card
  if (card.type !== 'person') {
    return { valid: false, error: 'Card is not a person' };
  }

  // Check water cost
  if (player.water < card.cost) {
    return {
      valid: false,
      error: `Not enough water (need ${card.cost}, have ${player.water})`,
    };
  }

  // Check if column has room (max 2 people)
  const column = player.columns[action.columnIndex];
  if (!column) {
    return { valid: false, error: 'Invalid column index' };
  }

  if (column.personInstanceIds.length >= 2) {
    return { valid: false, error: 'Column is full (max 2 people)' };
  }

  return { valid: true };
}

/**
 * Validate a PlayEvent action
 * Requirements:
 * - Card must be in hand
 * - Must be an event card
 * - Player must have enough water
 * - Queue slot must be valid (0-2)
 * - Slot must be empty
 * - Must be player's turn
 * - Must be in actions phase
 */
function validatePlayEvent(
  state: GameState,
  action: PlayEventAction
): ValidationResult {
  // Check if it's the player's turn
  if (state.activePlayerId !== action.playerId) {
    return { valid: false, error: 'Not your turn' };
  }

  // Check if in correct phase
  if (state.phase !== 'playing') {
    return { valid: false, error: 'Can only play cards during the game' };
  }

  if (state.turnPhase !== 'actions') {
    return { valid: false, error: 'Can only play cards during actions phase' };
  }

  const player = getPlayer(state, action.playerId);
  if (!player) {
    return { valid: false, error: 'Player not found' };
  }

  // Check if card is in hand
  if (!player.hand.includes(action.cardInstanceId)) {
    return { valid: false, error: 'Card not in hand' };
  }

  const instance = getCardInstance(state, action.cardInstanceId);
  if (!instance) {
    return { valid: false, error: 'Card instance not found' };
  }

  const card = getCard(instance.cardId);
  if (!card) {
    return { valid: false, error: 'Card definition not found' };
  }

  // Check if it's an event card
  if (card.type !== 'event') {
    return { valid: false, error: 'Card is not an event' };
  }

  // Check water cost
  if (player.water < card.cost) {
    return {
      valid: false,
      error: `Not enough water (need ${card.cost}, have ${player.water})`,
    };
  }

  // Check if queue position is valid
  if (action.queuePosition < 0 || action.queuePosition > 2) {
    return { valid: false, error: 'Invalid queue position (must be 0-2)' };
  }

  // Check if queue slot is empty
  const queueSlot = player.eventQueue[action.queuePosition];
  if (!queueSlot) {
    return { valid: false, error: 'Invalid queue slot' };
  }

  if (queueSlot.eventInstanceId !== null) {
    return { valid: false, error: 'Queue slot is already occupied' };
  }

  return { valid: true };
}

/**
 * Validate a PlayPunk action
 * Requirements:
 * - Card must be in hand
 * - Column must have room (max 2 people)
 * - Must be player's turn
 * - Must be in actions phase
 */
function validatePlayPunk(
  state: GameState,
  action: PlayPunkAction
): ValidationResult {
  // Check if it's the player's turn
  if (state.activePlayerId !== action.playerId) {
    return { valid: false, error: 'Not your turn' };
  }

  // Check if in correct phase
  if (state.phase !== 'playing') {
    return { valid: false, error: 'Can only play cards during the game' };
  }

  if (state.turnPhase !== 'actions') {
    return { valid: false, error: 'Can only play cards during actions phase' };
  }

  const player = getPlayer(state, action.playerId);
  if (!player) {
    return { valid: false, error: 'Player not found' };
  }

  // Check if card is in hand
  if (!player.hand.includes(action.cardInstanceId)) {
    return { valid: false, error: 'Card not in hand' };
  }

  // Check if column has room (max 2 people)
  const column = player.columns[action.columnIndex];
  if (!column) {
    return { valid: false, error: 'Invalid column index' };
  }

  if (column.personInstanceIds.length >= 2) {
    return { valid: false, error: 'Column is full (max 2 people)' };
  }

  return { valid: true };
}

/**
 * Validate a UseAbility action
 * Requirements:
 * - Card must exist
 * - Card must have ability at given index
 * - Card must be ready (unless ability.requiresReady=false)
 * - Card must not be damaged
 * - Player must have enough water
 * - Target must be valid if ability requires target
 * - Must be player's turn
 * - Must be in actions phase
 */
function validateUseAbility(
  state: GameState,
  action: UseAbilityAction
): ValidationResult {
  // Check if it's the player's turn
  if (state.activePlayerId !== action.playerId) {
    return { valid: false, error: 'Not your turn' };
  }

  // Check if in correct phase
  if (state.phase !== 'playing') {
    return { valid: false, error: 'Can only use abilities during the game' };
  }

  if (state.turnPhase !== 'actions') {
    return { valid: false, error: 'Can only use abilities during actions phase' };
  }

  const instance = getCardInstance(state, action.sourceInstanceId);
  if (!instance) {
    return { valid: false, error: 'Card not found' };
  }

  // Check if card is owned by the player
  if (instance.ownerId !== action.playerId) {
    return { valid: false, error: 'You do not own this card' };
  }

  const card = getCard(instance.cardId);
  if (!card) {
    return { valid: false, error: 'Card definition not found' };
  }

  // Check if card has abilities
  if (!card.abilities || card.abilities.length === 0) {
    return { valid: false, error: 'Card has no abilities' };
  }

  // Check if ability index is valid
  if (action.abilityIndex < 0 || action.abilityIndex >= card.abilities.length) {
    return { valid: false, error: 'Invalid ability index' };
  }

  const ability = card.abilities[action.abilityIndex]!;

  // Use the ready module to check if ability can be used
  const readyCheck = canUseAbility(state, action.sourceInstanceId, action.abilityIndex);
  if (!readyCheck.canUse) {
    return { valid: false, error: readyCheck.reason ?? 'Cannot use ability' };
  }

  // Validate targets if ability requires them
  if (action.targetInstanceId) {
    const targetInstance = getCardInstance(state, action.targetInstanceId);
    if (!targetInstance) {
      return { valid: false, error: 'Target not found' };
    }

    // Check if target is valid based on ability's first effect
    // (More complex abilities might need deeper validation)
    const primaryEffect = ability.effects[0];
    if (primaryEffect && primaryEffect.target !== 'none' && primaryEffect.target !== 'self') {
      const canTargetResult = canTarget(
        state,
        action.playerId,
        action.targetInstanceId,
        primaryEffect.target
      );

      if (!canTargetResult) {
        return { valid: false, error: 'Invalid target for this ability' };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate a JunkCard action
 * Requirements:
 * - Card must be in hand
 * - Valid target if junk icon requires one (damage, restore, raid need targets)
 * - Must be player's turn
 * - Must be in actions phase
 */
function validateJunkCard(
  state: GameState,
  action: JunkCardAction
): ValidationResult {
  // Check if it's the player's turn
  if (state.activePlayerId !== action.playerId) {
    return { valid: false, error: 'Not your turn' };
  }

  // Check if in correct phase
  if (state.phase !== 'playing') {
    return { valid: false, error: 'Can only junk cards during the game' };
  }

  if (state.turnPhase !== 'actions') {
    return { valid: false, error: 'Can only junk cards during actions phase' };
  }

  const player = getPlayer(state, action.playerId);
  if (!player) {
    return { valid: false, error: 'Player not found' };
  }

  // Check if card is in hand
  if (!player.hand.includes(action.cardInstanceId)) {
    return { valid: false, error: 'Card not in hand' };
  }

  const instance = getCardInstance(state, action.cardInstanceId);
  if (!instance) {
    return { valid: false, error: 'Card instance not found' };
  }

  const card = getCard(instance.cardId);
  if (!card) {
    return { valid: false, error: 'Card definition not found' };
  }

  // Get the junk icon
  let junkIcon: JunkIcon | undefined;
  if (card.type === 'person' || card.type === 'event') {
    junkIcon = card.junkIcon;
  }

  if (!junkIcon) {
    return { valid: false, error: 'Card has no junk icon' };
  }

  // Validate target for junk icons that require one
  const junkIconsRequiringTarget: JunkIcon[] = ['damage', 'restore', 'raid'];
  if (junkIconsRequiringTarget.includes(junkIcon)) {
    if (!action.targetInstanceId) {
      return { valid: false, error: `${junkIcon} junk icon requires a target` };
    }

    const targetInstance = getCardInstance(state, action.targetInstanceId);
    if (!targetInstance) {
      return { valid: false, error: 'Target not found' };
    }

    // Validate target based on junk icon type
    if (junkIcon === 'damage') {
      // Damage can target unprotected enemies
      const canTargetResult = canTarget(
        state,
        action.playerId,
        action.targetInstanceId,
        'unprotected_enemy'
      );
      if (!canTargetResult) {
        return { valid: false, error: 'Can only damage unprotected enemy cards' };
      }
    } else if (junkIcon === 'restore') {
      // Restore can target any damaged card
      if (!targetInstance.isDamaged) {
        return { valid: false, error: 'Target must be damaged' };
      }
      const location = findCardLocation(state, action.targetInstanceId);
      if (!location || (location.type !== 'camp' && location.type !== 'person')) {
        return { valid: false, error: 'Can only restore cards on the board' };
      }
    } else if (junkIcon === 'raid') {
      // Raid can target any enemy camp
      const validRaidTargets = getValidRaidTargets(state, action.playerId);
      if (!validRaidTargets.includes(action.targetInstanceId)) {
        return { valid: false, error: 'Can only raid enemy camps' };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate an EndTurn action
 * Requirements:
 * - Must be player's turn
 * - Must be in actions phase
 */
function validateEndTurn(
  state: GameState,
  action: EndTurnAction
): ValidationResult {
  // Check if it's the player's turn
  if (state.activePlayerId !== action.playerId) {
    return { valid: false, error: 'Not your turn' };
  }

  // Check if in correct phase
  if (state.phase !== 'playing') {
    return { valid: false, error: 'Can only end turn during the game' };
  }

  if (state.turnPhase !== 'actions') {
    return { valid: false, error: 'Can only end turn during actions phase' };
  }

  return { valid: true };
}

/**
 * Validate a SelectCamp action (during draft)
 * Requirements:
 * - Must be in draft phase
 * - Camp must be in player's draft pool
 * - Player must not have already selected 3 camps
 */
function validateSelectCamp(
  state: GameState,
  action: SelectCampAction
): ValidationResult {
  // Check if in draft phase
  if (state.phase !== 'draft') {
    return { valid: false, error: 'Can only select camps during draft' };
  }

  const player = getPlayer(state, action.playerId);
  if (!player) {
    return { valid: false, error: 'Player not found' };
  }

  // Check if player has draft pool
  if (!player.draftPool) {
    return { valid: false, error: 'No draft pool available' };
  }

  // Check if camp is in draft pool
  if (!player.draftPool.includes(action.campId)) {
    return { valid: false, error: 'Camp not in draft pool' };
  }

  // Check if player hasn't selected 3 camps yet
  if (player.selectedCamps && player.selectedCamps.length >= 3) {
    return { valid: false, error: 'Already selected 3 camps' };
  }

  // Check if camp is already selected
  if (player.selectedCamps?.includes(action.campId)) {
    return { valid: false, error: 'Camp already selected' };
  }

  return { valid: true };
}

/**
 * Validate a ConfirmCamps action (during draft)
 * Requirements:
 * - Must be in draft phase
 * - Player must have selected exactly 3 camps
 */
function validateConfirmCamps(
  state: GameState,
  action: ConfirmCampsAction
): ValidationResult {
  // Check if in draft phase
  if (state.phase !== 'draft') {
    return { valid: false, error: 'Can only confirm camps during draft' };
  }

  const player = getPlayer(state, action.playerId);
  if (!player) {
    return { valid: false, error: 'Player not found' };
  }

  // Check if player has selected exactly 3 camps
  if (!player.selectedCamps || player.selectedCamps.length !== 3) {
    return { valid: false, error: 'Must select exactly 3 camps' };
  }

  return { valid: true };
}

/**
 * Main validation function - validates any game action
 */
export function validateAction(
  state: GameState,
  action: GameAction
): ValidationResult {
  switch (action.type) {
    case 'play_person':
      return validatePlayPerson(state, action);
    case 'play_event':
      return validatePlayEvent(state, action);
    case 'play_punk':
      return validatePlayPunk(state, action);
    case 'use_ability':
      return validateUseAbility(state, action);
    case 'junk_card':
      return validateJunkCard(state, action);
    case 'end_turn':
      return validateEndTurn(state, action);
    case 'select_camp':
      return validateSelectCamp(state, action);
    case 'confirm_camps':
      return validateConfirmCamps(state, action);
    case 'select_target':
      // Target selection is a special case - validation depends on context
      // For now, return valid (will be validated when the action is executed)
      return { valid: true };
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = action;
      return { valid: false, error: `Unknown action type: ${(_exhaustive as GameAction).type}` };
  }
}

/**
 * Get all valid actions for a player
 * Useful for AI or UI to show available options
 */
export function getValidActions(
  state: GameState,
  playerId: PlayerId
): GameAction[] {
  const validActions: GameAction[] = [];

  // Only generate actions if it's the player's turn
  if (state.activePlayerId !== playerId) {
    return validActions;
  }

  const player = getPlayer(state, playerId);
  if (!player) {
    return validActions;
  }

  // Draft phase actions
  if (state.phase === 'draft') {
    // Select camp actions
    if (player.draftPool && player.selectedCamps) {
      const remainingCamps = player.draftPool.filter(
        (campId) => !player.selectedCamps!.includes(campId)
      );
      if (player.selectedCamps.length < 3) {
        for (const campId of remainingCamps) {
          validActions.push({
            type: 'select_camp',
            playerId,
            campId,
          });
        }
      }

      // Confirm camps action
      if (player.selectedCamps.length === 3) {
        validActions.push({
          type: 'confirm_camps',
          playerId,
        });
      }
    }
    return validActions;
  }

  // Playing phase actions
  if (state.phase === 'playing' && state.turnPhase === 'actions') {
    // Play person cards
    for (const instanceId of player.hand) {
      const instance = getCardInstance(state, instanceId);
      if (!instance) continue;

      const card = getCard(instance.cardId);
      if (!card || card.type !== 'person') continue;

      for (let colIdx = 0; colIdx < 3; colIdx++) {
        const action: PlayPersonAction = {
          type: 'play_person',
          playerId,
          cardInstanceId: instanceId,
          columnIndex: colIdx as 0 | 1 | 2,
        };
        if (validatePlayPerson(state, action).valid) {
          validActions.push(action);
        }
      }
    }

    // Play event cards
    for (const instanceId of player.hand) {
      const instance = getCardInstance(state, instanceId);
      if (!instance) continue;

      const card = getCard(instance.cardId);
      if (!card || card.type !== 'event') continue;

      for (let queuePos = 0; queuePos < 3; queuePos++) {
        const action: PlayEventAction = {
          type: 'play_event',
          playerId,
          cardInstanceId: instanceId,
          queuePosition: queuePos as 0 | 1 | 2,
        };
        if (validatePlayEvent(state, action).valid) {
          validActions.push(action);
        }
      }
    }

    // Play punk cards
    for (const instanceId of player.hand) {
      for (let colIdx = 0; colIdx < 3; colIdx++) {
        const action: PlayPunkAction = {
          type: 'play_punk',
          playerId,
          cardInstanceId: instanceId,
          columnIndex: colIdx as 0 | 1 | 2,
        };
        if (validatePlayPunk(state, action).valid) {
          validActions.push(action);
        }
      }
    }

    // Use abilities
    for (const column of player.columns) {
      // Check camp abilities
      const campInstance = getCardInstance(state, column.campInstanceId);
      if (campInstance) {
        const campCard = getCard(campInstance.cardId);
        if (campCard?.abilities) {
          for (let abilityIdx = 0; abilityIdx < campCard.abilities.length; abilityIdx++) {
            // Generate action without target first
            const action: UseAbilityAction = {
              type: 'use_ability',
              playerId,
              sourceInstanceId: column.campInstanceId,
              abilityIndex: abilityIdx,
            };
            if (validateUseAbility(state, action).valid) {
              validActions.push(action);
            }
          }
        }
      }

      // Check people abilities
      for (const personId of column.personInstanceIds) {
        const personInstance = getCardInstance(state, personId);
        if (personInstance && !personInstance.isPunk) {
          const personCard = getCard(personInstance.cardId);
          if (personCard?.abilities) {
            for (let abilityIdx = 0; abilityIdx < personCard.abilities.length; abilityIdx++) {
              const action: UseAbilityAction = {
                type: 'use_ability',
                playerId,
                sourceInstanceId: personId,
                abilityIndex: abilityIdx,
              };
              if (validateUseAbility(state, action).valid) {
                validActions.push(action);
              }
            }
          }
        }
      }
    }

    // Junk cards
    for (const instanceId of player.hand) {
      const action: JunkCardAction = {
        type: 'junk_card',
        playerId,
        cardInstanceId: instanceId,
      };
      if (validateJunkCard(state, action).valid) {
        validActions.push(action);
      }
    }

    // End turn
    const endTurnAction: EndTurnAction = {
      type: 'end_turn',
      playerId,
    };
    if (validateEndTurn(state, endTurnAction).valid) {
      validActions.push(endTurnAction);
    }
  }

  return validActions;
}
