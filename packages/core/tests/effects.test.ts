/**
 * Effect application tests
 *
 * Tests for effect resolution:
 * - Damage: undamaged → damaged
 * - Damage: damaged → destroyed
 * - Damage: punk → instantly destroyed
 * - Restore: removes damage, makes unready
 * - Draw cards works
 * - Water add/spend works
 * - Create punk in column
 */

import { describe, it, expect } from 'vitest';
import {
  createGame,
  getPlayer,
  createCardInstance,
  cloneState,
  getCardInstance,
} from '../src/game/state.js';
import {
  applyDamage,
  destroyCard,
  restoreCard,
  drawCards,
  addWater,
  spendWater,
  createPunk,
  applyEffect,
} from '../src/rules/effects.js';
import { findCardLocation } from '../src/rules/protection.js';
import type { GameState } from '../src/types/game.js';
import type { CardInstanceId, Effect } from '../src/types/card.js';

/**
 * Helper: Set up a game with camps placed
 */
function setupGameWithCamps(): GameState {
  const game = createGame({
    player1Id: 'p1',
    player1Name: 'Player 1',
    player2Id: 'p2',
    player2Name: 'Player 2',
    seed: 12345,
  });

  const state = cloneState(game);

  // Place camps for player 1
  const p1Camp1 = createCardInstance('camp_garage', 'p1');
  const p1Camp2 = createCardInstance('camp_watering_hole', 'p1');
  const p1Camp3 = createCardInstance('camp_bunker', 'p1');

  state.cardInstances[p1Camp1.instanceId] = p1Camp1;
  state.cardInstances[p1Camp2.instanceId] = p1Camp2;
  state.cardInstances[p1Camp3.instanceId] = p1Camp3;

  const player1 = state.players['p1']!;
  player1.columns[0]!.campInstanceId = p1Camp1.instanceId;
  player1.columns[1]!.campInstanceId = p1Camp2.instanceId;
  player1.columns[2]!.campInstanceId = p1Camp3.instanceId;

  return state;
}

/**
 * Helper: Add a person to a column
 */
function addPersonToColumn(
  state: GameState,
  playerId: string,
  columnIndex: number,
  cardId: string
): CardInstanceId {
  const instance = createCardInstance(cardId, playerId);
  state.cardInstances[instance.instanceId] = instance;

  const player = state.players[playerId]!;
  const column = player.columns[columnIndex]!;
  column.personInstanceIds.push(instance.instanceId);

  return instance.instanceId;
}

describe('effects - damage', () => {
  it('damages undamaged card', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner');

    const result = applyDamage(state, personId);

    expect(result.success).toBe(true);
    const instance = result.state.cardInstances[personId]!;
    expect(instance.isDamaged).toBe(true);
    expect(instance.isReady).toBe(false); // Damaged cards are not ready
    expect(result.events.length).toBe(1);
    expect(result.events[0]!.type).toBe('card_damaged');
  });

  it('destroys already damaged card', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner');

    // Damage once
    const firstDamage = applyDamage(state, personId);
    expect(firstDamage.success).toBe(true);

    // Damage again - should destroy
    const secondDamage = applyDamage(firstDamage.state, personId);

    expect(secondDamage.success).toBe(true);
    expect(secondDamage.events.some(e => e.type === 'card_destroyed')).toBe(true);

    // Card should be in discard
    const player = getPlayer(secondDamage.state, 'p1')!;
    expect(player.discard).toContain(personId);

    // Card should be removed from column
    const column = player.columns[0]!;
    expect(column.personInstanceIds).not.toContain(personId);
  });

  it('instantly destroys punk when damaged', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner');

    // Make it a punk
    const instance = state.cardInstances[personId]!;
    instance.isPunk = true;

    const result = applyDamage(state, personId);

    expect(result.success).toBe(true);
    expect(result.events.some(e => e.type === 'card_destroyed')).toBe(true);

    // Punk should be destroyed immediately (in discard)
    const player = getPlayer(result.state, 'p1')!;
    expect(player.discard).toContain(personId);
  });

  it('makes damaged card unready', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner');

    // Make card ready first
    state.cardInstances[personId]!.isReady = true;

    const result = applyDamage(state, personId);

    expect(result.success).toBe(true);
    const instance = result.state.cardInstances[personId]!;
    expect(instance.isReady).toBe(false);
  });

  it('returns error when target not found', () => {
    const state = setupGameWithCamps();

    const result = applyDamage(state, 'invalid_id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Target not found');
  });
});

describe('effects - destroy', () => {
  it('destroys person and moves to discard', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner');

    const result = destroyCard(state, personId);

    expect(result.success).toBe(true);
    expect(result.events.length).toBe(1);
    expect(result.events[0]!.type).toBe('card_destroyed');

    const player = getPlayer(result.state, 'p1')!;
    expect(player.discard).toContain(personId);
    expect(player.columns[0]!.personInstanceIds).not.toContain(personId);
  });

  it('destroys camp and removes from game', () => {
    const state = setupGameWithCamps();
    const player = getPlayer(state, 'p1')!;
    const campId = player.columns[0]!.campInstanceId;

    const result = destroyCard(state, campId);

    expect(result.success).toBe(true);

    // Camp should be completely removed
    const newPlayer = getPlayer(result.state, 'p1')!;
    expect(newPlayer.columns[0]!.campInstanceId).toBe('');
    expect(result.state.cardInstances[campId]).toBeUndefined();
    expect(newPlayer.discard).not.toContain(campId); // Camps don't go to discard
  });

  it('removes person from back position correctly', () => {
    const state = setupGameWithCamps();
    const front = addPersonToColumn(state, 'p1', 0, 'person_gunner');
    const back = addPersonToColumn(state, 'p1', 0, 'person_scout');

    const result = destroyCard(state, back);

    expect(result.success).toBe(true);

    const player = getPlayer(result.state, 'p1')!;
    const column = player.columns[0]!;
    expect(column.personInstanceIds).toContain(front);
    expect(column.personInstanceIds).not.toContain(back);
    expect(column.personInstanceIds.length).toBe(1);
  });
});

describe('effects - restore', () => {
  it('restores damaged card', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner');

    // Damage the card first
    const damagedState = applyDamage(state, personId).state;

    const result = restoreCard(damagedState, personId);

    expect(result.success).toBe(true);
    const instance = result.state.cardInstances[personId]!;
    expect(instance.isDamaged).toBe(false);
    expect(instance.isReady).toBe(false); // Restored cards are not ready
    expect(result.events.length).toBe(1);
    expect(result.events[0]!.type).toBe('card_restored');
  });

  it('makes restored card unready', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner');

    // Damage and make ready
    const instance = state.cardInstances[personId]!;
    instance.isDamaged = true;
    instance.isReady = true;

    const result = restoreCard(state, personId);

    expect(result.success).toBe(true);
    const newInstance = result.state.cardInstances[personId]!;
    expect(newInstance.isReady).toBe(false);
  });

  it('returns error when card is not damaged', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner');

    const result = restoreCard(state, personId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Card is not damaged');
  });

  it('returns error when target not found', () => {
    const state = setupGameWithCamps();

    const result = restoreCard(state, 'invalid_id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Target not found');
  });
});

describe('effects - draw cards', () => {
  it('draws card from deck to hand', () => {
    const state = setupGameWithCamps();
    const player = getPlayer(state, 'p1')!;

    const initialHandSize = player.hand.length;
    const initialDeckSize = player.deck.length;

    const result = drawCards(state, 'p1', 1);

    expect(result.success).toBe(true);
    const newPlayer = getPlayer(result.state, 'p1')!;
    expect(newPlayer.hand.length).toBe(initialHandSize + 1);
    expect(newPlayer.deck.length).toBe(initialDeckSize - 1);
    expect(result.events.length).toBe(1);
    expect(result.events[0]!.type).toBe('card_drawn');
  });

  it('draws multiple cards', () => {
    const state = setupGameWithCamps();
    const player = getPlayer(state, 'p1')!;

    const initialHandSize = player.hand.length;

    const result = drawCards(state, 'p1', 3);

    expect(result.success).toBe(true);
    const newPlayer = getPlayer(result.state, 'p1')!;
    expect(newPlayer.hand.length).toBe(initialHandSize + 3);
    expect(result.events.length).toBe(3);
  });

  it('reshuffles discard when deck is empty', () => {
    const state = setupGameWithCamps();
    const player = state.players['p1']!;

    // Move all deck cards to discard
    player.discard = [...player.deck];
    player.deck = [];

    const result = drawCards(state, 'p1', 1);

    expect(result.success).toBe(true);
    const newPlayer = getPlayer(result.state, 'p1')!;
    expect(newPlayer.hand.length).toBe(1);
    expect(newPlayer.deck.length).toBeGreaterThan(0); // Reshuffled
    expect(newPlayer.discard.length).toBe(0); // Discard cleared
  });

  it('stops drawing when both deck and discard are empty', () => {
    const state = setupGameWithCamps();
    const player = state.players['p1']!;

    // Empty both deck and discard
    player.deck = [];
    player.discard = [];

    const result = drawCards(state, 'p1', 3);

    expect(result.success).toBe(true);
    const newPlayer = getPlayer(result.state, 'p1')!;
    expect(newPlayer.hand.length).toBe(0); // No cards to draw
    expect(result.events.length).toBe(0);
  });
});

describe('effects - water', () => {
  it('adds water to player', () => {
    const state = setupGameWithCamps();
    const player = getPlayer(state, 'p1')!;
    const initialWater = player.water;

    const result = addWater(state, 'p1', 2);

    expect(result.success).toBe(true);
    const newPlayer = getPlayer(result.state, 'p1')!;
    expect(newPlayer.water).toBe(initialWater + 2);
    expect(result.events.length).toBe(1);
    expect(result.events[0]!.type).toBe('water_changed');
  });

  it('spends water from player', () => {
    const state = setupGameWithCamps();
    const player = state.players['p1']!;
    player.water = 5;

    const result = spendWater(state, 'p1', 2);

    expect(result.success).toBe(true);
    const newPlayer = getPlayer(result.state, 'p1')!;
    expect(newPlayer.water).toBe(3);
    expect(result.events.length).toBe(1);
  });

  it('returns error when not enough water', () => {
    const state = setupGameWithCamps();
    const player = state.players['p1']!;
    player.water = 1;

    const result = spendWater(state, 'p1', 3);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not enough water');
    const newPlayer = getPlayer(result.state, 'p1')!;
    expect(newPlayer.water).toBe(1); // Unchanged
  });
});

describe('effects - create punk', () => {
  it('creates punk in empty column', () => {
    const state = setupGameWithCamps();
    const player = getPlayer(state, 'p1')!;

    const result = createPunk(state, 'p1', 0);

    expect(result.success).toBe(true);
    const newPlayer = getPlayer(result.state, 'p1')!;
    const column = newPlayer.columns[0]!;
    expect(column.personInstanceIds.length).toBe(1);

    const punkId = column.personInstanceIds[0]!;
    const punkInstance = result.state.cardInstances[punkId]!;
    expect(punkInstance.isPunk).toBe(true);
    expect(punkInstance.cardId).toBe('punk');
    expect(punkInstance.isReady).toBe(false);
    expect(result.events.length).toBe(1);
    expect(result.events[0]!.type).toBe('punk_created');
  });

  it('adds punk to front of column with existing person', () => {
    const state = setupGameWithCamps();
    const existingPerson = addPersonToColumn(state, 'p1', 0, 'person_gunner');

    const result = createPunk(state, 'p1', 0);

    expect(result.success).toBe(true);
    const newPlayer = getPlayer(result.state, 'p1')!;
    const column = newPlayer.columns[0]!;
    expect(column.personInstanceIds.length).toBe(2);
    expect(column.personInstanceIds[1]).toBe(existingPerson); // Existing person moved to back
    expect(result.state.cardInstances[column.personInstanceIds[0]!]!.isPunk).toBe(true);
  });

  it('returns error when column is full', () => {
    const state = setupGameWithCamps();
    addPersonToColumn(state, 'p1', 0, 'person_gunner');
    addPersonToColumn(state, 'p1', 0, 'person_scout');

    const result = createPunk(state, 'p1', 0);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Column is full');
  });

  it('returns error for invalid column index', () => {
    const state = setupGameWithCamps();

    const result = createPunk(state, 'p1', 5);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid column');
  });

  it('punk has correct turn played', () => {
    const state = setupGameWithCamps();
    state.currentTurn = 5;

    const result = createPunk(state, 'p1', 0);

    expect(result.success).toBe(true);
    const player = getPlayer(result.state, 'p1')!;
    const punkId = player.columns[0]!.personInstanceIds[0]!;
    const punkInstance = result.state.cardInstances[punkId]!;
    expect(punkInstance.turnPlayed).toBe(5);
  });
});

describe('effects - applyEffect', () => {
  it('applies damage effect', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner');

    const effect: Effect = {
      type: 'damage',
      target: 'any_enemy',
      amount: 1,
    };

    const result = applyEffect(state, effect, 'p2', personId);

    expect(result.success).toBe(true);
    const instance = result.state.cardInstances[personId]!;
    expect(instance.isDamaged).toBe(true);
  });

  it('applies restore effect', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner');

    // Damage first
    state.cardInstances[personId]!.isDamaged = true;

    const effect: Effect = {
      type: 'restore',
      target: 'any_friendly',
    };

    const result = applyEffect(state, effect, 'p1', personId);

    expect(result.success).toBe(true);
    const instance = result.state.cardInstances[personId]!;
    expect(instance.isDamaged).toBe(false);
  });

  it('applies draw effect', () => {
    const state = setupGameWithCamps();
    const player = getPlayer(state, 'p1')!;
    const initialHandSize = player.hand.length;

    const effect: Effect = {
      type: 'draw',
      target: 'player',
      amount: 2,
    };

    const result = applyEffect(state, effect, 'p1');

    expect(result.success).toBe(true);
    const newPlayer = getPlayer(result.state, 'p1')!;
    expect(newPlayer.hand.length).toBe(initialHandSize + 2);
  });

  it('applies water effect', () => {
    const state = setupGameWithCamps();
    const player = getPlayer(state, 'p1')!;
    const initialWater = player.water;

    const effect: Effect = {
      type: 'water',
      target: 'player',
      amount: 3,
    };

    const result = applyEffect(state, effect, 'p1');

    expect(result.success).toBe(true);
    const newPlayer = getPlayer(result.state, 'p1')!;
    expect(newPlayer.water).toBe(initialWater + 3);
  });

  it('applies punk effect', () => {
    const state = setupGameWithCamps();

    const effect: Effect = {
      type: 'punk',
      target: 'column',
    };

    const result = applyEffect(state, effect, 'p1', undefined, 0);

    expect(result.success).toBe(true);
    const player = getPlayer(result.state, 'p1')!;
    const column = player.columns[0]!;
    expect(column.personInstanceIds.length).toBe(1);
    expect(result.state.cardInstances[column.personInstanceIds[0]!]!.isPunk).toBe(true);
  });

  it('returns error for unknown effect type', () => {
    const state = setupGameWithCamps();

    const effect = {
      type: 'unknown_effect',
      target: 'player',
    } as any;

    const result = applyEffect(state, effect, 'p1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown effect type');
  });
});
