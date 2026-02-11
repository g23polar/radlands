import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import type { PlayerId } from '@radlands/core';
import './VictoryScreen.css';

/**
 * Victory screen shown when game ends
 */
interface VictoryScreenProps {
  winnerId: PlayerId;
}

export function VictoryScreen({ winnerId }: VictoryScreenProps) {
  const gameState = useGameStore((state) => state.gameState);
  const initGame = useGameStore((state) => state.initGame);

  if (!gameState) return null;

  const winner = gameState.players[winnerId];
  const endReason = gameState.endReason;

  if (!winner) return null;

  const handlePlayAgain = () => {
    // Get both player names from current game
    const [player1Id, player2Id] = gameState.playerOrder;
    const player1 = gameState.players[player1Id];
    const player2 = gameState.players[player2Id];

    if (player1 && player2) {
      initGame(player1.name, player2.name);
    }
  };

  // End reason messages
  const endReasonText: Record<string, string> = {
    camps_destroyed: 'All camps destroyed',
    deck_out: 'Opponent ran out of cards',
    concede: 'Opponent conceded',
  };

  const reasonText = endReason ? endReasonText[endReason] : '';

  return (
    <div className="victory-screen screen">
      <motion.div
        className="victory-content"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Victory banner */}
        <motion.div
          className="victory-banner mb-xl"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
        >
          <h1 className="victory-title">VICTORY</h1>
        </motion.div>

        {/* Winner info */}
        <motion.div
          className="winner-info mb-xl"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 150 }}
        >
          <p className="winner-label text-muted">Winner</p>
          <h2 className="winner-name">{winner.name}</h2>
          {reasonText && (
            <p className="victory-reason text-muted">{reasonText}</p>
          )}
        </motion.div>

        {/* Game stats */}
        <motion.div
          className="game-stats mb-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="stat">
            <span className="stat-label">Turns Played</span>
            <span className="stat-value">{gameState.currentTurn}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Cards Remaining</span>
            <span className="stat-value">{winner.deck.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Final Water</span>
            <span className="stat-value">{winner.water}</span>
          </div>
        </motion.div>

        {/* Play again button */}
        <motion.button
          className="play-again-button"
          onClick={handlePlayAgain}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          Play Again
        </motion.button>
      </motion.div>

      {/* Particle effects */}
      <div className="victory-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="particle"
            initial={{
              x: '50vw',
              y: '50vh',
              scale: 0,
              opacity: 1,
            }}
            animate={{
              x: `${Math.random() * 100}vw`,
              y: `${Math.random() * 100}vh`,
              scale: Math.random() * 2,
              opacity: 0,
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              delay: 0.5 + Math.random() * 0.5,
              ease: 'easeOut',
            }}
          />
        ))}
      </div>
    </div>
  );
}
