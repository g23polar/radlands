import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { soundEngine } from '../services/audio';
import type { GameState, CardInstanceId } from '@radlands/core';

export function useSoundEffects() {
  const prevStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state) => {
      const currentState = state.gameState;
      const prevState = prevStateRef.current;

      if (!currentState) {
        prevStateRef.current = null;
        return;
      }

      if (!prevState) {
        prevStateRef.current = currentState;
        return;
      }

      if (currentState.phase === 'ended' && prevState.phase !== 'ended') {
        const localPlayerId = useGameStore.getState().localPlayerId;
        if (currentState.winnerId === localPlayerId) {
          soundEngine.play('victory');
        } else if (currentState.winnerId) {
          soundEngine.play('defeat');
        }
      }

      if (currentState.activePlayerId !== prevState.activePlayerId) {
        soundEngine.play('turn_start');
      }

      if (currentState.turnPhase !== prevState.turnPhase) {
        if (currentState.turnPhase === 'end') {
          soundEngine.play('turn_end');
        }
      }

      for (const playerId of currentState.playerOrder) {
        const currentPlayer = currentState.players[playerId];
        const prevPlayer = prevState.players[playerId];

        if (!currentPlayer || !prevPlayer) continue;

        if (currentPlayer.water < prevPlayer.water) {
          soundEngine.play('water_spend');
        } else if (currentPlayer.water > prevPlayer.water) {
          soundEngine.play('water_gain');
        }

        if (currentPlayer.hand.length > prevPlayer.hand.length) {
          soundEngine.play('card_draw');
        }

        const currentBoardCards = new Set<CardInstanceId>();
        for (const col of currentPlayer.columns) {
          if (col.campInstanceId) currentBoardCards.add(col.campInstanceId);
          for (const pid of col.personInstanceIds) {
            currentBoardCards.add(pid);
          }
        }

        const prevBoardCards = new Set<CardInstanceId>();
        for (const col of prevPlayer.columns) {
          if (col.campInstanceId) prevBoardCards.add(col.campInstanceId);
          for (const pid of col.personInstanceIds) {
            prevBoardCards.add(pid);
          }
        }

        for (const cardId of currentBoardCards) {
          if (!prevBoardCards.has(cardId)) {
            const instance = currentState.cardInstances[cardId];
            if (instance?.isPunk) {
              soundEngine.play('card_punk');
            } else {
              soundEngine.play('card_play');
            }
          }
        }

        for (const cardId of prevBoardCards) {
          if (!currentBoardCards.has(cardId)) {
            soundEngine.play('card_destroy');
          }
        }

        for (const cardId of currentBoardCards) {
          const currentInstance = currentState.cardInstances[cardId];
          const prevInstance = prevState.cardInstances[cardId];

          if (currentInstance && prevInstance) {
            if (currentInstance.isDamaged && !prevInstance.isDamaged) {
              soundEngine.play('damage_hit');
            } else if (!currentInstance.isDamaged && prevInstance.isDamaged) {
              soundEngine.play('card_restore');
            }
          }
        }

        const prevJunked = new Set(prevPlayer.discard);
        for (const cardId of currentPlayer.discard) {
          if (!prevJunked.has(cardId)) {
            if (!prevPlayer.hand.includes(cardId)) {
              continue;
            }
            soundEngine.play('card_junk');
          }
        }

        const currentQueueCards = currentPlayer.eventQueue
          .map((slot) => slot.eventInstanceId)
          .filter(Boolean) as CardInstanceId[];
        const prevQueueCards = prevPlayer.eventQueue
          .map((slot) => slot.eventInstanceId)
          .filter(Boolean) as CardInstanceId[];

        if (prevQueueCards.length > currentQueueCards.length) {
          soundEngine.play('event_resolve');
        }
      }

      if (currentState.history.length > prevState.history.length) {
        const latestAction = currentState.history[currentState.history.length - 1];
        if (latestAction?.type === 'use_ability') {
          soundEngine.play('ability_use');
        }
      }

      prevStateRef.current = currentState;
    });

    return unsubscribe;
  }, []);
}
