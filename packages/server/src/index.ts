/**
 * Radlands Multiplayer Server
 *
 * Express + Socket.io server for real-time multiplayer gameplay.
 * Server-authoritative: validates all game actions before applying.
 */

import express, { type Express } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/database.js';
import { setupSocketHandlers } from './socket/handlers.js';
import { createLobbyRoutes } from './routes/lobby.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT ?? 3001;
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

// Parse allowed origins (can be comma-separated for multiple)
const allowedOrigins = CLIENT_URL.split(',').map(o => o.trim());

// Initialize Express
const app: Express = express();
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed'), false);
  },
  credentials: true,
}));
app.use(express.json());

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: !allowedOrigins.includes('*'),
  },
});

// Initialize database
const db = initDatabase();

// Setup routes
app.use('/api/lobby', createLobbyRoutes(db));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Serve static client files in production
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// SPA fallback - serve index.html for any non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Setup socket handlers
setupSocketHandlers(io, db);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Radlands server running on port ${PORT}`);
});

export { app, io, db };
