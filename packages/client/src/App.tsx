import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore, useGamePhase, useWinner } from './stores/gameStore';
import { StartMenu } from './components/StartMenu';
import { DraftScreen } from './components/DraftScreen';
import { GameScreen } from './components/GameScreen';
import { VictoryScreen } from './components/VictoryScreen';

/**
 * Main application component
 * Routes between different game screens based on game state
 */
export function App() {
  const gameState = useGameStore((state) => state.gameState);
  const phase = useGamePhase();
  const winnerId = useWinner();

  // Determine which screen to show
  let screen: JSX.Element;

  if (!gameState) {
    // No game initialized - show start menu
    screen = <StartMenu key="start" />;
  } else if (phase === 'draft') {
    // Draft phase - players selecting camps
    screen = <DraftScreen key="draft" />;
  } else if (phase === 'playing') {
    // Main game in progress
    screen = <GameScreen key="game" />;
  } else if (phase === 'ended' && winnerId) {
    // Game over
    screen = <VictoryScreen key="victory" winnerId={winnerId} />;
  } else {
    // Fallback (shouldn't happen)
    screen = <StartMenu key="start" />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase || 'start'}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        style={{ width: '100%', height: '100%' }}
      >
        {screen}
      </motion.div>
    </AnimatePresence>
  );
}
