import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import type { PlayerId, TurnPhase, GamePhase } from '@radlands/core';

export type TransitionType =
  | 'your_turn'
  | 'opponent_turn'
  | 'phase_change'
  | 'game_start'
  | 'game_victory'
  | 'game_defeat';

interface TransitionState {
  showTransition: boolean;
  transitionType: TransitionType | null;
  transitionText: string;
}

/**
 * Hook to detect and trigger turn/phase transition effects
 *
 * Watches the game store for changes in:
 * - Turn ownership (activePlayerId)
 * - Turn phase (events → replenish → actions)
 * - Game phase (draft → playing → ended)
 */
export function useTurnTransition() {
  const [transition, setTransition] = useState<TransitionState>({
    showTransition: false,
    transitionType: null,
    transitionText: '',
  });

  // Track previous values to detect changes
  const prevActivePlayerRef = useRef<PlayerId | null>(null);
  const prevTurnPhaseRef = useRef<TurnPhase | null>(null);
  const prevGamePhaseRef = useRef<GamePhase | null>(null);
  const prevTurnNumberRef = useRef<number>(0);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Subscribe to game store changes
    const unsubscribe = useGameStore.subscribe((state) => {
      const { gameState, localPlayerId } = state;

      if (!gameState || !localPlayerId) {
        isInitializedRef.current = false;
        return;
      }

      const currentActivePlayer = gameState.activePlayerId;
      const currentTurnPhase = gameState.turnPhase;
      const currentGamePhase = gameState.phase;
      const currentTurnNumber = gameState.currentTurn;
      const winnerId = gameState.winnerId;

      // Initialize refs on first load
      if (!isInitializedRef.current) {
        prevActivePlayerRef.current = currentActivePlayer;
        prevTurnPhaseRef.current = currentTurnPhase;
        prevGamePhaseRef.current = currentGamePhase;
        prevTurnNumberRef.current = currentTurnNumber;
        isInitializedRef.current = true;
        return;
      }

      // Check for game start transition
      if (prevGamePhaseRef.current === 'draft' && currentGamePhase === 'playing') {
        setTransition({
          showTransition: true,
          transitionType: 'game_start',
          transitionText: 'GAME START',
        });
        prevGamePhaseRef.current = currentGamePhase;
        return;
      }

      // Check for game end transition
      if (prevGamePhaseRef.current === 'playing' && currentGamePhase === 'ended') {
        const isVictory = winnerId === localPlayerId;
        setTransition({
          showTransition: true,
          transitionType: isVictory ? 'game_victory' : 'game_defeat',
          transitionText: isVictory ? 'VICTORY' : 'DEFEAT',
        });
        prevGamePhaseRef.current = currentGamePhase;
        return;
      }

      // Only process turn/phase changes during active gameplay
      if (currentGamePhase !== 'playing') {
        prevGamePhaseRef.current = currentGamePhase;
        return;
      }

      // Check for turn change (different player)
      if (prevActivePlayerRef.current !== null &&
          prevActivePlayerRef.current !== currentActivePlayer) {
        const isMyTurn = currentActivePlayer === localPlayerId;
        setTransition({
          showTransition: true,
          transitionType: isMyTurn ? 'your_turn' : 'opponent_turn',
          transitionText: isMyTurn ? 'YOUR TURN' : 'OPPONENT\'S TURN',
        });
        prevActivePlayerRef.current = currentActivePlayer;
        prevTurnPhaseRef.current = currentTurnPhase;
        prevTurnNumberRef.current = currentTurnNumber;
        return;
      }

      // Check for phase change within same turn
      if (prevTurnPhaseRef.current !== null &&
          prevTurnPhaseRef.current !== currentTurnPhase &&
          currentActivePlayer === localPlayerId) {

        // Only show phase transitions for meaningful changes
        // Skip 'end' phase as it's too brief
        if (currentTurnPhase !== 'end') {
          const phaseText = getPhaseDisplayText(currentTurnPhase);
          setTransition({
            showTransition: true,
            transitionType: 'phase_change',
            transitionText: phaseText,
          });
        }
        prevTurnPhaseRef.current = currentTurnPhase;
        return;
      }

      // Update refs
      prevActivePlayerRef.current = currentActivePlayer;
      prevTurnPhaseRef.current = currentTurnPhase;
      prevGamePhaseRef.current = currentGamePhase;
      prevTurnNumberRef.current = currentTurnNumber;
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const dismiss = () => {
    setTransition({
      showTransition: false,
      transitionType: null,
      transitionText: '',
    });
  };

  return {
    ...transition,
    dismiss,
  };
}

/**
 * Get display text for a turn phase
 */
function getPhaseDisplayText(phase: TurnPhase): string {
  switch (phase) {
    case 'events':
      return 'EVENTS PHASE';
    case 'replenish':
      return 'REPLENISH PHASE';
    case 'actions':
      return 'ACTIONS PHASE';
    case 'end':
      return 'END PHASE';
    default:
      return '';
  }
}
