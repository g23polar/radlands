/**
 * Socket.io client service for multiplayer
 *
 * Manages connection to the game server and provides
 * methods for room management and game actions.
 */

import { io, Socket } from 'socket.io-client';
import type { GameState, GameAction, PlayerId } from '@radlands/core';

// In production, connect to same origin. In dev, use localhost:3001
const SERVER_URL = import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

/**
 * Events emitted by server
 */
interface ServerToClientEvents {
  'room:joined': (data: {
    gameId: string;
    roomCode: string;
    playerId: PlayerId;
    playerSlot: 1 | 2;
    playerName: string;
  }) => void;
  'room:player-joined': (data: {
    playerId: PlayerId;
    playerSlot: 1 | 2;
    playerName: string;
  }) => void;
  'room:player-left': (data: { playerId: PlayerId; playerSlot: 1 | 2 }) => void;
  'room:error': (data: { message: string }) => void;
  'game:state': (data: { state: GameState }) => void;
  'game:action-error': (data: { message: string; action: GameAction }) => void;
  'game:started': (data: { state: GameState }) => void;
  'game:ended': (data: { winnerId: PlayerId; reason: string }) => void;
  'reconnect:success': (data: {
    gameId: string;
    playerId: PlayerId;
    state: GameState;
  }) => void;
}

/**
 * Events emitted by client
 */
interface ClientToServerEvents {
  'room:join': (data: {
    roomCode: string;
    playerName: string;
    reconnectPlayerId?: PlayerId;
  }) => void;
  'room:leave': () => void;
  'game:action': (data: { action: GameAction }) => void;
  'game:start': () => void;
}

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

/**
 * Get or create the socket connection
 */
export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

/**
 * Connect to the server
 */
export function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();

    if (s.connected) {
      resolve();
      return;
    }

    const onConnect = () => {
      s.off('connect', onConnect);
      s.off('connect_error', onError);
      resolve();
    };

    const onError = (err: Error) => {
      s.off('connect', onConnect);
      s.off('connect_error', onError);
      reject(err);
    };

    s.on('connect', onConnect);
    s.on('connect_error', onError);
    s.connect();
  });
}

/**
 * Disconnect from the server
 */
export function disconnect(): void {
  if (socket) {
    socket.disconnect();
  }
}

/**
 * Join a room with the given code
 */
export function joinRoom(
  roomCode: string,
  playerName: string,
  reconnectPlayerId?: PlayerId
): void {
  const s = getSocket();
  s.emit('room:join', { roomCode, playerName, reconnectPlayerId });
}

/**
 * Leave the current room
 */
export function leaveRoom(): void {
  const s = getSocket();
  s.emit('room:leave');
}

/**
 * Request to start the game
 */
export function startGame(): void {
  const s = getSocket();
  s.emit('game:start');
}

/**
 * Send a game action
 */
export function sendAction(action: GameAction): void {
  const s = getSocket();
  s.emit('game:action', { action });
}

/**
 * Create a new room via REST API
 */
export async function createRoom(): Promise<{ gameId: string; roomCode: string }> {
  const response = await fetch(`${SERVER_URL}/api/lobby/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? 'Failed to create room');
  }

  return response.json();
}

/**
 * Check if a room exists and has space
 */
export async function checkRoom(roomCode: string): Promise<{
  gameId: string;
  roomCode: string;
  status: string;
  hasSpace: boolean;
  playerCount: number;
}> {
  const response = await fetch(`${SERVER_URL}/api/lobby/join/${roomCode}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? 'Failed to check room');
  }

  return response.json();
}

/**
 * Storage keys for reconnection
 */
const STORAGE_KEYS = {
  GAME_ID: 'radlands_game_id',
  ROOM_CODE: 'radlands_room_code',
  PLAYER_ID: 'radlands_player_id',
};

/**
 * Save game session for reconnection
 */
export function saveSession(gameId: string, roomCode: string, playerId: PlayerId): void {
  localStorage.setItem(STORAGE_KEYS.GAME_ID, gameId);
  localStorage.setItem(STORAGE_KEYS.ROOM_CODE, roomCode);
  localStorage.setItem(STORAGE_KEYS.PLAYER_ID, playerId);
}

/**
 * Load saved game session
 */
export function loadSession(): {
  gameId: string;
  roomCode: string;
  playerId: PlayerId;
} | null {
  const gameId = localStorage.getItem(STORAGE_KEYS.GAME_ID);
  const roomCode = localStorage.getItem(STORAGE_KEYS.ROOM_CODE);
  const playerId = localStorage.getItem(STORAGE_KEYS.PLAYER_ID);

  if (gameId && roomCode && playerId) {
    return { gameId, roomCode, playerId };
  }
  return null;
}

/**
 * Clear saved session
 */
export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.GAME_ID);
  localStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
  localStorage.removeItem(STORAGE_KEYS.PLAYER_ID);
}
