/**
 * Socket handler tests
 *
 * Tests WebSocket event handlers using mock sockets.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server as SocketServer } from 'socket.io';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { createServer, type Server as HttpServer } from 'http';
import { initDatabase, type GameDatabase } from '../src/db/database.js';
import { setupSocketHandlers } from '../src/socket/handlers.js';
import { createGame, type GameAction } from '@radlands/core';

describe('Socket Handlers', () => {
  let httpServer: HttpServer;
  let io: SocketServer;
  let db: GameDatabase;
  let clientSocket: ClientSocket;
  let serverPort: number;

  beforeEach(async () => {
    // Use in-memory database
    db = initDatabase(':memory:');

    // Create HTTP server
    httpServer = createServer();

    // Initialize Socket.io server
    io = new SocketServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // Setup handlers
    setupSocketHandlers(io, db);

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address !== 'string') {
          serverPort = address.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Cleanup
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    db.close();
  });

  const connectClient = async (): Promise<ClientSocket> => {
    return new Promise((resolve, reject) => {
      const socket = Client(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);

      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  };

  describe('Room joining', () => {
    it('should allow player to join a room with valid code', async () => {
      const game = db.createGame('test-id', 'ABC123');
      clientSocket = await connectClient();

      const joinedPromise = new Promise((resolve) => {
        clientSocket.on('room:joined', resolve);
      });

      clientSocket.emit('room:join', {
        roomCode: 'ABC123',
        playerName: 'Alice',
      });

      const joined = (await joinedPromise) as any;
      expect(joined.gameId).toBe(game.id);
      expect(joined.roomCode).toBe('ABC123');
      expect(joined.playerId).toBe('player1');
      expect(joined.playerSlot).toBe(1);
      expect(joined.playerName).toBe('Alice');
    });

    it('should assign player1 to first joiner', async () => {
      db.createGame('test-id', 'ABC123');
      clientSocket = await connectClient();

      const joined = await new Promise((resolve) => {
        clientSocket.on('room:joined', resolve);
        clientSocket.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      expect((joined as any).playerId).toBe('player1');
      expect((joined as any).playerSlot).toBe(1);
    });

    it('should assign player2 to second joiner', async () => {
      db.createGame('test-id', 'ABC123');

      // First client
      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      // Second client
      clientSocket = await connectClient();
      const joined = await new Promise((resolve) => {
        clientSocket.on('room:joined', resolve);
        clientSocket.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      expect((joined as any).playerId).toBe('player2');
      expect((joined as any).playerSlot).toBe(2);

      client1.disconnect();
    });

    it('should notify existing players when new player joins', async () => {
      db.createGame('test-id', 'ABC123');

      // First client
      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      // Setup listener for player joined event
      const playerJoinedPromise = new Promise((resolve) => {
        client1.on('room:player-joined', resolve);
      });

      // Second client joins
      clientSocket = await connectClient();
      await new Promise((resolve) => {
        clientSocket.on('room:joined', resolve);
        clientSocket.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      const playerJoined = (await playerJoinedPromise) as any;
      expect(playerJoined.playerId).toBe('player2');
      expect(playerJoined.playerSlot).toBe(2);
      expect(playerJoined.playerName).toBe('Bob');

      client1.disconnect();
    });

    it('should reject joining with invalid room code', async () => {
      clientSocket = await connectClient();

      const errorPromise = new Promise((resolve) => {
        clientSocket.on('room:error', resolve);
      });

      clientSocket.emit('room:join', {
        roomCode: 'INVALID',
        playerName: 'Alice',
      });

      const error = (await errorPromise) as any;
      expect(error.message).toBe('Room not found');
    });

    it('should reject joining when room is full', async () => {
      const game = db.createGame('test-id', 'ABC123');
      db.setPlayer(game.id, 1, 'player1', 'socket-1');
      db.setPlayer(game.id, 2, 'player2', 'socket-2');

      clientSocket = await connectClient();

      const errorPromise = new Promise((resolve) => {
        clientSocket.on('room:error', resolve);
      });

      clientSocket.emit('room:join', {
        roomCode: 'ABC123',
        playerName: 'Charlie',
      });

      const error = (await errorPromise) as any;
      expect(error.message).toBe('Room is full');
    });

    it('should reject joining ended game', async () => {
      const game = db.createGame('test-id', 'ABC123');
      db.updateStatus(game.id, 'ended');

      clientSocket = await connectClient();

      const errorPromise = new Promise((resolve) => {
        clientSocket.on('room:error', resolve);
      });

      clientSocket.emit('room:join', {
        roomCode: 'ABC123',
        playerName: 'Alice',
      });

      const error = (await errorPromise) as any;
      expect(error.message).toBe('Game has ended');
    });

    it('should require both room code and player name', async () => {
      clientSocket = await connectClient();

      const errorPromise = new Promise((resolve) => {
        clientSocket.on('room:error', resolve);
      });

      clientSocket.emit('room:join', {
        roomCode: '',
        playerName: 'Alice',
      });

      const error = (await errorPromise) as any;
      expect(error.message).toBe('Room code and player name required');
    });

    it('should be case-insensitive for room codes', async () => {
      db.createGame('test-id', 'ABC123');
      clientSocket = await connectClient();

      const joined = await new Promise((resolve) => {
        clientSocket.on('room:joined', resolve);
        clientSocket.emit('room:join', {
          roomCode: 'abc123',
          playerName: 'Alice',
        });
      });

      expect((joined as any).roomCode).toBe('ABC123');
    });
  });

  describe('Game starting', () => {
    it('should start game when both players are present', async () => {
      db.createGame('test-id', 'ABC123');

      // First player joins
      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      // Second player joins
      const client2 = await connectClient();
      await new Promise((resolve) => {
        client2.on('room:joined', resolve);
        client2.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      // Start game
      const startedPromise = new Promise((resolve) => {
        client1.on('game:started', resolve);
      });

      client1.emit('game:start');

      const started = (await startedPromise) as any;
      expect(started.state).toBeDefined();
      expect(started.state.players['player1']).toBeDefined();
      expect(started.state.players['player2']).toBeDefined();

      client1.disconnect();
      client2.disconnect();
    });

    it('should broadcast game start to all players', async () => {
      db.createGame('test-id', 'ABC123');

      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      const client2 = await connectClient();
      await new Promise((resolve) => {
        client2.on('room:joined', resolve);
        client2.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      const started1Promise = new Promise((resolve) => {
        client1.on('game:started', resolve);
      });
      const started2Promise = new Promise((resolve) => {
        client2.on('game:started', resolve);
      });

      client1.emit('game:start');

      const [started1, started2] = await Promise.all([
        started1Promise,
        started2Promise,
      ]);

      expect(started1).toEqual(started2);

      client1.disconnect();
      client2.disconnect();
    });

    it('should reject starting game without second player', async () => {
      db.createGame('test-id', 'ABC123');

      clientSocket = await connectClient();
      await new Promise((resolve) => {
        clientSocket.on('room:joined', resolve);
        clientSocket.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      const errorPromise = new Promise((resolve) => {
        clientSocket.on('room:error', resolve);
      });

      clientSocket.emit('game:start');

      const error = (await errorPromise) as any;
      expect(error.message).toBe('Waiting for second player');
    });

    it('should reject starting game twice', async () => {
      db.createGame('test-id', 'ABC123');

      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      const client2 = await connectClient();
      await new Promise((resolve) => {
        client2.on('room:joined', resolve);
        client2.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      await new Promise((resolve) => {
        client1.on('game:started', resolve);
        client1.emit('game:start');
      });

      const errorPromise = new Promise((resolve) => {
        client1.on('room:error', resolve);
      });

      client1.emit('game:start');

      const error = (await errorPromise) as any;
      expect(error.message).toBe('Game already started');

      client1.disconnect();
      client2.disconnect();
    });

    it('should update game status to playing in database', async () => {
      const game = db.createGame('test-id', 'ABC123');

      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      const client2 = await connectClient();
      await new Promise((resolve) => {
        client2.on('room:joined', resolve);
        client2.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      await new Promise((resolve) => {
        client1.on('game:started', resolve);
        client1.emit('game:start');
      });

      const updatedGame = db.getGame(game.id);
      expect(updatedGame?.status).toBe('playing');
      expect(updatedGame?.state).not.toBeNull();

      client1.disconnect();
      client2.disconnect();
    });
  });

  describe('Game actions', () => {
    it('should validate and apply valid actions', async () => {
      const game = db.createGame('test-id', 'ABC123');

      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      const client2 = await connectClient();
      await new Promise((resolve) => {
        client2.on('room:joined', resolve);
        client2.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      await new Promise((resolve) => {
        client1.on('game:started', resolve);
        client1.emit('game:start');
      });

      // Get initial state
      const dbGame = db.getGame(game.id);
      const initialState = dbGame?.state;
      expect(initialState).not.toBeNull();
      expect(initialState?.phase).toBe('draft');

      // Try a valid draft action (select camp)
      const stateUpdatePromise = new Promise((resolve) => {
        client1.on('game:state', resolve);
      });

      // Get available camps from initial state
      const player1State = initialState?.players['player1'];
      const availableCamp = player1State?.draftPool?.[0];
      expect(availableCamp).toBeDefined();

      const action: GameAction = {
        type: 'select_camp',
        playerId: 'player1',
        campId: availableCamp!,
      };
      client1.emit('game:action', { action });

      const stateUpdate = (await stateUpdatePromise) as any;
      expect(stateUpdate.state).toBeDefined();
      expect(stateUpdate.state.players['player1'].selectedCamps).toContain(availableCamp);

      client1.disconnect();
      client2.disconnect();
    });

    it('should broadcast state updates to all players', async () => {
      db.createGame('test-id', 'ABC123');

      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      const client2 = await connectClient();
      await new Promise((resolve) => {
        client2.on('room:joined', resolve);
        client2.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      const started = await new Promise((resolve) => {
        client1.on('game:started', resolve);
        client1.emit('game:start');
      });

      // Get a valid camp from the draft pool
      const initialState = (started as any).state;
      const player1State = initialState?.players['player1'];
      const availableCamp = player1State?.draftPool?.[0];

      const state1Promise = new Promise((resolve) => {
        client1.on('game:state', resolve);
      });
      const state2Promise = new Promise((resolve) => {
        client2.on('game:state', resolve);
      });

      const action: GameAction = {
        type: 'select_camp',
        playerId: 'player1',
        campId: availableCamp!,
      };
      client1.emit('game:action', { action });

      const [state1, state2] = await Promise.all([state1Promise, state2Promise]);
      expect(state1).toEqual(state2);

      client1.disconnect();
      client2.disconnect();
    });

    it('should reject invalid actions', async () => {
      db.createGame('test-id', 'ABC123');

      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      const client2 = await connectClient();
      await new Promise((resolve) => {
        client2.on('room:joined', resolve);
        client2.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      await new Promise((resolve) => {
        client1.on('game:started', resolve);
        client1.emit('game:start');
      });

      const errorPromise = new Promise((resolve) => {
        client1.on('game:action-error', resolve);
      });

      // Try an invalid action (wrong player)
      const action: GameAction = {
        type: 'end_turn',
        playerId: 'player2', // Wrong player!
      };
      client1.emit('game:action', { action });

      const error = (await errorPromise) as any;
      expect(error.message).toBe('Action player ID does not match');

      client1.disconnect();
      client2.disconnect();
    });

    it('should persist state updates to database', async () => {
      const game = db.createGame('test-id', 'ABC123');

      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      const client2 = await connectClient();
      await new Promise((resolve) => {
        client2.on('room:joined', resolve);
        client2.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      const started = await new Promise((resolve) => {
        client1.on('game:started', resolve);
        client1.emit('game:start');
      });

      // Get a valid camp from the draft pool
      const initialState = (started as any).state;
      const player1State = initialState?.players['player1'];
      const availableCamp = player1State?.draftPool?.[0];

      await new Promise((resolve) => {
        client1.on('game:state', resolve);
        const action: GameAction = {
          type: 'select_camp',
          playerId: 'player1',
          campId: availableCamp!,
        };
        client1.emit('game:action', { action });
      });

      const updatedGame = db.getGame(game.id);
      expect(updatedGame?.state).not.toBeNull();
      expect(updatedGame?.state?.players['player1'].selectedCamps).toContain(availableCamp);

      client1.disconnect();
      client2.disconnect();
    });
  });

  describe('Player disconnection', () => {
    it('should handle player disconnect', async () => {
      db.createGame('test-id', 'ABC123');

      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      const client2 = await connectClient();
      await new Promise((resolve) => {
        client2.on('room:joined', resolve);
        client2.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      const playerLeftPromise = new Promise((resolve) => {
        client2.on('room:player-left', resolve);
      });

      client1.disconnect();

      const playerLeft = (await playerLeftPromise) as any;
      expect(playerLeft.playerId).toBe('player1');
      expect(playerLeft.playerSlot).toBe(1);

      client2.disconnect();
    });

    it('should clear socket but keep player ID in database', async () => {
      const game = db.createGame('test-id', 'ABC123');

      clientSocket = await connectClient();
      await new Promise((resolve) => {
        clientSocket.on('room:joined', resolve);
        clientSocket.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      const beforeDisconnect = db.getGame(game.id);
      expect(beforeDisconnect?.player1Socket).not.toBeNull();

      clientSocket.disconnect();

      // Wait a bit for disconnect handler
      await new Promise((resolve) => setTimeout(resolve, 100));

      const afterDisconnect = db.getGame(game.id);
      expect(afterDisconnect?.player1Id).toBe('player1'); // ID preserved
      expect(afterDisconnect?.player1Socket).toBeNull(); // Socket cleared
    });

    it('should allow reconnection after disconnect', async () => {
      const game = db.createGame('test-id', 'ABC123');

      // First connection
      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      client1.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reconnect
      clientSocket = await connectClient();
      const reconnected = await new Promise((resolve) => {
        clientSocket.on('reconnect:success', resolve);
        clientSocket.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
          reconnectPlayerId: 'player1',
        });
      });

      expect((reconnected as any).gameId).toBe(game.id);
      expect((reconnected as any).playerId).toBe('player1');
    });
  });

  describe('Reconnection', () => {
    it('should restore game state on reconnection', async () => {
      const game = db.createGame('test-id', 'ABC123');

      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      const client2 = await connectClient();
      await new Promise((resolve) => {
        client2.on('room:joined', resolve);
        client2.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      // Start game
      await new Promise((resolve) => {
        client1.on('game:started', resolve);
        client1.emit('game:start');
      });

      // Disconnect client1
      client1.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reconnect
      clientSocket = await connectClient();
      const reconnected = await new Promise((resolve) => {
        clientSocket.on('reconnect:success', resolve);
        clientSocket.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
          reconnectPlayerId: 'player1',
        });
      });

      expect((reconnected as any).state).toBeDefined();
      expect((reconnected as any).state.players['player1']).toBeDefined();

      client2.disconnect();
    });

    it('should reject reconnection with wrong player ID', async () => {
      db.createGame('test-id', 'ABC123');

      clientSocket = await connectClient();
      const joined = await new Promise((resolve) => {
        clientSocket.on('room:joined', resolve);
        clientSocket.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
          reconnectPlayerId: 'player2', // Wrong ID
        });
      });

      // Should join as new player, not reconnect
      expect((joined as any).playerId).toBe('player1');
    });
  });

  describe('Room leaving', () => {
    it('should handle explicit room leave', async () => {
      db.createGame('test-id', 'ABC123');

      const client1 = await connectClient();
      await new Promise((resolve) => {
        client1.on('room:joined', resolve);
        client1.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Alice',
        });
      });

      const client2 = await connectClient();
      await new Promise((resolve) => {
        client2.on('room:joined', resolve);
        client2.emit('room:join', {
          roomCode: 'ABC123',
          playerName: 'Bob',
        });
      });

      const playerLeftPromise = new Promise((resolve) => {
        client2.on('room:player-left', resolve);
      });

      client1.emit('room:leave');

      const playerLeft = (await playerLeftPromise) as any;
      expect(playerLeft.playerId).toBe('player1');
      expect(playerLeft.playerSlot).toBe(1);

      client1.disconnect();
      client2.disconnect();
    });
  });
});
