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
  type GameEvent,
  createGame,
  applyAction,
  getPlayer,
  getOpponentId,
  validateAction,
  getValidActions,
  getCard,
  getCardInstance,
  getValidDamageTargets,
  getValidRaidTargets,
  canTarget,
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
 * Interaction flow modes
 */
export type ActionMode =
  | 'idle'
  | 'select_action'     // Hand card selected, choosing what to do
  | 'select_column'     // Choosing a column for play_person/play_punk
  | 'select_queue_slot' // Choosing a queue slot for play_event
  | 'select_target';    // Choosing a target card for junk/ability

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
  /** Current interaction flow mode */
  actionMode: ActionMode;
  /** The action type being built */
  pendingActionType: string | null;
  /** Valid column indices for placement */
  validColumns: number[];
  /** Valid queue slot indices for placement */
  validQueueSlots: number[];
  /** Ability index being used */
  pendingAbilityIndex: number | null;
  /** Source card for ability use */
  pendingSourceId: CardInstanceId | null;
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

  // Animation events
  pendingEvents: GameEvent[];
  clearPendingEvents: () => void;

  // Local game actions
  initGame: (player1Name: string, player2Name: string) => void;
  setLocalPlayer: (playerId: PlayerId) => void;
  selectCard: (cardId: CardInstanceId | null) => void;
  hoverCard: (cardId: CardInstanceId | null) => void;
  performAction: (action: GameAction) => boolean;
  setPendingAction: (pending: PendingAction | null) => void;
  resetGame: () => void;

  // Interaction flow actions
  startAction: (actionType: 'play_person' | 'play_event' | 'play_punk' | 'junk') => void;
  startAbility: (sourceInstanceId: CardInstanceId, abilityIndex: number) => void;
  selectColumn: (columnIndex: 0 | 1 | 2) => void;
  selectQueueSlot: (position: 0 | 1 | 2) => void;
  selectTarget: (targetId: CardInstanceId) => void;
  cancelAction: () => void;

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
  actionMode: 'idle',
  pendingActionType: null,
  validColumns: [],
  validQueueSlots: [],
  pendingAbilityIndex: null,
  pendingSourceId: null,
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
  pendingEvents: [],

  /**
   * Clear pending animation events
   */
  clearPendingEvents: () => {
    set({ pendingEvents: [] });
  },

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
   * If in target selection mode, clicking a valid target triggers the action.
   * If selecting a hand card, enters select_action mode.
   * If selecting a board card, shows abilities if available.
   */
  selectCard: (cardId: CardInstanceId | null) => {
    const { gameState, localPlayerId, ui } = get();
    if (!gameState || !localPlayerId) return;

    // If deselecting, cancel action
    if (!cardId) {
      set({ ui: { ...initialUIState } });
      return;
    }

    // If in target selection mode and clicked a valid target, select it
    if (ui.actionMode === 'select_target' && ui.validTargets.includes(cardId)) {
      get().selectTarget(cardId);
      return;
    }

    // Check if this card is in the local player's hand
    const player = getPlayer(gameState, localPlayerId);
    if (!player) return;

    const isInHand = player.hand.includes(cardId);
    const isMyTurn = gameState.activePlayerId === localPlayerId;
    const isActionsPhase = gameState.turnPhase === 'actions';

    if (isInHand && isMyTurn && isActionsPhase) {
      // Selecting a hand card — enter action selection mode
      set(() => ({
        ui: {
          ...initialUIState,
          selectedCardId: cardId,
          actionMode: 'select_action',
        },
      }));
    } else {
      // Selecting a board card — just highlight it
      set(() => ({
        ui: {
          ...initialUIState,
          selectedCardId: cardId,
          actionMode: 'idle',
        },
      }));
    }
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
      pendingEvents: result.events || [],
    });

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

  // ========== Interaction Flow Actions ==========

  /**
   * Start an action for the currently selected hand card
   */
  startAction: (actionType: 'play_person' | 'play_event' | 'play_punk' | 'junk') => {
    const { gameState, localPlayerId, ui } = get();
    if (!gameState || !localPlayerId || !ui.selectedCardId) return;

    const player = getPlayer(gameState, localPlayerId);
    if (!player) return;

    const cardId = ui.selectedCardId;

    if (actionType === 'play_person' || actionType === 'play_punk') {
      // Find valid columns (those with < 2 people)
      const validCols: number[] = [];
      for (let i = 0; i < 3; i++) {
        const col = player.columns[i];
        if (col && col.personInstanceIds.length < 2) {
          validCols.push(i);
        }
      }
      set((state) => ({
        ui: {
          ...state.ui,
          actionMode: 'select_column',
          pendingActionType: actionType,
          validColumns: validCols,
          validQueueSlots: [],
          validTargets: [],
        },
      }));
    } else if (actionType === 'play_event') {
      // Find valid queue slots (those that are empty)
      const validSlots: number[] = [];
      for (let i = 0; i < 3; i++) {
        const slot = player.eventQueue[i];
        if (slot && slot.eventInstanceId === null) {
          validSlots.push(i);
        }
      }
      set((state) => ({
        ui: {
          ...state.ui,
          actionMode: 'select_queue_slot',
          pendingActionType: actionType,
          validColumns: [],
          validQueueSlots: validSlots,
          validTargets: [],
        },
      }));
    } else if (actionType === 'junk') {
      const instance = getCardInstance(gameState, cardId);
      if (!instance) return;
      const card = getCard(instance.cardId);
      if (!card) return;

      const junkIcon = (card.type === 'person' || card.type === 'event') ? card.junkIcon : undefined;
      if (!junkIcon) return;

      // Junk icons that need targets
      if (junkIcon === 'damage') {
        const targets = getValidDamageTargets(gameState, localPlayerId);
        set((state) => ({
          ui: {
            ...state.ui,
            actionMode: 'select_target',
            pendingActionType: 'junk',
            validTargets: targets,
            validColumns: [],
            validQueueSlots: [],
          },
        }));
      } else if (junkIcon === 'raid') {
        const targets = getValidRaidTargets(gameState, localPlayerId);
        set((state) => ({
          ui: {
            ...state.ui,
            actionMode: 'select_target',
            pendingActionType: 'junk',
            validTargets: targets,
            validColumns: [],
            validQueueSlots: [],
          },
        }));
      } else if (junkIcon === 'restore') {
        // Find all damaged friendly board cards
        const targets: CardInstanceId[] = [];
        for (const col of player.columns) {
          if (col.campInstanceId) {
            const inst = getCardInstance(gameState, col.campInstanceId);
            if (inst?.isDamaged) targets.push(col.campInstanceId);
          }
          for (const pid of col.personInstanceIds) {
            const inst = getCardInstance(gameState, pid);
            if (inst?.isDamaged) targets.push(pid);
          }
        }
        if (targets.length > 0) {
          set((state) => ({
            ui: {
              ...state.ui,
              actionMode: 'select_target',
              pendingActionType: 'junk',
              validTargets: targets,
              validColumns: [],
              validQueueSlots: [],
            },
          }));
        } else {
          // No valid restore targets - can't junk for restore
          return;
        }
      } else {
        // draw, punk, water — no target needed, execute immediately
        const { performAction } = get();
        performAction({
          type: 'junk_card',
          playerId: localPlayerId,
          cardInstanceId: cardId,
        });
      }
    }
  },

  /**
   * Start using an ability from a board card
   */
  startAbility: (sourceInstanceId: CardInstanceId, abilityIndex: number) => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return;

    const instance = getCardInstance(gameState, sourceInstanceId);
    if (!instance) return;

    const card = getCard(instance.cardId);
    if (!card?.abilities?.[abilityIndex]) return;

    const ability = card.abilities[abilityIndex];
    const primaryEffect = ability.effects[0];

    // Check if ability needs a target
    if (primaryEffect && primaryEffect.target !== 'none' && primaryEffect.target !== 'self') {
      // Find valid targets for this ability
      const targets: CardInstanceId[] = [];
      // Check all board cards
      for (const playerId of gameState.playerOrder) {
        const player = getPlayer(gameState, playerId);
        if (!player) continue;
        for (const col of player.columns) {
          if (col.campInstanceId) {
            if (canTarget(gameState, localPlayerId, col.campInstanceId, primaryEffect.target)) {
              targets.push(col.campInstanceId);
            }
          }
          for (const pid of col.personInstanceIds) {
            if (canTarget(gameState, localPlayerId, pid, primaryEffect.target)) {
              targets.push(pid);
            }
          }
        }
      }

      set((state) => ({
        ui: {
          ...state.ui,
          selectedCardId: sourceInstanceId,
          actionMode: 'select_target',
          pendingActionType: 'use_ability',
          pendingAbilityIndex: abilityIndex,
          pendingSourceId: sourceInstanceId,
          validTargets: targets,
          validColumns: [],
          validQueueSlots: [],
        },
      }));
    } else {
      // No target needed — execute immediately
      const { performAction } = get();
      performAction({
        type: 'use_ability',
        playerId: localPlayerId,
        sourceInstanceId,
        abilityIndex,
      });
    }
  },

  /**
   * Select a column for play_person or play_punk
   */
  selectColumn: (columnIndex: 0 | 1 | 2) => {
    const { gameState, localPlayerId, ui, performAction } = get();
    if (!gameState || !localPlayerId || !ui.selectedCardId) return;

    if (ui.pendingActionType === 'play_person') {
      performAction({
        type: 'play_person',
        playerId: localPlayerId,
        cardInstanceId: ui.selectedCardId,
        columnIndex,
      });
    } else if (ui.pendingActionType === 'play_punk') {
      performAction({
        type: 'play_punk',
        playerId: localPlayerId,
        cardInstanceId: ui.selectedCardId,
        columnIndex,
      });
    }
  },

  /**
   * Select a queue slot for play_event
   */
  selectQueueSlot: (position: 0 | 1 | 2) => {
    const { gameState, localPlayerId, ui, performAction } = get();
    if (!gameState || !localPlayerId || !ui.selectedCardId) return;

    if (ui.pendingActionType === 'play_event') {
      performAction({
        type: 'play_event',
        playerId: localPlayerId,
        cardInstanceId: ui.selectedCardId,
        queuePosition: position,
      });
    }
  },

  /**
   * Select a target card for junk or ability
   */
  selectTarget: (targetId: CardInstanceId) => {
    const { gameState, localPlayerId, ui, performAction } = get();
    if (!gameState || !localPlayerId) return;

    if (ui.pendingActionType === 'junk' && ui.selectedCardId) {
      performAction({
        type: 'junk_card',
        playerId: localPlayerId,
        cardInstanceId: ui.selectedCardId,
        targetInstanceId: targetId,
      });
    } else if (ui.pendingActionType === 'use_ability' && ui.pendingSourceId != null) {
      performAction({
        type: 'use_ability',
        playerId: localPlayerId,
        sourceInstanceId: ui.pendingSourceId,
        abilityIndex: ui.pendingAbilityIndex ?? 0,
        targetInstanceId: targetId,
      });
    }
  },

  /**
   * Cancel the current action flow
   */
  cancelAction: () => {
    set(() => ({
      ui: {
        ...initialUIState,
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

    socket.on('game:state', (data: { state: GameState; events?: GameEvent[] }) => {
      _setGameState(data.state);
      if (data.events && data.events.length > 0) {
        set({ pendingEvents: data.events });
      }
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

/** Get action mode */
export const useActionMode = () =>
  useGameStore((state) => state.ui.actionMode);

/** Get pending action type */
export const usePendingActionType = () =>
  useGameStore((state) => state.ui.pendingActionType);

/** Get valid columns for placement */
export const useValidColumns = () =>
  useGameStore((state) => state.ui.validColumns);

/** Get valid queue slots for placement */
export const useValidQueueSlots = () =>
  useGameStore((state) => state.ui.validQueueSlots);
