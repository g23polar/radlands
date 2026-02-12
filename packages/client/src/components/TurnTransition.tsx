import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTurnTransition } from '../hooks/useTurnTransition';
import './TurnTransition.css';

/**
 * TurnTransition Component
 *
 * Displays animated overlays for:
 * - Turn changes (YOUR TURN / OPPONENT'S TURN)
 * - Phase changes (EVENTS PHASE / REPLENISH PHASE / ACTIONS PHASE)
 * - Game start (GAME START)
 * - Game end (VICTORY / DEFEAT)
 *
 * Auto-dismisses after a brief delay. Uses Framer Motion for animations.
 */
export function TurnTransition() {
  const { showTransition, transitionType, transitionText, dismiss } = useTurnTransition();

  useEffect(() => {
    if (showTransition) {
      // Auto-dismiss after delay based on transition type
      let delay = 1500; // Default 1.5s

      if (transitionType === 'phase_change') {
        delay = 1000; // Faster for phase changes (1s)
      } else if (transitionType === 'game_start') {
        delay = 2000; // Longer for game start (2s)
      } else if (transitionType === 'game_victory' || transitionType === 'game_defeat') {
        delay = 3000; // Longest for game end (3s)
      }

      const timer = setTimeout(() => {
        dismiss();
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [showTransition, transitionType, dismiss]);

  // Get CSS class based on transition type
  const getTextClass = (): string => {
    switch (transitionType) {
      case 'your_turn':
        return 'your-turn';
      case 'opponent_turn':
        return 'opponent-turn';
      case 'phase_change':
        return 'phase-change';
      case 'game_start':
        return 'game-start';
      case 'game_victory':
        return 'victory';
      case 'game_defeat':
        return 'defeat';
      default:
        return '';
    }
  };

  // Animation variants for backdrop
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.2,
        ease: 'easeOut',
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: 'easeIn',
      },
    },
  };

  // Animation variants for content
  const contentVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      y: 20,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.175, 0.885, 0.32, 1.1], // Custom easing for bounce effect
      },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: -20,
      transition: {
        duration: 0.2,
        ease: 'easeIn',
      },
    },
  };

  // Animation variants for decorative lines
  const lineVariants = {
    hidden: {
      scaleX: 0,
      opacity: 0,
    },
    visible: {
      scaleX: 1,
      opacity: 0.6,
      transition: {
        duration: 0.4,
        delay: 0.1,
        ease: 'easeOut',
      },
    },
    exit: {
      scaleX: 0,
      opacity: 0,
      transition: {
        duration: 0.2,
        ease: 'easeIn',
      },
    },
  };

  return (
    <AnimatePresence mode="wait">
      {showTransition && (
        <div className="turn-transition-overlay">
          {/* Backdrop */}
          <motion.div
            className="turn-transition-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          />

          {/* Content */}
          <motion.div
            className="turn-transition-content"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Top decorative line */}
            <motion.div
              className="turn-transition-line top"
              variants={lineVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            />

            {/* Main text */}
            <div className={`turn-transition-text ${getTextClass()}`}>
              {transitionText}
            </div>

            {/* Bottom decorative line */}
            <motion.div
              className="turn-transition-line bottom"
              variants={lineVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
