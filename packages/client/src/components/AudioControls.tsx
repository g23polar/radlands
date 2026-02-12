import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioStore } from '../stores/audioStore';
import './AudioControls.css';

export function AudioControls() {
  const { masterVolume, isMuted, setMasterVolume, toggleMute } = useAudioStore();
  const [showSlider, setShowSlider] = useState(false);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    setMasterVolume(volume);
  };

  return (
    <div
      className="audio-controls"
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      <button
        className="audio-toggle"
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

      <AnimatePresence>
        {showSlider && (
          <motion.div
            className="volume-slider-container"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <input
              type="range"
              className="volume-slider"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={handleVolumeChange}
              aria-label="Volume"
            />
            <span className="volume-label">{Math.round(masterVolume * 100)}%</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
