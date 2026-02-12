import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore, useTurnPhase, useMyPlayer, useIsMyTurn } from '../stores/gameStore';
import { GameBoard } from '../pixi/GameBoard';
import { HandView } from './HandView';
import { ActionPanel } from './ActionPanel';
import { AudioControls } from './AudioControls';
import { TurnTransition } from './TurnTransition';
import { DropZones } from './DropZones';
import { useContainerSize } from '../hooks/useContainerSize';
import './GameScreen.css';

/**
 * Main game screen
 * Contains the PixiJS game board and HUD overlay
 */
export function GameScreen() {
  const gameState = useGameStore((state) => state.gameState);
  const turnPhase = useTurnPhase();
  const myPlayer = useMyPlayer();
  const isMyTurn = useIsMyTurn();
  const performAction = useGameStore((state) => state.performAction);
  const [containerRef, { width, height }] = useContainerSize();
  const [isDragging, setIsDragging] = React.useState(false);

  // Listen for drag events from HandView
  React.useEffect(() => {
    const handleDragStart = () => setIsDragging(true);
    const handleDragEnd = () => setIsDragging(false);

    window.addEventListener('card-drag-start', handleDragStart);
    window.addEventListener('card-drag-end', handleDragEnd);

    return () => {
      window.removeEventListener('card-drag-start', handleDragStart);
      window.removeEventListener('card-drag-end', handleDragEnd);
    };
  }, []);

  if (!gameState || !myPlayer) return null;

  const handleEndTurn = () => {
    performAction({
      type: 'end_turn',
      playerId: myPlayer.id,
    });
  };

  // Phase display names
  const phaseNames: Record<string, string> = {
    events: 'Events Phase',
    replenish: 'Replenish Phase',
    actions: 'Actions Phase',
    end: 'End Phase',
  };

  const phaseName = turnPhase ? phaseNames[turnPhase] : '';

  return (
    <div className="game-screen">
      {/* PixiJS Game Board */}
      <div className="game-board-container" ref={containerRef}>
        <GameBoard width={width} height={height} />
      </div>

      {/* Drop Zones for Drag-and-Drop */}
      <DropZones visible={isDragging} />

      {/* Turn Transition Overlay */}
      <TurnTransition />

      {/* HUD Overlay */}
      <div className="game-hud">
        {/* Top bar - Player info and phase */}
        <motion.div
          className="hud-top"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="player-info">
            <span className="player-name">{myPlayer.name}</span>
            <div className="resource-bar">
              <span className="resource-label">Water:</span>
              <motion.span
                className="resource-value"
                key={myPlayer.water}
                initial={{ scale: 1.5, color: '#CD853F' }}
                animate={{ scale: 1, color: '#e4e4e4' }}
                transition={{ duration: 0.3 }}
              >
                {myPlayer.water}
              </motion.span>
            </div>
            <div className="cards-count">
              <span className="cards-label">Hand:</span>
              <span className="cards-value">{myPlayer.hand.length}</span>
            </div>
          </div>

          <div className="phase-indicator">
            <motion.div
              className={`phase-badge ${isMyTurn ? 'active' : 'waiting'}`}
              key={turnPhase}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              {isMyTurn ? phaseName : 'Opponent Turn'}
            </motion.div>
          </div>

          <div className="hud-top-right">
            <AudioControls />
            <div className="turn-counter">
              <span className="turn-label">Turn</span>
              <span className="turn-value">{gameState.currentTurn}</span>
            </div>
          </div>
        </motion.div>

        {/* Bottom bar - Actions */}
        <motion.div
          className="hud-bottom"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <HandView gameState={gameState} player={myPlayer} />

          <ActionPanel gameState={gameState} playerId={myPlayer.id} />

          <div className="hud-actions">
            {isMyTurn && turnPhase === 'actions' && (
              <motion.button
                className="end-turn-button"
                onClick={handleEndTurn}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                End Turn
              </motion.button>
            )}

            {!isMyTurn && (
              <div className="waiting-message text-muted">
                Waiting for opponent...
              </div>
            )}

            {isMyTurn && turnPhase !== 'actions' && (
              <div className="phase-message">
                {turnPhase === 'events' && 'Resolving events...'}
                {turnPhase === 'replenish' && 'Drawing card and collecting water...'}
                {turnPhase === 'end' && 'Ending turn...'}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
