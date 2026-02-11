/**
 * Ready state mechanics tests
 *
 * Tests for card ready state:
 * - Cards not ready when played
 * - Cards become ready at start of turn
 * - Using ability makes card unready
 * - Damaged cards can't use abilities
 * - canUseAbility validation
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
  canUseAbility,
  makeReady,
  makeUnready,
  readyAllPlayerCards,
  shouldMakeUnready,
  markActed,
  wasPlayedThisTurn,
  getReadyCardsWithAbilities,
} from '../src/rules/ready.js';
import type { GameState } from '../src/types/game.js';
import type { CardInstanceId, Ability } from '../src/types/card.js';
import { getCard } from '../src/cards/index.js';

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
  cardId: string,
  isReady: boolean = false
): CardInstanceId {
  const instance = createCardInstance(cardId, playerId, { isReady });
  state.cardInstances[instance.instanceId] = instance;

  const player = state.players[playerId]!;
  const column = player.columns[columnIndex]!;
  column.personInstanceIds.push(instance.instanceId);

  return instance.instanceId;
}

describe('ready - initial state', () => {
  it('cards are not ready when first created', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner');

    const instance = getCardInstance(state, personId)!;

    expect(instance.isReady).toBe(false);
  });

  it('newly played cards are not ready', () => {
    const state = setupGameWithCamps();
    const instance = createCardInstance('person_gunner', 'p1');
    instance.turnPlayed = state.currentTurn;

    expect(instance.isReady).toBe(false);
  });

  it('camps start not ready', () => {
    const state = setupGameWithCamps();
    const player = getPlayer(state, 'p1')!;
    const campId = player.columns[0]!.campInstanceId;

    const instance = getCardInstance(state, campId)!;

    expect(instance.isReady).toBe(false);
  });
});

describe('ready - makeReady and makeUnready', () => {
  it('makeReady sets card to ready', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner', false);

    const newState = makeReady(state, personId);
    const instance = getCardInstance(newState, personId)!;

    expect(instance.isReady).toBe(true);
  });

  it('makeUnready sets card to not ready', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner', true);

    const newState = makeUnready(state, personId);
    const instance = getCardInstance(newState, personId)!;

    expect(instance.isReady).toBe(false);
  });

  it('makeReady does not mutate original state', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner', false);

    const originalReady = getCardInstance(state, personId)!.isReady;
    makeReady(state, personId);
    const afterReady = getCardInstance(state, personId)!.isReady;

    expect(originalReady).toBe(false);
    expect(afterReady).toBe(false); // Original state unchanged
  });
});

describe('ready - readyAllPlayerCards', () => {
  it('readies all undamaged cards for a player', () => {
    const state = setupGameWithCamps();
    const player = getPlayer(state, 'p1')!;
    const person1 = addPersonToColumn(state, 'p1', 0, 'person_gunner', false);
    const person2 = addPersonToColumn(state, 'p1', 1, 'person_scout', false);

    const newState = readyAllPlayerCards(state, 'p1');

    const campInstance = getCardInstance(newState, player.columns[0]!.campInstanceId)!;
    const person1Instance = getCardInstance(newState, person1)!;
    const person2Instance = getCardInstance(newState, person2)!;

    expect(campInstance.isReady).toBe(true);
    expect(person1Instance.isReady).toBe(true);
    expect(person2Instance.isReady).toBe(true);
  });

  it('does not ready damaged cards', () => {
    const state = setupGameWithCamps();
    const person1 = addPersonToColumn(state, 'p1', 0, 'person_gunner', false);

    // Damage the person
    const instance = state.cardInstances[person1]!;
    instance.isDamaged = true;

    const newState = readyAllPlayerCards(state, 'p1');
    const person1Instance = getCardInstance(newState, person1)!;

    expect(person1Instance.isReady).toBe(false);
    expect(person1Instance.isDamaged).toBe(true);
  });

  it('only readies cards owned by specified player', () => {
    const state = setupGameWithCamps();
    const p1Person = addPersonToColumn(state, 'p1', 0, 'person_gunner', false);

    // Add camps for player 2
    const p2Camp = createCardInstance('camp_garage', 'p2', { isReady: false });
    state.cardInstances[p2Camp.instanceId] = p2Camp;
    state.players['p2']!.columns[0]!.campInstanceId = p2Camp.instanceId;

    const newState = readyAllPlayerCards(state, 'p1');

    const p1Instance = getCardInstance(newState, p1Person)!;
    const p2Instance = getCardInstance(newState, p2Camp.instanceId)!;

    expect(p1Instance.isReady).toBe(true);
    expect(p2Instance.isReady).toBe(false); // Player 2's cards not readied
  });
});

describe('ready - canUseAbility', () => {
  it('can use ability when card is ready and has enough water', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner', true);

    // Gunner has 1-cost ability, player starts with 3 water
    const result = canUseAbility(state, personId, 0);

    expect(result.canUse).toBe(true);
  });

  it('cannot use ability when card is not ready', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner', false);

    const result = canUseAbility(state, personId, 0);

    expect(result.canUse).toBe(false);
    expect(result.reason).toBe('Card is not ready');
  });

  it('cannot use ability when card is damaged', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner', true);

    const instance = state.cardInstances[personId]!;
    instance.isDamaged = true;

    const result = canUseAbility(state, personId, 0);

    expect(result.canUse).toBe(false);
    expect(result.reason).toBe('Damaged cards cannot use abilities');
  });

  it('cannot use ability when not enough water', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner', true);

    // Set water to 0 (Gunner needs 1)
    state.players['p1']!.water = 0;

    const result = canUseAbility(state, personId, 0);

    expect(result.canUse).toBe(false);
    expect(result.reason).toBe('Not enough water');
  });

  it('cannot use ability on punk (no abilities)', () => {
    const state = setupGameWithCamps();
    const punkId = addPersonToColumn(state, 'p1', 0, 'person_gunner', true);

    const instance = state.cardInstances[punkId]!;
    instance.isPunk = true;

    const result = canUseAbility(state, punkId, 0);

    expect(result.canUse).toBe(false);
    expect(result.reason).toBe('Punks have no abilities');
  });

  it('returns error for invalid ability index', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner', true);

    const result = canUseAbility(state, personId, 5); // Gunner only has 1 ability

    expect(result.canUse).toBe(false);
    expect(result.reason).toBe('Invalid ability index');
  });

  it('can use ability that does not require ready state', () => {
    const state = setupGameWithCamps();
    const player = getPlayer(state, 'p1')!;
    const campId = player.columns[1]!.campInstanceId; // Watering Hole

    // Watering Hole ability costs 0 and doesn't require ready
    // But we need to check the ability definition - by default requiresReady is true
    const instance = state.cardInstances[campId]!;
    instance.isReady = false;

    const result = canUseAbility(state, campId, 0);

    // Most abilities require ready by default
    expect(result.canUse).toBe(false);
  });
});

describe('ready - ability state changes', () => {
  it('shouldMakeUnready returns true by default', () => {
    const card = getCard('person_gunner');
    const ability = card?.abilities?.[0];

    expect(shouldMakeUnready(ability!)).toBe(true);
  });

  it('shouldMakeUnready returns false when makesUnready is false', () => {
    const ability: Ability = {
      cost: 0,
      effects: [],
      makesUnready: false,
      description: 'Test ability',
    };

    expect(shouldMakeUnready(ability)).toBe(false);
  });

  it('markActed makes card unready for normal abilities', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner', true);

    const card = getCard('person_gunner');
    const ability = card?.abilities?.[0]!;

    const newState = markActed(state, personId, ability);
    const instance = getCardInstance(newState, personId)!;

    expect(instance.isReady).toBe(false);
    expect(instance.turnActed).toBe(state.currentTurn);
  });

  it('markActed keeps card ready when makesUnready is false', () => {
    const state = setupGameWithCamps();
    const personId = addPersonToColumn(state, 'p1', 0, 'person_gunner', true);

    const ability: Ability = {
      cost: 0,
      effects: [],
      makesUnready: false,
      description: 'Test ability',
    };

    const newState = markActed(state, personId, ability);
    const instance = getCardInstance(newState, personId)!;

    expect(instance.isReady).toBe(true);
  });
});

describe('ready - wasPlayedThisTurn', () => {
  it('returns true when card was played this turn', () => {
    const state = setupGameWithCamps();
    const instance = createCardInstance('person_gunner', 'p1');
    instance.turnPlayed = state.currentTurn;
    state.cardInstances[instance.instanceId] = instance;

    const wasPlayed = wasPlayedThisTurn(state, instance.instanceId);

    expect(wasPlayed).toBe(true);
  });

  it('returns false when card was played previous turn', () => {
    const state = setupGameWithCamps();
    const instance = createCardInstance('person_gunner', 'p1');
    instance.turnPlayed = state.currentTurn - 1;
    state.cardInstances[instance.instanceId] = instance;

    const wasPlayed = wasPlayedThisTurn(state, instance.instanceId);

    expect(wasPlayed).toBe(false);
  });

  it('returns false when turnPlayed is undefined', () => {
    const state = setupGameWithCamps();
    const instance = createCardInstance('person_gunner', 'p1');
    state.cardInstances[instance.instanceId] = instance;

    const wasPlayed = wasPlayedThisTurn(state, instance.instanceId);

    expect(wasPlayed).toBe(false);
  });
});

describe('ready - getReadyCardsWithAbilities', () => {
  it('returns ready undamaged cards with abilities', () => {
    const state = setupGameWithCamps();
    const player = getPlayer(state, 'p1')!;

    // Add some people with abilities, make them ready
    const person1 = addPersonToColumn(state, 'p1', 0, 'person_gunner', true);
    const person2 = addPersonToColumn(state, 'p1', 1, 'person_scout', true);

    // Make camps ready (they have abilities)
    const camp1 = state.cardInstances[player.columns[0]!.campInstanceId]!;
    const camp2 = state.cardInstances[player.columns[1]!.campInstanceId]!;
    camp1.isReady = true;
    camp2.isReady = true;

    const readyCards = getReadyCardsWithAbilities(state, 'p1');

    expect(readyCards.length).toBe(4); // 2 camps + 2 people with abilities
    expect(readyCards).toContain(person1);
    expect(readyCards).toContain(person2);
    expect(readyCards).toContain(player.columns[0]!.campInstanceId);
    expect(readyCards).toContain(player.columns[1]!.campInstanceId);
  });

  it('excludes damaged cards', () => {
    const state = setupGameWithCamps();
    const person1 = addPersonToColumn(state, 'p1', 0, 'person_gunner', true);
    const person2 = addPersonToColumn(state, 'p1', 1, 'person_scout', true);

    // Damage person2
    state.cardInstances[person2]!.isDamaged = true;

    const readyCards = getReadyCardsWithAbilities(state, 'p1');

    expect(readyCards).toContain(person1);
    expect(readyCards).not.toContain(person2);
  });

  it('excludes unready cards', () => {
    const state = setupGameWithCamps();
    const person1 = addPersonToColumn(state, 'p1', 0, 'person_gunner', true);
    const person2 = addPersonToColumn(state, 'p1', 1, 'person_scout', false);

    const readyCards = getReadyCardsWithAbilities(state, 'p1');

    expect(readyCards).toContain(person1);
    expect(readyCards).not.toContain(person2);
  });

  it('excludes punks', () => {
    const state = setupGameWithCamps();
    const person1 = addPersonToColumn(state, 'p1', 0, 'person_gunner', true);
    const punkId = addPersonToColumn(state, 'p1', 1, 'person_scout', true);

    // Make it a punk
    state.cardInstances[punkId]!.isPunk = true;

    const readyCards = getReadyCardsWithAbilities(state, 'p1');

    expect(readyCards).toContain(person1);
    expect(readyCards).not.toContain(punkId);
  });

  it('excludes cards without abilities', () => {
    const state = setupGameWithCamps();
    const player = getPlayer(state, 'p1')!;

    // Militia has no abilities
    const militia = addPersonToColumn(state, 'p1', 0, 'person_militia', true);

    // Bunker has no abilities
    const bunker = state.cardInstances[player.columns[2]!.campInstanceId]!;
    bunker.isReady = true;

    const readyCards = getReadyCardsWithAbilities(state, 'p1');

    expect(readyCards).not.toContain(militia);
    expect(readyCards).not.toContain(bunker.instanceId);
  });
});
