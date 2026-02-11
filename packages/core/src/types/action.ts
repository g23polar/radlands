/**
 * Re-export action types from game.ts for convenience
 * This file exists for organizational clarity
 */

export type {
  GameAction,
  GameActionType,
  BaseAction,
  PlayPersonAction,
  PlayEventAction,
  PlayPunkAction,
  UseAbilityAction,
  JunkCardAction,
  EndTurnAction,
  SelectCampAction,
  ConfirmCampsAction,
  SelectTargetAction,
  ActionResult,
  PendingAction,
} from './game.js';
