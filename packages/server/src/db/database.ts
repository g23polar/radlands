/**
 * SQLite database setup and queries
 *
 * Stores game state as JSON blobs for simplicity.
 * Uses better-sqlite3 for synchronous, fast queries.
 */

import Database from 'better-sqlite3';
import type { GameState } from '@radlands/core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface GameRow {
  id: string;
  room_code: string;
  state: string; // JSON serialized GameState
  player1_id: string | null;
  player2_id: string | null;
  player1_socket: string | null;
  player2_socket: string | null;
  status: 'waiting' | 'playing' | 'ended' | 'abandoned';
  created_at: number;
  updated_at: number;
}

export interface DbGame {
  id: string;
  roomCode: string;
  state: GameState | null;
  player1Id: string | null;
  player2Id: string | null;
  player1Socket: string | null;
  player2Socket: string | null;
  status: GameRow['status'];
  createdAt: Date;
  updatedAt: Date;
}

export type GameDatabase = ReturnType<typeof initDatabase>;

/**
 * Initialize the database and create tables
 */
export function initDatabase(dbPath?: string) {
  const defaultPath = path.join(__dirname, '../../data/radlands.db');
  const db = new Database(dbPath ?? defaultPath);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create games table
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      room_code TEXT UNIQUE NOT NULL,
      state TEXT,
      player1_id TEXT,
      player2_id TEXT,
      player1_socket TEXT,
      player2_socket TEXT,
      status TEXT DEFAULT 'waiting' CHECK(status IN ('waiting', 'playing', 'ended', 'abandoned')),
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  // Index for room code lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code)
  `);

  // Index for finding active games
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)
  `);

  return {
    /**
     * Create a new game with a room code
     */
    createGame(id: string, roomCode: string): DbGame {
      const stmt = db.prepare(`
        INSERT INTO games (id, room_code, status)
        VALUES (?, ?, 'waiting')
        RETURNING *
      `);
      const row = stmt.get(id, roomCode) as GameRow;
      return rowToGame(row);
    },

    /**
     * Get a game by room code
     */
    getGameByRoomCode(roomCode: string): DbGame | null {
      const stmt = db.prepare('SELECT * FROM games WHERE room_code = ?');
      const row = stmt.get(roomCode) as GameRow | undefined;
      return row ? rowToGame(row) : null;
    },

    /**
     * Get a game by ID
     */
    getGame(id: string): DbGame | null {
      const stmt = db.prepare('SELECT * FROM games WHERE id = ?');
      const row = stmt.get(id) as GameRow | undefined;
      return row ? rowToGame(row) : null;
    },

    /**
     * Update game state
     */
    updateGameState(id: string, state: GameState): void {
      const stmt = db.prepare(`
        UPDATE games
        SET state = ?, updated_at = unixepoch()
        WHERE id = ?
      `);
      stmt.run(JSON.stringify(state), id);
    },

    /**
     * Set player connection info
     */
    setPlayer(
      id: string,
      playerSlot: 1 | 2,
      playerId: string,
      socketId: string
    ): void {
      const playerCol = playerSlot === 1 ? 'player1_id' : 'player2_id';
      const socketCol = playerSlot === 1 ? 'player1_socket' : 'player2_socket';
      const stmt = db.prepare(`
        UPDATE games
        SET ${playerCol} = ?, ${socketCol} = ?, updated_at = unixepoch()
        WHERE id = ?
      `);
      stmt.run(playerId, socketId, id);
    },

    /**
     * Update player socket (for reconnection)
     */
    updatePlayerSocket(id: string, playerSlot: 1 | 2, socketId: string): void {
      const socketCol = playerSlot === 1 ? 'player1_socket' : 'player2_socket';
      const stmt = db.prepare(`
        UPDATE games
        SET ${socketCol} = ?, updated_at = unixepoch()
        WHERE id = ?
      `);
      stmt.run(socketId, id);
    },

    /**
     * Clear player socket (on disconnect)
     */
    clearPlayerSocket(id: string, playerSlot: 1 | 2): void {
      const socketCol = playerSlot === 1 ? 'player1_socket' : 'player2_socket';
      const stmt = db.prepare(`
        UPDATE games
        SET ${socketCol} = NULL, updated_at = unixepoch()
        WHERE id = ?
      `);
      stmt.run(id, id);
    },

    /**
     * Update game status
     */
    updateStatus(id: string, status: GameRow['status']): void {
      const stmt = db.prepare(`
        UPDATE games
        SET status = ?, updated_at = unixepoch()
        WHERE id = ?
      `);
      stmt.run(status, id);
    },

    /**
     * Find game by socket ID (for disconnect handling)
     */
    findGameBySocket(socketId: string): { game: DbGame; playerSlot: 1 | 2 } | null {
      const stmt = db.prepare(`
        SELECT * FROM games
        WHERE (player1_socket = ? OR player2_socket = ?)
        AND status IN ('waiting', 'playing')
      `);
      const row = stmt.get(socketId, socketId) as GameRow | undefined;
      if (!row) return null;

      const playerSlot = row.player1_socket === socketId ? 1 : 2;
      return { game: rowToGame(row), playerSlot };
    },

    /**
     * Clean up old abandoned games (older than 24 hours)
     */
    cleanupOldGames(): number {
      const stmt = db.prepare(`
        DELETE FROM games
        WHERE status = 'abandoned'
        AND updated_at < unixepoch() - 86400
      `);
      const result = stmt.run();
      return result.changes;
    },

    /**
     * Mark stale games as abandoned (no activity for 5 minutes)
     */
    markStaleGamesAbandoned(): number {
      const stmt = db.prepare(`
        UPDATE games
        SET status = 'abandoned'
        WHERE status IN ('waiting', 'playing')
        AND player1_socket IS NULL
        AND player2_socket IS NULL
        AND updated_at < unixepoch() - 300
      `);
      const result = stmt.run();
      return result.changes;
    },

    /**
     * Close the database connection
     */
    close(): void {
      db.close();
    },
  };
}

/**
 * Convert database row to game object
 */
function rowToGame(row: GameRow): DbGame {
  return {
    id: row.id,
    roomCode: row.room_code,
    state: row.state ? (JSON.parse(row.state) as GameState) : null,
    player1Id: row.player1_id,
    player2Id: row.player2_id,
    player1Socket: row.player1_socket,
    player2Socket: row.player2_socket,
    status: row.status,
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
  };
}
