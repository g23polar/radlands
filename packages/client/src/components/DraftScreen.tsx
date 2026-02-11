import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, useGameMode } from '../stores/gameStore';
import { getCard, type CardId, type CampCard } from '@radlands/core';
import './DraftScreen.css';

/**
 * Draft screen - players select camps in hotseat mode
 */
export function DraftScreen() {
  const gameState = useGameStore((state) => state.gameState);
  const localPlayerId = useGameStore((state) => state.localPlayerId);
  const performAction = useGameStore((state) => state.performAction);
  const setLocalPlayer = useGameStore((state) => state.setLocalPlayer);
  const gameMode = useGameMode();

  const [showPassScreen, setShowPassScreen] = useState(false);
  const isOnline = gameMode === 'online';

  if (!gameState || !localPlayerId) return null;

  const localPlayer = gameState.players[localPlayerId];
  const opponentId = gameState.playerOrder.find((id) => id !== localPlayerId);
  const opponent = opponentId ? gameState.players[opponentId] : null;

  if (!localPlayer || !opponent) return null;

  const draftPool = localPlayer.draftPool || [];
  const selectedCamps = localPlayer.selectedCamps || [];
  const isDraftComplete = selectedCamps.length === 3;

  // Check if opponent has confirmed their draft
  const opponentDraftComplete = (opponent.selectedCamps?.length || 0) === 3;

  const handleSelectCamp = (campId: CardId) => {
    if (isDraftComplete) return;

    // Toggle selection
    if (selectedCamps.includes(campId)) {
      // Deselect
      performAction({
        type: 'select_camp',
        playerId: localPlayerId,
        campId,
      });
    } else {
      // Select
      performAction({
        type: 'select_camp',
        playerId: localPlayerId,
        campId,
      });
    }
  };

  const handleConfirm = () => {
    const success = performAction({
      type: 'confirm_camps',
      playerId: localPlayerId,
    });

    // In online mode, don't show pass screen - just wait for opponent
    // In local mode, show pass screen to switch to other player
    if (success && !opponentDraftComplete && !isOnline) {
      setShowPassScreen(true);
    }
    // If both players are done, the game will transition to playing phase
  };

  const handlePassDevice = () => {
    setShowPassScreen(false);
    // Switch to opponent
    if (opponentId) {
      setLocalPlayer(opponentId);
    }
  };

  // In online mode, show waiting screen after confirming
  const showWaitingForOpponent = isOnline && isDraftComplete && !opponentDraftComplete;

  return (
    <div className="draft-screen screen">
      <AnimatePresence mode="wait">
        {showPassScreen ? (
          <PassDeviceOverlay
            key="pass"
            playerName={opponent.name}
            onContinue={handlePassDevice}
          />
        ) : showWaitingForOpponent ? (
          <WaitingForOpponentOverlay key="waiting" />
        ) : (
          <motion.div
            key="draft"
            className="draft-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="draft-header mb-xl"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              <h2>{localPlayer.name} - Select 3 Camps</h2>
              <p className="text-muted">
                {selectedCamps.length} / 3 selected
              </p>
            </motion.div>

            <div className="camp-grid mb-xl">
              {draftPool.map((campId, index) => {
                const card = getCard(campId) as CampCard | undefined;
                if (!card) return null;

                const isSelected = selectedCamps.includes(campId);

                return (
                  <motion.div
                    key={campId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <CampCard
                      card={card}
                      isSelected={isSelected}
                      onSelect={() => handleSelectCamp(campId)}
                      disabled={isDraftComplete && !isSelected}
                    />
                  </motion.div>
                );
              })}
            </div>

            <motion.button
              className="confirm-button"
              onClick={handleConfirm}
              disabled={!isDraftComplete}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              whileHover={isDraftComplete ? { scale: 1.05 } : {}}
              whileTap={isDraftComplete ? { scale: 0.98 } : {}}
            >
              {isDraftComplete ? 'Confirm Selection' : 'Select 3 Camps'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Individual camp card in draft
 */
interface CampCardProps {
  card: CampCard;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}

function CampCard({ card, isSelected, onSelect, disabled }: CampCardProps) {
  return (
    <motion.div
      className={`camp-card card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={!disabled ? onSelect : undefined}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
    >
      <div className="camp-card-header">
        <h3 className="camp-card-name">{card.name}</h3>
        {card.traits && card.traits.length > 0 && (
          <div className="camp-card-traits">
            {card.traits.map((trait) => (
              <span key={trait} className="trait-badge">
                {trait}
              </span>
            ))}
          </div>
        )}
      </div>

      {card.abilities && card.abilities.length > 0 && (
        <div className="camp-card-abilities">
          {card.abilities.map((ability, index) => (
            <div key={index} className="ability">
              <span className="ability-cost">{ability.cost} water</span>
              <span className="ability-description">{ability.description}</span>
            </div>
          ))}
        </div>
      )}

      {card.flavorText && (
        <p className="camp-card-flavor text-muted">{card.flavorText}</p>
      )}
    </motion.div>
  );
}

/**
 * Pass device overlay between players
 */
interface PassDeviceOverlayProps {
  playerName: string;
  onContinue: () => void;
}

function PassDeviceOverlay({ playerName, onContinue }: PassDeviceOverlayProps) {
  return (
    <motion.div
      className="pass-device-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="pass-device-content"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="mb-lg">Pass Device</h2>
        <p className="text-muted mb-xl">Pass to {playerName}</p>
        <motion.button
          onClick={onContinue}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          Continue
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/**
 * Waiting for opponent overlay (online mode)
 */
function WaitingForOpponentOverlay() {
  return (
    <motion.div
      className="pass-device-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="pass-device-content"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="mb-lg">Camps Selected</h2>
        <p className="text-muted mb-xl">Waiting for opponent to select camps...</p>
        <div className="waiting-spinner" />
      </motion.div>
    </motion.div>
  );
}
