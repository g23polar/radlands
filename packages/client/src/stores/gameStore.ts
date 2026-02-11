/**
 * Zustand store for Radlands game state
 *
 * This store manages the local game state, UI state, and game actions.
 * It integrates with the pure game logic from @radlands/core and provides
 * a reactive interface for React components.
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
 * Complete store state shape
 */
interface GameStore {
  // Core game state
  gameState: GameState | null;

  // UI state
  ui: UIState;

  // Local player info (for hotseat mode)
  localPlayerId: PlayerId | null;

  // Actions
  initGame: (player1Name: string, player2Name: string) => void;
  setLocalPlayer: (playerId: PlayerId) => void;
  selectCard: (cardId: CardInstanceId | null) => void;
  hoverCard: (cardId: CardInstanceId | null) => void;
  performAction: (action: GameAction) => boolean;
  setPendingAction: (pending: PendingAction | null) => void;

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
 * Main game store
 */
export const useGameStore = create<GameStore>()((set, get) => ({
  // Initial state
  gameState: null,
  ui: initialUIState,
  localPlayerId: null,

  /**
   * Initialize a new game
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
      localPlayerId: player1Id, // Default to player 1 for hotseat
      ui: initialUIState,
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

    // Calculate valid targets if a card is selected
    let validTargets: CardInstanceId[] = [];
    if (cardId) {
      // Get valid actions for the selected card
      const actions = getValidActions(gameState, localPlayerId);

      // Find actions involving this card and collect their targets
      for (const action of actions) {
        if (
          action.type === 'use_ability' &&
          action.sourceInstanceId === cardId
        ) {
          // For abilities, we'd need to determine valid targets based on ability effect
          // For now, just mark it as selected
          // TODO: Implement proper target calculation based on ability
        }
      }
    }

    set((state: GameStore) => ({
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
    set((state: GameStore) => ({
      ui: {
        ...state.ui,
        hoveredCardId: cardId,
      },
    }));
  },

  /**
   * Perform a game action
   * Returns true if action was successful
   */
  performAction: (action: GameAction): boolean => {
    const { gameState } = get();
    if (!gameState) return false;

    // Validate action first
    const validation = validateAction(gameState, action);
    if (!validation.valid) {
      console.warn('Invalid action:', validation.error);
      return false;
    }

    // Apply action
    const result = applyAction(gameState, action);
    if (!result.success) {
      console.error('Failed to apply action:', result.error);
      return false;
    }

    // Update state with new game state
    set({
      gameState: result.newState,
      ui: initialUIState, // Reset UI state after action
    });

    // Log events for debugging/animation triggers
    if (result.events && result.events.length > 0) {
      console.log('Game events:', result.events);
    }

    return true;
  },

  /**
   * Set a pending action that requires target selection
   */
  setPendingAction: (pending: PendingAction | null) => {
    set((state: GameStore) => ({
      ui: {
        ...state.ui,
        pendingAction: pending,
        validTargets: pending?.validTargets || [],
      },
    }));
  },

  /**
   * Check if it's the local player's turn
   */
  isMyTurn: (): boolean => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return false;
    return gameState.activePlayerId === localPlayerId;
  },

  /**
   * Get the local player's state
   */
  getMyPlayer: (): PlayerState | null => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return null;
    return getPlayer(gameState, localPlayerId) || null;
  },

  /**
   * Get the opponent player's state
   */
  getOpponentPlayer: (): PlayerState | null => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return null;
    const opponentId = getOpponentId(gameState, localPlayerId);
    return getPlayer(gameState, opponentId) || null;
  },

  /**
   * Check if an action can be performed
   */
  canPerformAction: (action: GameAction): boolean => {
    const { gameState } = get();
    if (!gameState) return false;
    const validation = validateAction(gameState, action);
    return validation.valid;
  },

  /**
   * Get all valid actions for the local player
   */
  getAvailableActions: (): GameAction[] => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return [];
    return getValidActions(gameState, localPlayerId);
  },
}));

/**
 * Selectors for common patterns
 */

/** Get current game phase */
export const useGamePhase = () =>
  useGameStore((state: GameStore) => state.gameState?.phase);

/** Get current turn phase */
export const useTurnPhase = () =>
  useGameStore((state: GameStore) => state.gameState?.turnPhase);

/** Get if it's local player's turn */
export const useIsMyTurn = () => useGameStore((state: GameStore) => state.isMyTurn());

/** Get local player state */
export const useMyPlayer = () => useGameStore((state: GameStore) => state.getMyPlayer());

/** Get opponent player state */
export const useOpponentPlayer = () =>
  useGameStore((state: GameStore) => state.getOpponentPlayer());

/** Get selected card ID */
export const useSelectedCard = () =>
  useGameStore((state: GameStore) => state.ui.selectedCardId);

/** Get hovered card ID */
export const useHoveredCard = () =>
  useGameStore((state: GameStore) => state.ui.hoveredCardId);

/** Get valid targets for current selection */
export const useValidTargets = () =>
  useGameStore((state: GameStore) => state.ui.validTargets);

/** Get pending action */
export const usePendingAction = () =>
  useGameStore((state: GameStore) => state.ui.pendingAction);

/** Get game winner */
export const useWinner = () =>
  useGameStore((state: GameStore) => state.gameState?.winnerId);
