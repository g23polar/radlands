/**
 * Socket.io event handlers for multiplayer game
 *
 * Server-authoritative: validates all actions using core game logic.
 * Broadcasts state updates to all players in a room.
 */

import type { Server, Socket } from 'socket.io';
import {
  type GameState,
  type GameAction,
  type PlayerId,
  type GameEvent,
  createGame,
  applyAction,
  validateAction,
} from '@radlands/core';
import type { GameDatabase, DbGame } from '../db/database.js';

// Active games in memory (for fast access during gameplay)
const activeGames = new Map<string, GameState>();

// Track which game each socket is in
const socketToGame = new Map<string, { gameId: string; playerId: PlayerId }>();

/**
 * Socket events emitted by server
 */
export interface ServerEvents {
  // Room events
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

  // Game events
  'game:state': (data: { state: GameState; events?: GameEvent[] }) => void;
  'game:action-error': (data: { message: string; action: GameAction }) => void;
  'game:started': (data: { state: GameState }) => void;
  'game:ended': (data: { winnerId: PlayerId; reason: string }) => void;

  // Connection events
  'reconnect:success': (data: {
    gameId: string;
    playerId: PlayerId;
    state: GameState;
  }) => void;
}

/**
 * Socket events received from client
 */
export interface ClientEvents {
  // Room events
  'room:join': (data: {
    roomCode: string;
    playerName: string;
    reconnectPlayerId?: PlayerId;
  }) => void;
  'room:leave': () => void;

  // Game events
  'game:action': (data: { action: GameAction }) => void;
  'game:start': () => void;
}

export function setupSocketHandlers(io: Server, db: GameDatabase): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    /**
     * Handle joining a room
     */
    socket.on('room:join', (data: { roomCode: string; playerName: string; reconnectPlayerId?: string }) => {
      const { roomCode, playerName, reconnectPlayerId } = data;

      if (!roomCode || !playerName) {
        socket.emit('room:error', { message: 'Room code and player name required' });
        return;
      }

      const game = db.getGameByRoomCode(roomCode.toUpperCase());
      if (!game) {
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }

      if (game.status === 'ended' || game.status === 'abandoned') {
        socket.emit('room:error', { message: 'Game has ended' });
        return;
      }

      // Handle reconnection
      if (reconnectPlayerId) {
        const reconnected = handleReconnection(socket, game, reconnectPlayerId, db);
        if (reconnected) return;
      }

      // Determine player slot
      let playerSlot: 1 | 2;
      let playerId: PlayerId;

      if (!game.player1Id) {
        playerSlot = 1;
        playerId = 'player1';
      } else if (!game.player2Id) {
        playerSlot = 2;
        playerId = 'player2';
      } else {
        // Room is full - check if this is a reconnection attempt
        socket.emit('room:error', { message: 'Room is full' });
        return;
      }

      // Register player in database
      db.setPlayer(game.id, playerSlot, playerId, socket.id);

      // Join socket room
      socket.join(game.roomCode);

      // Track socket -> game mapping
      socketToGame.set(socket.id, { gameId: game.id, playerId });

      // Notify the joining player
      socket.emit('room:joined', {
        gameId: game.id,
        roomCode: game.roomCode,
        playerId,
        playerSlot,
        playerName,
      });

      // Notify other players in the room
      socket.to(game.roomCode).emit('room:player-joined', {
        playerId,
        playerSlot,
        playerName,
      });

      // If both players are now connected, we can start the game
      const updatedGame = db.getGame(game.id);
      if (updatedGame?.player1Id && updatedGame?.player2Id && !updatedGame.state) {
        // Both players present and game not started - ready to start
        console.log(`Room ${game.roomCode} has both players, ready to start`);
      }

      // If game already has state (reconnection scenario), send it
      if (game.state) {
        socket.emit('game:state', { state: game.state });
      }
    });

    /**
     * Handle starting the game
     */
    socket.on('game:start', () => {
      const mapping = socketToGame.get(socket.id);
      if (!mapping) {
        socket.emit('room:error', { message: 'Not in a room' });
        return;
      }

      const game = db.getGame(mapping.gameId);
      if (!game) {
        socket.emit('room:error', { message: 'Game not found' });
        return;
      }

      if (game.state) {
        socket.emit('room:error', { message: 'Game already started' });
        return;
      }

      if (!game.player1Id || !game.player2Id) {
        socket.emit('room:error', { message: 'Waiting for second player' });
        return;
      }

      // Create new game state
      const gameState = createGame({
        player1Id: 'player1',
        player1Name: 'Player 1', // Could store names in DB
        player2Id: 'player2',
        player2Name: 'Player 2',
      });

      // Store in database and memory
      db.updateGameState(game.id, gameState);
      db.updateStatus(game.id, 'playing');
      activeGames.set(game.id, gameState);

      // Broadcast to all players in room
      io.to(game.roomCode).emit('game:started', { state: gameState });
    });

    /**
     * Handle game actions
     */
    socket.on('game:action', (data: { action: GameAction }) => {
      const { action } = data;

      const mapping = socketToGame.get(socket.id);
      if (!mapping) {
        socket.emit('game:action-error', { message: 'Not in a game', action });
        return;
      }

      const { gameId, playerId } = mapping;

      // Get current state (prefer memory, fallback to DB)
      let state = activeGames.get(gameId);
      if (!state) {
        const game = db.getGame(gameId);
        if (!game?.state) {
          socket.emit('game:action-error', { message: 'Game not found', action });
          return;
        }
        state = game.state;
        activeGames.set(gameId, state);
      }

      // Verify it's this player's turn (for most actions)
      if (action.playerId !== playerId) {
        socket.emit('game:action-error', {
          message: 'Action player ID does not match',
          action,
        });
        return;
      }

      // Validate action
      const validation = validateAction(state, action);
      if (!validation.valid) {
        socket.emit('game:action-error', {
          message: validation.error ?? 'Invalid action',
          action,
        });
        return;
      }

      // Apply action
      const result = applyAction(state, action);
      if (!result.success || !result.newState) {
        socket.emit('game:action-error', {
          message: result.error ?? 'Failed to apply action',
          action,
        });
        return;
      }

      // Update state
      const newState = result.newState;
      activeGames.set(gameId, newState);
      db.updateGameState(gameId, newState);

      // Get room code for broadcasting
      const game = db.getGame(gameId);
      if (!game) return;

      // Broadcast new state to all players with events
      io.to(game.roomCode).emit('game:state', {
        state: newState,
        events: result.events || []
      });

      // Check for game end
      if (newState.phase === 'ended' && newState.winnerId) {
        db.updateStatus(gameId, 'ended');
        io.to(game.roomCode).emit('game:ended', {
          winnerId: newState.winnerId,
          reason: newState.endReason ?? 'unknown',
        });
      }
    });

    /**
     * Handle leaving a room
     */
    socket.on('room:leave', () => {
      handleDisconnect(socket, db, io);
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      handleDisconnect(socket, db, io);
    });
  });

  // Periodic cleanup of stale games
  setInterval(() => {
    const abandoned = db.markStaleGamesAbandoned();
    const cleaned = db.cleanupOldGames();
    if (abandoned > 0 || cleaned > 0) {
      console.log(`Cleanup: ${abandoned} games marked abandoned, ${cleaned} old games deleted`);
    }
  }, 60000); // Every minute
}

/**
 * Handle reconnection to an existing game
 */
function handleReconnection(
  socket: Socket,
  game: DbGame,
  playerId: PlayerId,
  db: GameDatabase
): boolean {
  // Check if this player was in the game
  const isPlayer1 = game.player1Id === playerId;
  const isPlayer2 = game.player2Id === playerId;

  if (!isPlayer1 && !isPlayer2) {
    return false; // Not a valid reconnection
  }

  const playerSlot = isPlayer1 ? 1 : 2;

  // Update socket ID in database
  db.updatePlayerSocket(game.id, playerSlot, socket.id);

  // Join socket room
  socket.join(game.roomCode);

  // Track socket -> game mapping
  socketToGame.set(socket.id, { gameId: game.id, playerId });

  // Get current state
  const state = activeGames.get(game.id) ?? game.state;

  if (state) {
    socket.emit('reconnect:success', {
      gameId: game.id,
      playerId,
      state,
    });
  }

  // Notify other players
  socket.to(game.roomCode).emit('room:player-joined', {
    playerId,
    playerSlot,
    playerName: `Player ${playerSlot}`,
  });

  return true;
}

/**
 * Handle player disconnect
 */
function handleDisconnect(socket: Socket, db: GameDatabase, _io: Server): void {
  const mapping = socketToGame.get(socket.id);
  if (!mapping) return;

  const { gameId, playerId } = mapping;
  const game = db.getGame(gameId);

  if (game) {
    const playerSlot = game.player1Id === playerId ? 1 : 2;

    // Clear socket but keep player ID (allows reconnection)
    db.clearPlayerSocket(gameId, playerSlot);

    // Notify other players
    socket.to(game.roomCode).emit('room:player-left', {
      playerId,
      playerSlot,
    });

    // Leave socket room
    socket.leave(game.roomCode);
  }

  // Clean up mapping
  socketToGame.delete(socket.id);
}
