/**
 * Lobby REST API routes
 *
 * Handles game creation and room code generation.
 * Actual gameplay happens over WebSocket.
 */

import { Router } from 'express';
import { nanoid } from 'nanoid';
import type { GameDatabase } from '../db/database.js';

/**
 * Generate a human-readable room code
 * 6 uppercase letters, easy to read and type
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Omit I and O to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createLobbyRoutes(db: GameDatabase): Router {
  const router = Router();

  /**
   * POST /api/lobby/create
   * Create a new game room
   */
  router.post('/create', (_req, res) => {
    try {
      const gameId = nanoid();
      let roomCode = generateRoomCode();

      // Ensure room code is unique (very unlikely to collide, but check anyway)
      let attempts = 0;
      while (db.getGameByRoomCode(roomCode) && attempts < 10) {
        roomCode = generateRoomCode();
        attempts++;
      }

      if (attempts >= 10) {
        res.status(500).json({ error: 'Failed to generate unique room code' });
        return;
      }

      const game = db.createGame(gameId, roomCode);

      res.json({
        gameId: game.id,
        roomCode: game.roomCode,
      });
    } catch (error) {
      console.error('Error creating game:', error);
      res.status(500).json({ error: 'Failed to create game' });
    }
  });

  /**
   * GET /api/lobby/join/:roomCode
   * Check if a room exists and has space
   */
  router.get('/join/:roomCode', (req, res) => {
    try {
      const { roomCode } = req.params;
      if (!roomCode) {
        res.status(400).json({ error: 'Room code required' });
        return;
      }

      const game = db.getGameByRoomCode(roomCode.toUpperCase());

      if (!game) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      if (game.status === 'ended' || game.status === 'abandoned') {
        res.status(410).json({ error: 'Game has ended' });
        return;
      }

      // Check if room has space
      const hasSpace = !game.player1Id || !game.player2Id;

      res.json({
        gameId: game.id,
        roomCode: game.roomCode,
        status: game.status,
        hasSpace,
        playerCount: (game.player1Id ? 1 : 0) + (game.player2Id ? 1 : 0),
      });
    } catch (error) {
      console.error('Error checking room:', error);
      res.status(500).json({ error: 'Failed to check room' });
    }
  });

  /**
   * GET /api/lobby/game/:gameId
   * Get game info by ID (for reconnection)
   */
  router.get('/game/:gameId', (req, res) => {
    try {
      const { gameId } = req.params;
      if (!gameId) {
        res.status(400).json({ error: 'Game ID required' });
        return;
      }

      const game = db.getGame(gameId);

      if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
      }

      res.json({
        gameId: game.id,
        roomCode: game.roomCode,
        status: game.status,
        playerCount: (game.player1Id ? 1 : 0) + (game.player2Id ? 1 : 0),
      });
    } catch (error) {
      console.error('Error getting game:', error);
      res.status(500).json({ error: 'Failed to get game' });
    }
  });

  return router;
}
