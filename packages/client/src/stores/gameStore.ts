/**
 * Zustand store for Radlands game state
 *
 * This store manages the local game state, UI state, and game actions.
 * It integrates with the pure game logic from @radlands/core and provides
 * a reactive interface for React components.
 *
 * Supports both local (hotseat) and online multiplayer modes.
 */

import { create } from 'zustand';
import {
  type GameState,
  type GameAction,
  type PlayerState,
  type PlayerId,
  type CardInstanceId,
  type PendingAction,
  createGame,
  applyAction,
  getPlayer,
  getOpponentId,
  validateAction,
  getValidActions,
} from '@radlands/core';
import {
  getSocket,
  connect,
  disconnect,
  joinRoom,
  leaveRoom,
  startGame as socketStartGame,
  sendAction,
  createRoom,
  saveSession,
  loadSession,
  clearSession,
  type GameSocket,
} from '../services/socket';

/** Game mode */
export type GameMode = 'local' | 'online';

/** Online connection state */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'in_lobby'
  | 'waiting_for_player'
  | 'in_game';

/**
 * UI-specific state not part of core game logic
 */
interface UIState {
  /** Currently selected card (for highlighting/targeting) */
  selectedCardId: CardInstanceId | null;
  /** Currently hovered card (for tooltips) */
  hoveredCardId: CardInstanceId | null;
  /** Valid target card IDs for current selection */
  validTargets: CardInstanceId[];
  /** Pending action awaiting target selection */
  pendingAction: PendingAction | null;
}

/**
 * Online multiplayer state
 */
interface OnlineState {
  connectionState: ConnectionState;
  roomCode: string | null;
  gameId: string | null;
  playerSlot: 1 | 2 | null;
  opponentConnected: boolean;
  error: string | null;
}

/**
 * Complete store state shape
 */
interface GameStore {
  // Core game state
  gameState: GameState | null;

  // UI state
  ui: UIState;

  // Game mode
  mode: GameMode;

  // Local player info
  localPlayerId: PlayerId | null;

  // Online state
  online: OnlineState;

  // Local game actions
  initGame: (player1Name: string, player2Name: string) => void;
  setLocalPlayer: (playerId: PlayerId) => void;
  selectCard: (cardId: CardInstanceId | null) => void;
  hoverCard: (cardId: CardInstanceId | null) => void;
  performAction: (action: GameAction) => boolean;
  setPendingAction: (pending: PendingAction | null) => void;
  resetGame: () => void;

  // Online game actions
  createOnlineGame: (playerName: string) => Promise<void>;
  joinOnlineGame: (roomCode: string, playerName: string) => Promise<void>;
  startOnlineGame: () => void;
  leaveOnlineGame: () => void;
  attemptReconnect: () => Promise<boolean>;

  // Internal online handlers
  _setupSocketListeners: () => void;
  _cleanupSocketListeners: () => void;
  _setGameState: (state: GameState) => void;
  _setOnlineState: (updates: Partial<OnlineState>) => void;

  // Computed helpers
  isMyTurn: () => boolean;
  getMyPlayer: () => PlayerState | null;
  getOpponentPlayer: () => PlayerState | null;
  canPerformAction: (action: GameAction) => boolean;
  getAvailableActions: () => GameAction[];
}

/**
 * Initial UI state
 */
const initialUIState: UIState = {
  selectedCardId: null,
  hoveredCardId: null,
  validTargets: [],
  pendingAction: null,
};

/**
 * Initial online state
 */
const initialOnlineState: OnlineState = {
  connectionState: 'disconnected',
  roomCode: null,
  gameId: null,
  playerSlot: null,
  opponentConnected: false,
  error: null,
};

/**
 * Main game store
 */
export const useGameStore = create<GameStore>()((set, get) => ({
  // Initial state
  gameState: null,
  ui: initialUIState,
  mode: 'local',
  localPlayerId: null,
  online: initialOnlineState,

  /**
   * Initialize a new local game
   */
  initGame: (player1Name: string, player2Name: string) => {
    const player1Id = 'player1';
    const player2Id = 'player2';

    const gameState = createGame({
      player1Id,
      player1Name,
      player2Id,
      player2Name,
    });

    set({
      gameState,
      mode: 'local',
      localPlayerId: player1Id,
      ui: initialUIState,
      online: initialOnlineState,
    });
  },

  /**
   * Reset game to initial state
   */
  resetGame: () => {
    const { mode, _cleanupSocketListeners } = get();
    if (mode === 'online') {
      _cleanupSocketListeners();
      leaveRoom();
      disconnect();
      clearSession();
    }
    set({
      gameState: null,
      ui: initialUIState,
      mode: 'local',
      localPlayerId: null,
      online: initialOnlineState,
    });
  },

  /**
   * Set the local player (for hotseat mode switching)
   */
  setLocalPlayer: (playerId: PlayerId) => {
    set({ localPlayerId: playerId });
  },

  /**
   * Select a card (for targeting or highlighting)
   */
  selectCard: (cardId: CardInstanceId | null) => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return;

    let validTargets: CardInstanceId[] = [];
    if (cardId) {
      const actions = getValidActions(gameState, localPlayerId);
      for (const action of actions) {
        if (
          action.type === 'use_ability' &&
          action.sourceInstanceId === cardId
        ) {
          // TODO: Implement proper target calculation based on ability
        }
      }
    }

    set((state) => ({
      ui: {
        ...state.ui,
        selectedCardId: cardId,
        validTargets,
      },
    }));
  },

  /**
   * Hover over a card (for tooltips/preview)
   */
  hoverCard: (cardId: CardInstanceId | null) => {
    set((state) => ({
      ui: {
        ...state.ui,
        hoveredCardId: cardId,
      },
    }));
  },

  /**
   * Perform a game action
   * In local mode, applies directly. In online mode, sends to server.
   */
  performAction: (action: GameAction): boolean => {
    const { gameState, mode } = get();
    if (!gameState) return false;

    // Validate action first
    const validation = validateAction(gameState, action);
    if (!validation.valid) {
      console.warn('Invalid action:', validation.error);
      return false;
    }

    if (mode === 'online') {
      // Send to server - state update will come via socket
      sendAction(action);
      return true;
    }

    // Local mode: apply immediately
    const result = applyAction(gameState, action);
    if (!result.success) {
      console.error('Failed to apply action:', result.error);
      return false;
    }

    set({
      gameState: result.newState,
      ui: initialUIState,
    });

    if (result.events && result.events.length > 0) {
      console.log('Game events:', result.events);
    }

    return true;
  },

  /**
   * Set a pending action that requires target selection
   */
  setPendingAction: (pending: PendingAction | null) => {
    set((state) => ({
      ui: {
        ...state.ui,
        pendingAction: pending,
        validTargets: pending?.validTargets ?? [],
      },
    }));
  },

  // ========== Online Game Actions ==========

  /**
   * Create a new online game
   */
  createOnlineGame: async (playerName: string) => {
    const { _setupSocketListeners, _setOnlineState } = get();

    try {
      _setOnlineState({ connectionState: 'connecting', error: null });

      // Create room via REST API
      const { gameId, roomCode } = await createRoom();

      // Connect to socket
      await connect();
      _setupSocketListeners();

      // Join the room
      joinRoom(roomCode, playerName);

      set({
        mode: 'online',
      });

      _setOnlineState({
        connectionState: 'waiting_for_player',
        gameId,
        roomCode,
      });
    } catch (error) {
      _setOnlineState({
        connectionState: 'disconnected',
        error: error instanceof Error ? error.message : 'Failed to create game',
      });
      throw error;
    }
  },

  /**
   * Join an existing online game
   */
  joinOnlineGame: async (roomCode: string, playerName: string) => {
    const { _setupSocketListeners, _setOnlineState } = get();

    try {
      _setOnlineState({ connectionState: 'connecting', error: null });

      // Connect to socket
      await connect();
      _setupSocketListeners();

      // Join the room
      joinRoom(roomCode.toUpperCase(), playerName);

      set({
        mode: 'online',
      });
    } catch (error) {
      _setOnlineState({
        connectionState: 'disconnected',
        error: error instanceof Error ? error.message : 'Failed to join game',
      });
      throw error;
    }
  },

  /**
   * Start the online game (host only)
   */
  startOnlineGame: () => {
    socketStartGame();
  },

  /**
   * Leave the current online game
   */
  leaveOnlineGame: () => {
    const { _cleanupSocketListeners, _setOnlineState } = get();
    _cleanupSocketListeners();
    leaveRoom();
    disconnect();
    clearSession();

    set({
      gameState: null,
      mode: 'local',
      localPlayerId: null,
      ui: initialUIState,
    });
    _setOnlineState(initialOnlineState);
  },

  /**
   * Attempt to reconnect to a previous game
   */
  attemptReconnect: async (): Promise<boolean> => {
    const session = loadSession();
    if (!session) return false;

    const { _setupSocketListeners, _setOnlineState } = get();

    try {
      _setOnlineState({ connectionState: 'connecting', error: null });

      await connect();
      _setupSocketListeners();

      joinRoom(session.roomCode, 'Reconnecting...', session.playerId);

      set({ mode: 'online' });
      return true;
    } catch {
      clearSession();
      _setOnlineState({
        connectionState: 'disconnected',
        error: 'Failed to reconnect',
      });
      return false;
    }
  },

  // ========== Internal Socket Handlers ==========

  _setupSocketListeners: () => {
    const socket: GameSocket = getSocket();
    const { _setGameState, _setOnlineState } = get();

    socket.on('room:joined', (data) => {
      console.log('Joined room:', data);
      set({ localPlayerId: data.playerId });
      _setOnlineState({
        connectionState: 'waiting_for_player',
        roomCode: data.roomCode,
        gameId: data.gameId,
        playerSlot: data.playerSlot,
      });
      saveSession(data.gameId, data.roomCode, data.playerId);
    });

    socket.on('room:player-joined', (data) => {
      console.log('Player joined:', data);
      _setOnlineState({ opponentConnected: true });
    });

    socket.on('room:player-left', (data) => {
      console.log('Player left:', data);
      _setOnlineState({ opponentConnected: false });
    });

    socket.on('room:error', (data) => {
      console.error('Room error:', data.message);
      _setOnlineState({ error: data.message });
    });

    socket.on('game:started', (data) => {
      console.log('Game started');
      _setGameState(data.state);
      _setOnlineState({ connectionState: 'in_game' });
    });

    socket.on('game:state', (data) => {
      _setGameState(data.state);
    });

    socket.on('game:action-error', (data) => {
      console.error('Action error:', data.message);
      // Could show a toast notification here
    });

    socket.on('game:ended', (data) => {
      console.log('Game ended:', data);
      // Game state will be updated via game:state event
    });

    socket.on('reconnect:success', (data) => {
      console.log('Reconnected:', data);
      set({ localPlayerId: data.playerId });
      _setGameState(data.state);
      _setOnlineState({
        connectionState: 'in_game',
        gameId: data.gameId,
      });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      _setOnlineState({ connectionState: 'disconnected' });
    });
  },

  _cleanupSocketListeners: () => {
    const socket: GameSocket = getSocket();
    socket.off('room:joined');
    socket.off('room:player-joined');
    socket.off('room:player-left');
    socket.off('room:error');
    socket.off('game:started');
    socket.off('game:state');
    socket.off('game:action-error');
    socket.off('game:ended');
    socket.off('reconnect:success');
    socket.off('disconnect');
  },

  _setGameState: (state: GameState) => {
    set({ gameState: state, ui: initialUIState });
  },

  _setOnlineState: (updates: Partial<OnlineState>) => {
    set((state) => ({
      online: { ...state.online, ...updates },
    }));
  },

  // ========== Computed Helpers ==========

  isMyTurn: (): boolean => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return false;
    return gameState.activePlayerId === localPlayerId;
  },

  getMyPlayer: (): PlayerState | null => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return null;
    return getPlayer(gameState, localPlayerId) ?? null;
  },

  getOpponentPlayer: (): PlayerState | null => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return null;
    const opponentId = getOpponentId(gameState, localPlayerId);
    return getPlayer(gameState, opponentId) ?? null;
  },

  canPerformAction: (action: GameAction): boolean => {
    const { gameState } = get();
    if (!gameState) return false;
    const validation = validateAction(gameState, action);
    return validation.valid;
  },

  getAvailableActions: (): GameAction[] => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return [];
    return getValidActions(gameState, localPlayerId);
  },
}));

/**
 * Selectors for common patterns
 */

/** Get current game mode */
export const useGameMode = () => useGameStore((state) => state.mode);

/** Get online connection state */
export const useConnectionState = () =>
  useGameStore((state) => state.online.connectionState);

/** Get room code */
export const useRoomCode = () => useGameStore((state) => state.online.roomCode);

/** Get online error */
export const useOnlineError = () => useGameStore((state) => state.online.error);

/** Get opponent connected status */
export const useOpponentConnected = () =>
  useGameStore((state) => state.online.opponentConnected);

/** Get current game phase */
export const useGamePhase = () =>
  useGameStore((state) => state.gameState?.phase);

/** Get current turn phase */
export const useTurnPhase = () =>
  useGameStore((state) => state.gameState?.turnPhase);

/** Get if it's local player's turn */
export const useIsMyTurn = () => useGameStore((state) => state.isMyTurn());

/** Get local player state */
export const useMyPlayer = () => useGameStore((state) => state.getMyPlayer());

/** Get opponent player state */
export const useOpponentPlayer = () =>
  useGameStore((state) => state.getOpponentPlayer());

/** Get selected card ID */
export const useSelectedCard = () =>
  useGameStore((state) => state.ui.selectedCardId);

/** Get hovered card ID */
export const useHoveredCard = () =>
  useGameStore((state) => state.ui.hoveredCardId);

/** Get valid targets for current selection */
export const useValidTargets = () =>
  useGameStore((state) => state.ui.validTargets);

/** Get pending action */
export const usePendingAction = () =>
  useGameStore((state) => state.ui.pendingAction);

/** Get game winner */
export const useWinner = () =>
  useGameStore((state) => state.gameState?.winnerId);
