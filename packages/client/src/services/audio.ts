type SoundId =
  | 'card_play'
  | 'card_punk'
  | 'damage_hit'
  | 'card_destroy'
  | 'card_restore'
  | 'card_junk'
  | 'card_draw'
  | 'water_spend'
  | 'water_gain'
  | 'turn_start'
  | 'turn_end'
  | 'event_resolve'
  | 'ability_use'
  | 'victory'
  | 'defeat';

class SoundEngine {
  private context: AudioContext | null = null;
  private buffers: Map<SoundId, AudioBuffer> = new Map();
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private initialized = false;
  private muted = false;

  init(masterVolume = 0.7, sfxVolume = 1.0, muted = false): void {
    if (this.initialized) return;

    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.sfxGain = this.context.createGain();

    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);

    this.masterGain.gain.value = masterVolume;
    this.sfxGain.gain.value = sfxVolume;
    this.muted = muted;

    this.generateAllSounds();
    this.initialized = true;
  }

  private generateAllSounds(): void {
    if (!this.context) return;

    this.buffers.set('card_play', this.generateCardPlay(this.context));
    this.buffers.set('card_punk', this.generateCardPunk(this.context));
    this.buffers.set('damage_hit', this.generateDamageHit(this.context));
    this.buffers.set('card_destroy', this.generateCardDestroy(this.context));
    this.buffers.set('card_restore', this.generateCardRestore(this.context));
    this.buffers.set('card_junk', this.generateCardJunk(this.context));
    this.buffers.set('card_draw', this.generateCardDraw(this.context));
    this.buffers.set('water_spend', this.generateWaterSpend(this.context));
    this.buffers.set('water_gain', this.generateWaterGain(this.context));
    this.buffers.set('turn_start', this.generateTurnStart(this.context));
    this.buffers.set('turn_end', this.generateTurnEnd(this.context));
    this.buffers.set('event_resolve', this.generateEventResolve(this.context));
    this.buffers.set('ability_use', this.generateAbilityUse(this.context));
    this.buffers.set('victory', this.generateVictory(this.context));
    this.buffers.set('defeat', this.generateDefeat(this.context));
  }

  play(soundId: SoundId): void {
    if (!this.initialized || this.muted || !this.context || !this.sfxGain) {
      return;
    }

    const buffer = this.buffers.get(soundId);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.sfxGain);
    source.start(0);
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  setSfxVolume(volume: number): void {
    if (this.sfxGain) {
      this.sfxGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private generateCardPlay(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.25;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noise = (Math.random() * 2 - 1) * 0.3;
      const sine = Math.sin(2 * Math.PI * 200 * t) * 0.7;
      const envelope = Math.exp(-t * 15);
      data[i] = (noise + sine) * envelope * 0.4;
    }
    return buffer;
  }

  private generateCardPunk(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.15;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noise = (Math.random() * 2 - 1) * 0.2;
      const sine = Math.sin(2 * Math.PI * 180 * t) * 0.5;
      const envelope = Math.exp(-t * 20);
      data[i] = (noise + sine) * envelope * 0.3;
    }
    return buffer;
  }

  private generateDamageHit(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.15;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noise = Math.random() * 2 - 1;
      const sine = Math.sin(2 * Math.PI * 200 * t);
      const envelope = Math.exp(-t * 30);
      data[i] = (noise * 0.3 + sine * 0.7) * envelope * 0.5;
    }
    return buffer;
  }

  private generateCardDestroy(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.3;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const freq = 400 - progress * 300;
      const noise = Math.random() * 2 - 1;
      const sine = Math.sin(2 * Math.PI * freq * t);
      const envelope = Math.exp(-t * 8);
      data[i] = (noise * 0.6 + sine * 0.4) * envelope * 0.4;
    }
    return buffer;
  }

  private generateCardRestore(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.2;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const freq = 200 + progress * 600;
      const sine = Math.sin(2 * Math.PI * freq * t);
      const envelope = Math.exp(-t * 10);
      data[i] = sine * envelope * 0.3;
    }
    return buffer;
  }

  private generateCardJunk(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.1;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noise = Math.random() * 2 - 1;
      const envelope = Math.exp(-t * 25);
      data[i] = noise * envelope * 0.3;
    }
    return buffer;
  }

  private generateCardDraw(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.08;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noise = Math.random() * 2 - 1;
      const filtered = noise * (1 - t / duration);
      const envelope = Math.exp(-t * 30);
      data[i] = filtered * envelope * 0.15;
    }
    return buffer;
  }

  private generateWaterSpend(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.15;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noise = (Math.random() * 2 - 1) * 0.3;
      const sine = Math.sin(2 * Math.PI * 300 * t) * 0.7;
      const envelope = Math.exp(-t * 15);
      data[i] = (noise + sine) * envelope * 0.25;
    }
    return buffer;
  }

  private generateWaterGain(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.12;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const sine = Math.sin(2 * Math.PI * 600 * t);
      const envelope = Math.exp(-t * 20);
      data[i] = sine * envelope * 0.25;
    }
    return buffer;
  }

  private generateTurnStart(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.3;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const freq = 880 - progress * 440;
      const sine = Math.sin(2 * Math.PI * freq * t);
      const envelope = Math.exp(-t * 8);
      data[i] = sine * envelope * 0.3;
    }
    return buffer;
  }

  private generateTurnEnd(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.05;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const sine = Math.sin(2 * Math.PI * 200 * t);
      const envelope = Math.exp(-t * 40);
      data[i] = sine * envelope * 0.2;
    }
    return buffer;
  }

  private generateEventResolve(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.4;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const sine = Math.sin(2 * Math.PI * 150 * t);
      const envelope = Math.exp(-t * 5);
      data[i] = sine * envelope * 0.35;
    }
    return buffer;
  }

  private generateAbilityUse(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.1;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const sine = Math.sin(2 * Math.PI * 400 * t);
      const envelope = Math.exp(-t * 25);
      data[i] = sine * envelope * 0.3;
    }
    return buffer;
  }

  private generateVictory(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.5;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      let freq: number;
      if (progress < 0.33) {
        freq = 440;
      } else if (progress < 0.66) {
        freq = 880;
      } else {
        freq = 1320;
      }
      const sine = Math.sin(2 * Math.PI * freq * t);
      const envelope = Math.exp(-t * 4);
      data[i] = sine * envelope * 0.4;
    }
    return buffer;
  }

  private generateDefeat(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const duration = 0.6;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const sine = Math.sin(2 * Math.PI * 100 * t);
      const envelope = Math.exp(-t * 3);
      data[i] = sine * envelope * 0.35;
    }
    return buffer;
  }
}

export const soundEngine = new SoundEngine();
export type { SoundId };
