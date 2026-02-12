import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { soundEngine } from '../services/audio';

interface AudioState {
  masterVolume: number;
  sfxVolume: number;
  isMuted: boolean;
  setMasterVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  toggleMute: () => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      masterVolume: 0.7,
      sfxVolume: 1.0,
      isMuted: false,

      setMasterVolume: (volume: number) => {
        const clamped = Math.max(0, Math.min(1, volume));
        soundEngine.setMasterVolume(clamped);
        set({ masterVolume: clamped });
      },

      setSfxVolume: (volume: number) => {
        const clamped = Math.max(0, Math.min(1, volume));
        soundEngine.setSfxVolume(clamped);
        set({ sfxVolume: clamped });
      },

      toggleMute: () => {
        set((state) => {
          const newMuted = !state.isMuted;
          soundEngine.setMuted(newMuted);
          return { isMuted: newMuted };
        });
      },
    }),
    {
      name: 'radlands-audio',
    }
  )
);
