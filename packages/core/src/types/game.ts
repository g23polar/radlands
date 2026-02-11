/**
 * Game state types and interfaces
 */

import type { CardInstance, CardInstanceId, CardId } from './card.js';

/** Unique identifier for players */
export type PlayerId = string;

/** Unique identifier for game sessions */
export type GameId = string;

/** Turn phases */
export type TurnPhase =
  | 'events' // Resolve event in queue space 1, advance all events
  | 'replenish' // Draw 1 card, get 3 water
  | 'actions' // Play cards, use abilities, junk cards
  | 'end'; // Cleanup, check win condition

/** Game phases (broader than turn phases) */
export type GamePhase =
  | 'draft' // Players drafting camps
  | 'playing' // Main game in progress
  | 'ended'; // Game over

/** A column on the board (holds 0-2 people in front of a camp) */
export interface Column {
  campInstanceId: CardInstanceId; // The camp at the back
  personInstanceIds: CardInstanceId[]; // 0-2 people, index 0 is furthest forward
}

/** Event queue slot */
export interface EventQueueSlot {
  eventInstanceId: CardInstanceId | null; // null if empty
}

/** Player state */
export interface PlayerState {
  id: PlayerId;
  name: string;
  water: number;
  columns: [Column, Column, Column]; // 3 columns
  hand: CardInstanceId[];
  eventQueue: [EventQueueSlot, EventQueueSlot, EventQueueSlot]; // 3 slots
  deck: CardInstanceId[]; // Draw pile (order matters)
  discard: CardInstanceId[]; // Discard pile
  // Draft state
  draftPool?: CardId[]; // Camps available to pick during draft
  selectedCamps?: CardId[]; // Camps chosen during draft
}

/** Complete game state - immutable, passed around */
export interface GameState {
  id: GameId;
  phase: GamePhase;
  turnPhase: TurnPhase;
  currentTurn: number;
  activePlayerId: PlayerId; // Whose turn it is
  players: {
    [playerId: PlayerId]: PlayerState;
  };
  playerOrder: [PlayerId, PlayerId]; // Turn order
  /** All card instances in this game, indexed by instanceId */
  cardInstances: {
    [instanceId: CardInstanceId]: CardInstance;
  };
  /** Random seed for deterministic randomness */
  seed: number;
  /** Action history for replay/undo */
  history: GameAction[];
  /** Winner if game ended */
  winnerId?: PlayerId;
  /** Reason for game end */
  endReason?: 'camps_destroyed' | 'deck_out' | 'concede';
}

/** Action types that can be performed */
export type GameActionType =
  | 'play_person'
  | 'play_event'
  | 'play_punk'
  | 'use_ability'
  | 'junk_card'
  | 'end_turn'
  | 'select_camp' // During draft
  | 'confirm_camps' // Finalize draft selection
  | 'select_target'; // When an action requires targeting

/** Base action structure */
export interface BaseAction {
  type: GameActionType;
  playerId: PlayerId;
  timestamp?: number;
}

/** Play a person card from hand */
export interface PlayPersonAction extends BaseAction {
  type: 'play_person';
  cardInstanceId: CardInstanceId;
  columnIndex: 0 | 1 | 2;
}

/** Play an event card from hand */
export interface PlayEventAction extends BaseAction {
  type: 'play_event';
  cardInstanceId: CardInstanceId;
  queuePosition: 0 | 1 | 2; // Which queue slot (0 = resolves soonest)
}

/** Play a card face-down as a punk */
export interface PlayPunkAction extends BaseAction {
  type: 'play_punk';
  cardInstanceId: CardInstanceId;
  columnIndex: 0 | 1 | 2;
}

/** Use an ability on a card */
export interface UseAbilityAction extends BaseAction {
  type: 'use_ability';
  sourceInstanceId: CardInstanceId; // Card using the ability
  abilityIndex: number; // Which ability (cards can have multiple)
  targetInstanceId?: CardInstanceId; // Target if ability requires one
  additionalTargets?: CardInstanceId[]; // For multi-target abilities
}

/** Junk a card from hand for its icon effect */
export interface JunkCardAction extends BaseAction {
  type: 'junk_card';
  cardInstanceId: CardInstanceId;
  targetInstanceId?: CardInstanceId; // For damage/restore junk effects
}

/** End the current turn */
export interface EndTurnAction extends BaseAction {
  type: 'end_turn';
}

/** Select a camp during draft */
export interface SelectCampAction extends BaseAction {
  type: 'select_camp';
  campId: CardId;
}

/** Confirm camp selections during draft */
export interface ConfirmCampsAction extends BaseAction {
  type: 'confirm_camps';
}

/** Select a target for a pending effect */
export interface SelectTargetAction extends BaseAction {
  type: 'select_target';
  targetInstanceId: CardInstanceId;
}

/** Union type for all game actions */
export type GameAction =
  | PlayPersonAction
  | PlayEventAction
  | PlayPunkAction
  | UseAbilityAction
  | JunkCardAction
  | EndTurnAction
  | SelectCampAction
  | ConfirmCampsAction
  | SelectTargetAction;

/** Result of applying an action */
export interface ActionResult {
  success: boolean;
  newState?: GameState;
  error?: string;
  /** Events that occurred (for animation/UI) */
  events?: GameEvent[];
}

/** Game events for UI/animation purposes */
export type GameEventType =
  | 'card_played'
  | 'card_damaged'
  | 'card_destroyed'
  | 'card_restored'
  | 'card_junked'
  | 'card_drawn'
  | 'water_changed'
  | 'turn_started'
  | 'turn_ended'
  | 'event_resolved'
  | 'event_advanced'
  | 'punk_created'
  | 'ability_used'
  | 'game_ended';

export interface GameEvent {
  type: GameEventType;
  data: Record<string, unknown>;
}

/** For pending actions that require targeting */
export interface PendingAction {
  action: GameAction;
  requiredTargets: number;
  validTargets: CardInstanceId[];
  selectedTargets: CardInstanceId[];
}
