/**
 * Base card types and interfaces for Radlands
 */

/** Unique identifier for cards */
export type CardId = string;

/** Unique identifier for card instances in a game */
export type CardInstanceId = string;

/** The different card types in the game */
export type CardType = 'camp' | 'person' | 'event';

/** Junk icon types - effect when a card is discarded */
export type JunkIcon =
  | 'damage' // Deal 1 damage to any card
  | 'draw' // Draw 1 card
  | 'restore' // Restore 1 damaged card
  | 'punk' // Put a punk into play
  | 'water' // Gain 1 water
  | 'raid'; // Damage any enemy camp (bypasses protection)

/** Effect trigger timing */
export type EffectTrigger =
  | 'play' // When card enters play
  | 'destroy' // When card is destroyed
  | 'ability' // When ability is activated
  | 'passive' // Always active
  | 'start_turn' // At start of your turn
  | 'end_turn' // At end of your turn
  | 'on_damage' // When this card is damaged
  | 'on_restore'; // When this card is restored

/** Target types for effects */
export type TargetType =
  | 'self' // This card
  | 'any_card' // Any card on the board
  | 'any_person' // Any person card
  | 'any_camp' // Any camp
  | 'any_enemy' // Any enemy card
  | 'any_enemy_person' // Any enemy person
  | 'any_enemy_camp' // Any enemy camp
  | 'any_friendly' // Any friendly card
  | 'any_friendly_person' // Any friendly person
  | 'unprotected_enemy' // Unprotected enemy card
  | 'unprotected_enemy_person' // Unprotected enemy person
  | 'unprotected_enemy_camp' // Unprotected enemy camp
  | 'column' // A specific column
  | 'player' // A player (for draw, water effects)
  | 'none'; // No target needed

/** Effect types that can be applied */
export type EffectType =
  | 'damage' // Deal damage
  | 'destroy' // Destroy directly (no damage)
  | 'restore' // Remove damage
  | 'draw' // Draw cards
  | 'water' // Gain water
  | 'punk' // Create a punk
  | 'move' // Move a card
  | 'ready' // Make a card ready
  | 'unready' // Make a card not ready
  | 'protect' // Give protection
  | 'discard' // Discard from hand
  | 'return_hand' // Return to hand
  | 'injure' // Deal damage that can't be prevented
  | 'raid'; // Damage camp, bypasses protection

/** A single effect definition */
export interface Effect {
  type: EffectType;
  target: TargetType;
  amount?: number; // For damage, draw, water, etc.
  condition?: EffectCondition; // Optional condition
}

/** Conditions that can modify effects */
export interface EffectCondition {
  type:
    | 'if_damaged' // Target must be damaged
    | 'if_ready' // Target must be ready
    | 'if_unready' // Target must not be ready
    | 'if_protected' // Target must be protected
    | 'if_unprotected' // Target must be unprotected
    | 'per_card' // Effect scales with card count
    | 'per_water'; // Effect scales with water
  target?: TargetType; // What to check the condition against
}

/** Ability definition for cards */
export interface Ability {
  cost: number; // Water cost
  effects: Effect[];
  requiresReady?: boolean; // Default true - can only use when ready
  makesUnready?: boolean; // Default true - using makes card unready
  description: string; // Human-readable description
}

/** Base interface for all card definitions */
export interface BaseCard {
  id: CardId;
  name: string;
  type: CardType;
  abilities?: Ability[];
  traits?: string[]; // Special keywords (e.g., "Volatile", "Shielded")
  flavorText?: string;
  artworkUrl?: string;
}

/** Camp card definition */
export interface CampCard extends BaseCard {
  type: 'camp';
  // Camps don't have a water cost - they're drafted
  startingDamage?: number; // Some camps start damaged
}

/** Person card definition */
export interface PersonCard extends BaseCard {
  type: 'person';
  cost: number; // Water cost to play
  junkIcon: JunkIcon;
}

/** Event card definition */
export interface EventCard extends BaseCard {
  type: 'event';
  cost: number; // Water cost to play
  junkIcon: JunkIcon;
  effects: Effect[]; // Effects when event resolves
}

/** Union type for all cards */
export type Card = CampCard | PersonCard | EventCard;

/** Runtime card instance (card in play or in hand) */
export interface CardInstance {
  instanceId: CardInstanceId;
  cardId: CardId;
  ownerId: string; // Player who owns this instance
  isDamaged: boolean;
  isReady: boolean;
  isPunk: boolean; // True if played face-down as a punk
  turnPlayed?: number; // Track when played for ready state
  turnActed?: number; // Track when last used ability
}

/** Type guards */
export function isCampCard(card: Card): card is CampCard {
  return card.type === 'camp';
}

export function isPersonCard(card: Card): card is PersonCard {
  return card.type === 'person';
}

export function isEventCard(card: Card): card is EventCard {
  return card.type === 'event';
}
