import { motion, AnimatePresence } from 'framer-motion';
import { getCard, getCardInstance, type GameState, type PlayerId } from '@radlands/core';
import {
  useGameStore,
  useActionMode,
  usePendingActionType,
  useSelectedCard,
  useMyPlayer,
} from '../stores/gameStore';
import './ActionPanel.css';

interface ActionPanelProps {
  gameState: GameState;
  playerId: PlayerId;
}

export function ActionPanel({ gameState }: ActionPanelProps) {
  const actionMode = useActionMode();
  const pendingActionType = usePendingActionType();
  const selectedCardId = useSelectedCard();
  const myPlayer = useMyPlayer();
  const startAction = useGameStore((state) => state.startAction);
  const cancelAction = useGameStore((state) => state.cancelAction);

  // Don't render if no action is in progress
  if (actionMode === 'idle' || !selectedCardId || !myPlayer) {
    return null;
  }

  const instance = getCardInstance(gameState, selectedCardId);
  if (!instance) return null;

  const card = getCard(instance.cardId);
  if (!card) return null;

  // If in select_action mode, show action buttons
  if (actionMode === 'select_action') {
    const isPersonOrEvent = card.type === 'person' || card.type === 'event';
    const cost = isPersonOrEvent ? card.cost : 0;
    const junkIcon = isPersonOrEvent ? card.junkIcon : null;
    const hasEnoughWater = myPlayer.water >= cost;

    return (
      <AnimatePresence>
        <motion.div
          className="action-panel"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="action-panel-header">
            <span className="action-panel-title">Choose Action</span>
            <span className="action-panel-card-name">{card.name}</span>
          </div>

          <div className="action-panel-buttons">
            {/* Play as Person/Event */}
            {isPersonOrEvent && (
              <button
                className="action-button action-button-play"
                onClick={() => startAction(card.type === 'person' ? 'play_person' : 'play_event')}
                disabled={!hasEnoughWater}
              >
                <span className="action-button-label">
                  Play {card.type === 'person' ? 'Person' : 'Event'}
                </span>
                <span className="action-button-cost">{cost} water</span>
              </button>
            )}

            {/* Play as Punk */}
            <button
              className="action-button action-button-punk"
              onClick={() => startAction('play_punk')}
            >
              <span className="action-button-label">Play as Punk</span>
              <span className="action-button-cost">Free</span>
            </button>

            {/* Junk */}
            {junkIcon && (
              <button
                className="action-button action-button-junk"
                onClick={() => startAction('junk')}
              >
                <span className="action-button-label">Junk</span>
                <span className="action-button-icon">{junkIcon}</span>
              </button>
            )}

            {/* Cancel */}
            <button
              className="action-button action-button-cancel"
              onClick={cancelAction}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // If in target/column/slot selection mode, show instruction
  let instructionText = '';
  if (actionMode === 'select_column') {
    instructionText = 'Select a column to place this card...';
  } else if (actionMode === 'select_queue_slot') {
    instructionText = 'Select a queue slot for this event...';
  } else if (actionMode === 'select_target') {
    if (pendingActionType === 'junk') {
      const junkIcon = (card.type === 'person' || card.type === 'event') ? card.junkIcon : null;
      if (junkIcon === 'damage') {
        instructionText = 'Select a target to damage...';
      } else if (junkIcon === 'raid') {
        instructionText = 'Select an enemy camp to raid...';
      } else if (junkIcon === 'restore') {
        instructionText = 'Select a damaged card to restore...';
      } else {
        instructionText = 'Select a target...';
      }
    } else if (pendingActionType === 'use_ability') {
      instructionText = 'Select a target for this ability...';
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="action-panel action-panel-instruction"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="action-instruction-text">{instructionText}</div>
        <button className="action-button action-button-cancel" onClick={cancelAction}>
          Cancel
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
