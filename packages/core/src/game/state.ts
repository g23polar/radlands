/**
 * Game state creation and helpers
 */

import type {
  GameState,
  PlayerState,
  PlayerId,
  Column,
  EventQueueSlot,
} from '../types/game.js';
import type { CardId, CardInstance, CardInstanceId } from '../types/card.js';
import { buildDrawDeck, buildCampPool, getCard } from '../cards/index.js';

/** Generate a unique instance ID */
export function generateInstanceId(): CardInstanceId {
  return `inst_${Math.random().toString(36).substring(2, 11)}`;
}

/** Generate a unique game ID */
export function generateGameId(): string {
  return `game_${Math.random().toString(36).substring(2, 11)}`;
}

/** Create a seeded random number generator */
export function createRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Shuffle an array using Fisher-Yates with a seeded RNG */
export function shuffle<T>(array: T[], rng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Create an empty column */
function createEmptyColumn(campInstanceId: CardInstanceId): Column {
  return {
    campInstanceId,
    personInstanceIds: [],
  };
}

/** Create an empty event queue slot */
function createEmptyQueueSlot(): EventQueueSlot {
  return { eventInstanceId: null };
}

/** Create a card instance */
export function createCardInstance(
  cardId: CardId,
  ownerId: PlayerId,
  options?: Partial<CardInstance>
): CardInstance {
  return {
    instanceId: generateInstanceId(),
    cardId,
    ownerId,
    isDamaged: false,
    isReady: false, // Cards are not ready when first created
    isPunk: false,
    ...options,
  };
}

/** Create initial player state */
function createPlayerState(
  playerId: PlayerId,
  playerName: string
): PlayerState {
  return {
    id: playerId,
    name: playerName,
    water: 3,
    columns: [
      createEmptyColumn(''), // Will be set during camp placement
      createEmptyColumn(''),
      createEmptyColumn(''),
    ],
    hand: [],
    eventQueue: [
      createEmptyQueueSlot(),
      createEmptyQueueSlot(),
      createEmptyQueueSlot(),
    ],
    deck: [],
    discard: [],
  };
}

/** Options for creating a new game */
export interface CreateGameOptions {
  player1Id: PlayerId;
  player1Name: string;
  player2Id: PlayerId;
  player2Name: string;
  seed?: number;
}

/** Create a new game in draft phase */
export function createGame(options: CreateGameOptions): GameState {
  const seed = options.seed ?? Math.floor(Math.random() * 1000000);
  const rng = createRng(seed);

  // Create card instances map
  const cardInstances: Record<CardInstanceId, CardInstance> = {};

  // Create player states
  const player1 = createPlayerState(options.player1Id, options.player1Name);
  const player2 = createPlayerState(options.player2Id, options.player2Name);

  // Build and shuffle the shared draw deck
  const drawDeckCardIds = shuffle(buildDrawDeck(), rng);

  // Create instances for draw deck cards and split between players
  const halfDeck = Math.floor(drawDeckCardIds.length / 2);

  for (let i = 0; i < drawDeckCardIds.length; i++) {
    const cardId = drawDeckCardIds[i]!;
    const ownerId = i < halfDeck ? options.player1Id : options.player2Id;
    const instance = createCardInstance(cardId, ownerId);
    cardInstances[instance.instanceId] = instance;

    if (i < halfDeck) {
      player1.deck.push(instance.instanceId);
    } else {
      player2.deck.push(instance.instanceId);
    }
  }

  // Set up camp draft pools (each player gets 6 random camps to choose from)
  const allCamps = shuffle(buildCampPool(), rng);
  player1.draftPool = allCamps.slice(0, 6);
  player2.draftPool = allCamps.slice(6, 12);
  player1.selectedCamps = [];
  player2.selectedCamps = [];

  // Randomly determine first player
  const playerOrder: [PlayerId, PlayerId] =
    rng() < 0.5
      ? [options.player1Id, options.player2Id]
      : [options.player2Id, options.player1Id];

  return {
    id: generateGameId(),
    phase: 'draft',
    turnPhase: 'actions', // Not relevant during draft
    currentTurn: 0,
    activePlayerId: playerOrder[0],
    players: {
      [options.player1Id]: player1,
      [options.player2Id]: player2,
    },
    playerOrder,
    cardInstances,
    seed,
    history: [],
  };
}

/** Get the opponent of a player */
export function getOpponentId(state: GameState, playerId: PlayerId): PlayerId {
  const [p1, p2] = state.playerOrder;
  return playerId === p1 ? p2 : p1;
}

/** Get a player state */
export function getPlayer(
  state: GameState,
  playerId: PlayerId
): PlayerState | undefined {
  return state.players[playerId];
}

/** Get a card instance */
export function getCardInstance(
  state: GameState,
  instanceId: CardInstanceId
): CardInstance | undefined {
  return state.cardInstances[instanceId];
}

/** Get the card definition for an instance */
export function getCardForInstance(
  state: GameState,
  instanceId: CardInstanceId
) {
  const instance = getCardInstance(state, instanceId);
  if (!instance) return undefined;
  return getCard(instance.cardId);
}

/** Check if a player has lost (all camps destroyed) */
export function hasPlayerLost(state: GameState, playerId: PlayerId): boolean {
  const player = getPlayer(state, playerId);
  if (!player) return false;

  // Check if all camps are destroyed (not present in any column)
  return player.columns.every((col) => {
    const camp = getCardInstance(state, col.campInstanceId);
    return !camp; // Camp instance removed = destroyed
  });
}

/** Check if the game is over */
export function isGameOver(state: GameState): boolean {
  return state.phase === 'ended';
}

/** Get the winner ID if game is over */
export function getWinner(state: GameState): PlayerId | undefined {
  return state.winnerId;
}

/** Clone game state (deep copy) */
export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}
