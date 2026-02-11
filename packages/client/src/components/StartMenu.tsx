import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import './StartMenu.css';

/**
 * Start menu screen
 * Players enter their names and start a new game
 */
export function StartMenu() {
  const initGame = useGameStore((state) => state.initGame);
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');

  const handleStartGame = () => {
    const p1Name = player1Name.trim() || 'Player 1';
    const p2Name = player2Name.trim() || 'Player 2';
    initGame(p1Name, p2Name);
  };

  const canStart = player1Name.trim().length > 0 || player2Name.trim().length > 0;

  return (
    <div className="start-menu screen">
      <motion.div
        className="start-menu-content"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <motion.h1
          className="title mb-xl"
          initial={{ letterSpacing: '20px', opacity: 0 }}
          animate={{ letterSpacing: '4px', opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          RADLANDS
        </motion.h1>

        <motion.p
          className="subtitle text-center text-muted mb-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Fight for water. Destroy their camps. Survive the wasteland.
        </motion.p>

        <div className="player-inputs mb-xl">
          <div className="input-group mb-md">
            <label htmlFor="player1">Player 1 Name</label>
            <input
              id="player1"
              type="text"
              placeholder="Enter name..."
              value={player1Name}
              onChange={(e) => setPlayer1Name(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canStart) {
                  handleStartGame();
                }
              }}
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="player2">Player 2 Name</label>
            <input
              id="player2"
              type="text"
              placeholder="Enter name..."
              value={player2Name}
              onChange={(e) => setPlayer2Name(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canStart) {
                  handleStartGame();
                }
              }}
            />
          </div>
        </div>

        <motion.button
          className="start-button"
          onClick={handleStartGame}
          disabled={!canStart}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          Start Game
        </motion.button>
      </motion.div>
    </div>
  );
}
