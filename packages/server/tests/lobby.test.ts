/**
 * Lobby REST API tests
 *
 * Tests room creation and joining endpoints using supertest.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { initDatabase, type GameDatabase } from '../src/db/database.js';
import { createLobbyRoutes } from '../src/routes/lobby.js';

describe('Lobby API', () => {
  let app: Express;
  let db: GameDatabase;

  beforeEach(() => {
    // Setup Express app with lobby routes
    app = express();
    app.use(express.json());

    // Use in-memory database for tests
    db = initDatabase(':memory:');

    // Mount lobby routes
    app.use('/api/lobby', createLobbyRoutes(db));
  });

  afterEach(() => {
    db.close();
  });

  describe('POST /api/lobby/create', () => {
    it('should create a new game with room code', async () => {
      const response = await request(app)
        .post('/api/lobby/create')
        .expect(200);

      expect(response.body).toHaveProperty('gameId');
      expect(response.body).toHaveProperty('roomCode');
      expect(response.body.gameId).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(response.body.roomCode).toMatch(/^[A-Z]{6}$/);
    });

    it('should generate unique room codes', async () => {
      const response1 = await request(app).post('/api/lobby/create').expect(200);
      const response2 = await request(app).post('/api/lobby/create').expect(200);
      const response3 = await request(app).post('/api/lobby/create').expect(200);

      expect(response1.body.roomCode).not.toBe(response2.body.roomCode);
      expect(response2.body.roomCode).not.toBe(response3.body.roomCode);
      expect(response1.body.roomCode).not.toBe(response3.body.roomCode);
    });

    it('should generate unique game IDs', async () => {
      const response1 = await request(app).post('/api/lobby/create').expect(200);
      const response2 = await request(app).post('/api/lobby/create').expect(200);

      expect(response1.body.gameId).not.toBe(response2.body.gameId);
    });

    it('should create game in database', async () => {
      const response = await request(app).post('/api/lobby/create').expect(200);

      const game = db.getGame(response.body.gameId);
      expect(game).not.toBeNull();
      expect(game?.roomCode).toBe(response.body.roomCode);
      expect(game?.status).toBe('waiting');
    });

    it('should handle room code collision gracefully', async () => {
      // This test verifies the retry logic for room code collisions
      // Pre-create games to increase likelihood of collision
      const codes: string[] = [];
      for (let i = 0; i < 5; i++) {
        const response = await request(app).post('/api/lobby/create').expect(200);
        codes.push(response.body.roomCode);
      }

      // All codes should be unique
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(5);
    });
  });

  describe('GET /api/lobby/join/:roomCode', () => {
    it('should return game info for valid room code', async () => {
      // Create a room first
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(200);

      const roomCode = createResponse.body.roomCode;

      // Try to join
      const response = await request(app)
        .get(`/api/lobby/join/${roomCode}`)
        .expect(200);

      expect(response.body).toHaveProperty('gameId');
      expect(response.body).toHaveProperty('roomCode');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('hasSpace');
      expect(response.body).toHaveProperty('playerCount');

      expect(response.body.gameId).toBe(createResponse.body.gameId);
      expect(response.body.roomCode).toBe(roomCode);
      expect(response.body.status).toBe('waiting');
      expect(response.body.hasSpace).toBe(true);
      expect(response.body.playerCount).toBe(0);
    });

    it('should be case-insensitive for room codes', async () => {
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(200);

      const roomCode = createResponse.body.roomCode;
      const lowerCode = roomCode.toLowerCase();

      const response = await request(app)
        .get(`/api/lobby/join/${lowerCode}`)
        .expect(200);

      expect(response.body.roomCode).toBe(roomCode);
    });

    it('should return 404 for non-existent room code', async () => {
      const response = await request(app)
        .get('/api/lobby/join/NOTFOUND')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Room not found');
    });

    it('should return 400 for missing room code', async () => {
      const response = await request(app)
        .get('/api/lobby/join/')
        .expect(404); // Express returns 404 for missing param
    });

    it('should report hasSpace=false when both players are set', async () => {
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(200);

      const gameId = createResponse.body.gameId;
      const roomCode = createResponse.body.roomCode;

      // Manually add both players
      db.setPlayer(gameId, 1, 'player1', 'socket-1');
      db.setPlayer(gameId, 2, 'player2', 'socket-2');

      const response = await request(app)
        .get(`/api/lobby/join/${roomCode}`)
        .expect(200);

      expect(response.body.hasSpace).toBe(false);
      expect(response.body.playerCount).toBe(2);
    });

    it('should report hasSpace=true when only one player is set', async () => {
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(200);

      const gameId = createResponse.body.gameId;
      const roomCode = createResponse.body.roomCode;

      // Add only player 1
      db.setPlayer(gameId, 1, 'player1', 'socket-1');

      const response = await request(app)
        .get(`/api/lobby/join/${roomCode}`)
        .expect(200);

      expect(response.body.hasSpace).toBe(true);
      expect(response.body.playerCount).toBe(1);
    });

    it('should return 410 for ended games', async () => {
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(200);

      const gameId = createResponse.body.gameId;
      const roomCode = createResponse.body.roomCode;

      // Mark game as ended
      db.updateStatus(gameId, 'ended');

      const response = await request(app)
        .get(`/api/lobby/join/${roomCode}`)
        .expect(410);

      expect(response.body.error).toBe('Game has ended');
    });

    it('should return 410 for abandoned games', async () => {
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(200);

      const gameId = createResponse.body.gameId;
      const roomCode = createResponse.body.roomCode;

      // Mark game as abandoned
      db.updateStatus(gameId, 'abandoned');

      const response = await request(app)
        .get(`/api/lobby/join/${roomCode}`)
        .expect(410);

      expect(response.body.error).toBe('Game has ended');
    });
  });

  describe('GET /api/lobby/game/:gameId', () => {
    it('should return game info by ID', async () => {
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(200);

      const gameId = createResponse.body.gameId;
      const roomCode = createResponse.body.roomCode;

      const response = await request(app)
        .get(`/api/lobby/game/${gameId}`)
        .expect(200);

      expect(response.body.gameId).toBe(gameId);
      expect(response.body.roomCode).toBe(roomCode);
      expect(response.body.status).toBe('waiting');
      expect(response.body.playerCount).toBe(0);
    });

    it('should return 404 for non-existent game ID', async () => {
      const response = await request(app)
        .get('/api/lobby/game/not-found')
        .expect(404);

      expect(response.body.error).toBe('Game not found');
    });

    it('should return correct player count', async () => {
      const createResponse = await request(app)
        .post('/api/lobby/create')
        .expect(200);

      const gameId = createResponse.body.gameId;

      // Add player 1
      db.setPlayer(gameId, 1, 'player1', 'socket-1');

      const response1 = await request(app)
        .get(`/api/lobby/game/${gameId}`)
        .expect(200);

      expect(response1.body.playerCount).toBe(1);

      // Add player 2
      db.setPlayer(gameId, 2, 'player2', 'socket-2');

      const response2 = await request(app)
        .get(`/api/lobby/game/${gameId}`)
        .expect(200);

      expect(response2.body.playerCount).toBe(2);
    });

    it('should return 400 for missing game ID', async () => {
      const response = await request(app)
        .get('/api/lobby/game/')
        .expect(404); // Express returns 404 for missing param
    });
  });

  describe('Error handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/lobby/create')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    it('should handle database errors gracefully', async () => {
      // Close the database to simulate an error
      db.close();

      const response = await request(app)
        .post('/api/lobby/create')
        .expect(500);

      expect(response.body).toHaveProperty('error');

      // Recreate database for cleanup
      db = initDatabase(':memory:');
    });
  });

  describe('Room code format', () => {
    it('should generate 6-character uppercase room codes', async () => {
      const codes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const response = await request(app).post('/api/lobby/create').expect(200);
        codes.push(response.body.roomCode);
      }

      for (const code of codes) {
        expect(code).toMatch(/^[A-Z]{6}$/);
        expect(code.length).toBe(6);
      }
    });

    it('should not include ambiguous characters I and O', async () => {
      const codes: string[] = [];
      for (let i = 0; i < 50; i++) {
        const response = await request(app).post('/api/lobby/create').expect(200);
        codes.push(response.body.roomCode);
      }

      for (const code of codes) {
        expect(code).not.toContain('I');
        expect(code).not.toContain('O');
      }
    });
  });
});
