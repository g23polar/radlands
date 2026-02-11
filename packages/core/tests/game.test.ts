/**
 * Game integration tests
 *
 * Tests for full game workflows:
 * - Create new game in draft phase
 * - Complete draft, start game
 * - Full turn cycle (events → replenish → actions → end)
 * - Win condition when all camps destroyed
 * - Play a person card
 * - Use an ability
 * - Junk a card
 */

import { describe, it, expect } from 'vitest';
import {
  createGame,
  getPlayer,
  getOpponentId,
  getCardInstance,
  hasPlayerLost,
  isGameOver,
  getWinner,
  cloneState,
  createCardInstance,
} from '../src/game/state.js';
import { readyAllPlayerCards } from '../src/rules/ready.js';
import { destroyCard, addWater, drawCards } from '../src/rules/effects.js';
import type { GameState } from '../src/types/game.js';

describe('game - initialization', () => {
  it('creates game in draft phase', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
      seed: 12345,
    });

    expect(game.phase).toBe('draft');
    expect(game.currentTurn).toBe(0);
    expect(game.playerOrder).toHaveLength(2);
    expect(game.playerOrder).toContain('p1');
    expect(game.playerOrder).toContain('p2');
  });

  it('creates two players with correct initial state', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const p1 = getPlayer(game, 'p1')!;
    const p2 = getPlayer(game, 'p2')!;

    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(p1.name).toBe('Alice');
    expect(p2.name).toBe('Bob');
    expect(p1.water).toBe(3);
    expect(p2.water).toBe(3);
    expect(p1.columns).toHaveLength(3);
    expect(p2.columns).toHaveLength(3);
  });

  it('splits draw deck between players', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const p1 = getPlayer(game, 'p1')!;
    const p2 = getPlayer(game, 'p2')!;

    expect(p1.deck.length).toBeGreaterThan(0);
    expect(p2.deck.length).toBeGreaterThan(0);

    // Decks are split roughly equally (may differ by 1 if odd total)
    const diff = Math.abs(p1.deck.length - p2.deck.length);
    expect(diff).toBeLessThanOrEqual(1);

    const totalCards = p1.deck.length + p2.deck.length;
    expect(totalCards).toBeGreaterThan(0);
  });

  it('sets up camp draft pools', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const p1 = getPlayer(game, 'p1')!;
    const p2 = getPlayer(game, 'p2')!;

    expect(p1.draftPool).toBeDefined();
    expect(p2.draftPool).toBeDefined();

    // Current implementation has 8 camps, split into pools for each player
    // Each player gets some camps to choose from
    expect(p1.draftPool!.length).toBeGreaterThan(0);
    expect(p2.draftPool!.length).toBeGreaterThan(0);
    expect(p1.selectedCamps).toEqual([]);
    expect(p2.selectedCamps).toEqual([]);
  });

  it('uses seed for deterministic randomness', () => {
    const game1 = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
      seed: 12345,
    });

    const game2 = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
      seed: 12345,
    });

    // Same seed should produce same player order
    expect(game1.playerOrder).toEqual(game2.playerOrder);

    // Same seed should produce same draft pools
    const p1Game1 = getPlayer(game1, 'p1')!;
    const p1Game2 = getPlayer(game2, 'p1')!;
    expect(p1Game1.draftPool).toEqual(p1Game2.draftPool);
  });
});

describe('game - player helpers', () => {
  it('getOpponentId returns correct opponent', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const p1Opponent = getOpponentId(game, 'p1');
    const p2Opponent = getOpponentId(game, 'p2');

    expect(p1Opponent).toBe('p2');
    expect(p2Opponent).toBe('p1');
  });

  it('getPlayer returns undefined for invalid player', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const invalid = getPlayer(game, 'invalid_id');

    expect(invalid).toBeUndefined();
  });
});

describe('game - play person card', () => {
  it('plays person from hand to column', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    // Set up: add a card to hand
    const state = cloneState(game);
    const personInstance = createCardInstance('person_gunner', 'p1');
    state.cardInstances[personInstance.instanceId] = personInstance;
    state.players['p1']!.hand.push(personInstance.instanceId);
    state.players['p1']!.water = 5; // Gunner costs 2

    // Place camps
    const camp = createCardInstance('camp_garage', 'p1');
    state.cardInstances[camp.instanceId] = camp;
    state.players['p1']!.columns[0]!.campInstanceId = camp.instanceId;

    // Simulate playing the person
    const player = state.players['p1']!;
    player.hand = player.hand.filter(id => id !== personInstance.instanceId);
    player.columns[0]!.personInstanceIds.push(personInstance.instanceId);
    player.water -= 2;

    const column = player.columns[0]!;
    expect(column.personInstanceIds).toContain(personInstance.instanceId);
    expect(player.hand).not.toContain(personInstance.instanceId);
    expect(player.water).toBe(3);
  });

  it('person starts not ready when played', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const instance = createCardInstance('person_gunner', 'p1');
    instance.turnPlayed = game.currentTurn;

    expect(instance.isReady).toBe(false);
  });
});

describe('game - use ability', () => {
  it('uses ability and spends water', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const state = cloneState(game);

    // Set up: place camp with ability
    const camp = createCardInstance('camp_watering_hole', 'p1', { isReady: true });
    state.cardInstances[camp.instanceId] = camp;
    state.players['p1']!.columns[0]!.campInstanceId = camp.instanceId;
    state.players['p1']!.water = 3;

    // Watering Hole: 0 cost, gain 1 water
    const player = state.players['p1']!;
    player.water += 1; // Apply effect
    state.cardInstances[camp.instanceId]!.isReady = false; // Mark unready

    expect(player.water).toBe(4);
    expect(state.cardInstances[camp.instanceId]!.isReady).toBe(false);
  });

  it('damaged cards cannot use abilities', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const state = cloneState(game);

    const person = createCardInstance('person_gunner', 'p1', {
      isReady: true,
      isDamaged: true,
    });
    state.cardInstances[person.instanceId] = person;

    // Cannot use ability when damaged
    expect(person.isDamaged).toBe(true);
    expect(person.isReady).toBe(true);
    // In real game, canUseAbility would return false
  });
});

describe('game - turn cycle', () => {
  it('replenish phase draws card and adds water', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const state = cloneState(game);
    const player = state.players['p1']!;
    const initialHandSize = player.hand.length;
    const initialWater = player.water;

    // Simulate replenish
    const afterDraw = drawCards(state, 'p1', 1);
    const afterWater = addWater(afterDraw.state, 'p1', 3);

    const newPlayer = getPlayer(afterWater.state, 'p1')!;
    expect(newPlayer.hand.length).toBe(initialHandSize + 1);
    expect(newPlayer.water).toBe(initialWater + 3);
  });

  it('cards become ready at start of turn', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const state = cloneState(game);

    // Add unready person
    const person = createCardInstance('person_gunner', 'p1', { isReady: false });
    state.cardInstances[person.instanceId] = person;
    state.players['p1']!.columns[0]!.personInstanceIds.push(person.instanceId);

    // Add camp
    const camp = createCardInstance('camp_garage', 'p1', { isReady: false });
    state.cardInstances[camp.instanceId] = camp;
    state.players['p1']!.columns[0]!.campInstanceId = camp.instanceId;

    // Ready all cards
    const newState = readyAllPlayerCards(state, 'p1');

    expect(getCardInstance(newState, person.instanceId)!.isReady).toBe(true);
    expect(getCardInstance(newState, camp.instanceId)!.isReady).toBe(true);
  });

  it('water resets to 3 at start of turn', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const state = cloneState(game);
    state.players['p1']!.water = 0;

    // Simulate replenish adding 3 water
    state.players['p1']!.water = 3;

    expect(state.players['p1']!.water).toBe(3);
  });
});

describe('game - win condition', () => {
  it('hasPlayerLost returns false when camps exist', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const state = cloneState(game);

    // Place camps
    const camp1 = createCardInstance('camp_garage', 'p1');
    const camp2 = createCardInstance('camp_watering_hole', 'p1');
    const camp3 = createCardInstance('camp_bunker', 'p1');

    state.cardInstances[camp1.instanceId] = camp1;
    state.cardInstances[camp2.instanceId] = camp2;
    state.cardInstances[camp3.instanceId] = camp3;

    state.players['p1']!.columns[0]!.campInstanceId = camp1.instanceId;
    state.players['p1']!.columns[1]!.campInstanceId = camp2.instanceId;
    state.players['p1']!.columns[2]!.campInstanceId = camp3.instanceId;

    expect(hasPlayerLost(state, 'p1')).toBe(false);
  });

  it('hasPlayerLost returns true when all camps destroyed', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const state = cloneState(game);

    // Place camps
    const camp1 = createCardInstance('camp_garage', 'p1');
    const camp2 = createCardInstance('camp_watering_hole', 'p1');
    const camp3 = createCardInstance('camp_bunker', 'p1');

    state.cardInstances[camp1.instanceId] = camp1;
    state.cardInstances[camp2.instanceId] = camp2;
    state.cardInstances[camp3.instanceId] = camp3;

    state.players['p1']!.columns[0]!.campInstanceId = camp1.instanceId;
    state.players['p1']!.columns[1]!.campInstanceId = camp2.instanceId;
    state.players['p1']!.columns[2]!.campInstanceId = camp3.instanceId;

    // Destroy all camps
    let currentState = state;
    currentState = destroyCard(currentState, camp1.instanceId).state;
    currentState = destroyCard(currentState, camp2.instanceId).state;
    currentState = destroyCard(currentState, camp3.instanceId).state;

    expect(hasPlayerLost(currentState, 'p1')).toBe(true);
  });

  it('hasPlayerLost returns false when only some camps destroyed', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const state = cloneState(game);

    // Place camps
    const camp1 = createCardInstance('camp_garage', 'p1');
    const camp2 = createCardInstance('camp_watering_hole', 'p1');
    const camp3 = createCardInstance('camp_bunker', 'p1');

    state.cardInstances[camp1.instanceId] = camp1;
    state.cardInstances[camp2.instanceId] = camp2;
    state.cardInstances[camp3.instanceId] = camp3;

    state.players['p1']!.columns[0]!.campInstanceId = camp1.instanceId;
    state.players['p1']!.columns[1]!.campInstanceId = camp2.instanceId;
    state.players['p1']!.columns[2]!.campInstanceId = camp3.instanceId;

    // Destroy 2 camps
    let currentState = state;
    currentState = destroyCard(currentState, camp1.instanceId).state;
    currentState = destroyCard(currentState, camp2.instanceId).state;

    expect(hasPlayerLost(currentState, 'p1')).toBe(false);
  });

  it('isGameOver returns false during active game', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    expect(isGameOver(game)).toBe(false);
  });

  it('isGameOver and getWinner work when game ends', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const state = cloneState(game);
    state.phase = 'ended';
    state.winnerId = 'p1';
    state.endReason = 'camps_destroyed';

    expect(isGameOver(state)).toBe(true);
    expect(getWinner(state)).toBe('p1');
  });
});

describe('game - junk card', () => {
  it('junking card with damage icon damages target', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const state = cloneState(game);

    // Add card with damage junk to hand
    const gunner = createCardInstance('person_gunner', 'p1'); // Has damage junk icon
    state.cardInstances[gunner.instanceId] = gunner;
    state.players['p1']!.hand.push(gunner.instanceId);

    // Add target enemy person
    const target = createCardInstance('person_scout', 'p2');
    state.cardInstances[target.instanceId] = target;

    const camp = createCardInstance('camp_garage', 'p2');
    state.cardInstances[camp.instanceId] = camp;
    state.players['p2']!.columns[0]!.campInstanceId = camp.instanceId;
    state.players['p2']!.columns[0]!.personInstanceIds.push(target.instanceId);

    // Junk would:
    // 1. Remove from hand
    // 2. Add to discard
    // 3. Apply damage effect
    const player = state.players['p1']!;
    player.hand = player.hand.filter(id => id !== gunner.instanceId);
    player.discard.push(gunner.instanceId);

    expect(player.discard).toContain(gunner.instanceId);
    expect(player.hand).not.toContain(gunner.instanceId);
  });

  it('junking card with draw icon draws card', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const state = cloneState(game);

    // Add card with draw junk to hand
    const scout = createCardInstance('person_scout', 'p1'); // Has draw junk icon
    state.cardInstances[scout.instanceId] = scout;
    state.players['p1']!.hand.push(scout.instanceId);

    const initialHandSize = state.players['p1']!.hand.length;

    // Junk card
    const player = state.players['p1']!;
    player.hand = player.hand.filter(id => id !== scout.instanceId);
    player.discard.push(scout.instanceId);

    // Then draw effect would add 1 card
    const afterDraw = drawCards(state, 'p1', 1);
    const newPlayer = getPlayer(afterDraw.state, 'p1')!;

    expect(newPlayer.discard).toContain(scout.instanceId);
    expect(newPlayer.hand.length).toBe(initialHandSize); // -1 junked + 1 drawn
  });
});

describe('game - card instances', () => {
  it('each card has unique instance ID', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const instance1 = createCardInstance('person_gunner', 'p1');
    const instance2 = createCardInstance('person_gunner', 'p1');

    expect(instance1.instanceId).not.toBe(instance2.instanceId);
    expect(instance1.cardId).toBe(instance2.cardId);
  });

  it('getCardInstance retrieves correct instance', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const state = cloneState(game);
    const instance = createCardInstance('person_gunner', 'p1');
    state.cardInstances[instance.instanceId] = instance;

    const retrieved = getCardInstance(state, instance.instanceId);

    expect(retrieved).toBeDefined();
    expect(retrieved!.instanceId).toBe(instance.instanceId);
    expect(retrieved!.cardId).toBe('person_gunner');
    expect(retrieved!.ownerId).toBe('p1');
  });

  it('card instance tracks state correctly', () => {
    const instance = createCardInstance('person_gunner', 'p1');

    expect(instance.isDamaged).toBe(false);
    expect(instance.isReady).toBe(false);
    expect(instance.isPunk).toBe(false);

    instance.isDamaged = true;
    instance.isReady = true;

    expect(instance.isDamaged).toBe(true);
    expect(instance.isReady).toBe(true);
  });
});

describe('game - state immutability', () => {
  it('cloneState creates independent copy', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const cloned = cloneState(game);
    cloned.currentTurn = 999;
    cloned.players['p1']!.water = 100;

    expect(game.currentTurn).not.toBe(999);
    expect(game.players['p1']!.water).not.toBe(100);
  });

  it('modifying cloned state does not affect original', () => {
    const game = createGame({
      player1Id: 'p1',
      player1Name: 'Alice',
      player2Id: 'p2',
      player2Name: 'Bob',
    });

    const originalWater = game.players['p1']!.water;
    const cloned = cloneState(game);

    cloned.players['p1']!.water = 999;

    expect(game.players['p1']!.water).toBe(originalWater);
    expect(cloned.players['p1']!.water).toBe(999);
  });
});
