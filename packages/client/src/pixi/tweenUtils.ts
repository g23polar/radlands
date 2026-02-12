/**
 * Simple tween/animation utilities for PixiJS
 * Built on PixiJS Ticker for frame-accurate animations
 * All functions return Promises for easy sequencing
 */

import { Ticker, Container, Graphics, Text } from 'pixi.js';

/** Type for tweenable display objects */
export type TweenableObject = Container | Graphics | Text;

/** Easing function type */
export type EasingFunction = (t: number) => number;

/** Common easing functions */
export const Easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
  },
  easeOutElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  },
};

/** Properties that can be tweened */
export interface TweenableProps {
  x?: number;
  y?: number;
  alpha?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  scale?: number; // Sets both scaleX and scaleY
}

/**
 * Tween a display object's properties over time
 */
export function tween(
  target: TweenableObject,
  props: TweenableProps,
  duration: number,
  easing: EasingFunction = Easing.linear
): Promise<void> {
  return new Promise((resolve) => {
    const startProps: Record<string, number> = {};
    const endProps: Record<string, number> = {};

    // Store start values and prepare end values
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined) continue;

      if (key === 'scale') {
        // Special handling for unified scale
        startProps.scaleX = target.scale.x;
        startProps.scaleY = target.scale.y;
        endProps.scaleX = value;
        endProps.scaleY = value;
      } else {
        const currentValue = (target as any)[key] as number;
        startProps[key] = currentValue;
        endProps[key] = value;
      }
    }

    let elapsed = 0;
    const ticker = Ticker.shared;

    const update = (deltaTime: Ticker) => {
      elapsed += deltaTime.deltaMS;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      // Update all properties
      for (const key of Object.keys(endProps)) {
        const start = startProps[key];
        const end = endProps[key];
        if (start !== undefined && end !== undefined) {
          const current = start + (end - start) * easedProgress;
          (target as any)[key] = current;
        }
      }

      if (progress >= 1) {
        ticker.remove(update);
        resolve();
      }
    };

    ticker.add(update);
  });
}

/**
 * Simple promise delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flash a colored overlay on a target
 */
export async function flash(
  parent: Container,
  target: TweenableObject,
  color: number,
  times: number = 3,
  duration: number = 100
): Promise<void> {
  const { Graphics } = await import('pixi.js');
  const bounds = target.getBounds();
  const overlay = new Graphics();

  overlay.rect(bounds.x, bounds.y, bounds.width, bounds.height);
  overlay.fill({ color, alpha: 0 });
  parent.addChild(overlay);

  for (let i = 0; i < times; i++) {
    await tween(overlay, { alpha: 0.6 }, duration / 2, Easing.easeOutQuad);
    await tween(overlay, { alpha: 0 }, duration / 2, Easing.easeInQuad);
  }

  parent.removeChild(overlay);
  overlay.destroy();
}

/**
 * Create a simple particle burst effect
 */
export async function particleBurst(
  parent: Container,
  x: number,
  y: number,
  color: number,
  count: number = 8,
  radius: number = 50,
  duration: number = 500
): Promise<void> {
  const { Graphics } = await import('pixi.js');
  const particles: InstanceType<typeof Graphics>[] = [];

  for (let i = 0; i < count; i++) {
    const particle = new Graphics();
    particle.circle(0, 0, 3);
    particle.fill({ color });
    particle.position.set(x, y);
    parent.addChild(particle);
    particles.push(particle);

    const angle = (i / count) * Math.PI * 2;
    const targetX = x + Math.cos(angle) * radius;
    const targetY = y + Math.sin(angle) * radius;

    // Animate outward with fade
    tween(particle, { x: targetX, y: targetY, alpha: 0 }, duration, Easing.easeOutQuad);
  }

  await delay(duration);

  // Cleanup
  for (const particle of particles) {
    parent.removeChild(particle);
    particle.destroy();
  }
}

/**
 * Create a glow pulse effect
 */
export async function glowPulse(
  parent: Container,
  target: TweenableObject,
  color: number,
  pulses: number = 2,
  duration: number = 300
): Promise<void> {
  const { Graphics } = await import('pixi.js');
  const bounds = target.getBounds();
  const glow = new Graphics();

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const maxRadius = Math.max(bounds.width, bounds.height) * 0.8;

  glow.circle(centerX, centerY, 0);
  glow.fill({ color, alpha: 0 });
  parent.addChild(glow);

  for (let i = 0; i < pulses; i++) {
    // Reset for each pulse
    glow.clear();
    glow.circle(centerX, centerY, 0);
    glow.fill({ color, alpha: 0.6 });

    // Expand and fade
    await Promise.all([
      tween(glow, { alpha: 0 }, duration, Easing.easeOutQuad),
      new Promise<void>((resolve) => {
        let elapsed = 0;
        const ticker = Ticker.shared;
        const update = (deltaTime: Ticker) => {
          elapsed += deltaTime.deltaMS;
          const progress = Math.min(elapsed / duration, 1);
          const radius = maxRadius * Easing.easeOutQuad(progress);

          glow.clear();
          glow.circle(centerX, centerY, radius);
          glow.fill({ color, alpha: 0.6 * (1 - progress) });

          if (progress >= 1) {
            ticker.remove(update);
            resolve();
          }
        };
        ticker.add(update);
      }),
    ]);

    if (i < pulses - 1) {
      await delay(50);
    }
  }

  parent.removeChild(glow);
  glow.destroy();
}

/**
 * Slide a target off-screen
 */
export async function slideOut(
  target: TweenableObject,
  direction: 'left' | 'right' | 'up' | 'down',
  distance: number = 500,
  duration: number = 300
): Promise<void> {
  const endX = target.x + (direction === 'left' ? -distance : direction === 'right' ? distance : 0);
  const endY = target.y + (direction === 'up' ? -distance : direction === 'down' ? distance : 0);

  await tween(target, { x: endX, y: endY, alpha: 0 }, duration, Easing.easeInQuad);
}

/**
 * Create a ripple effect
 */
export async function ripple(
  parent: Container,
  x: number,
  y: number,
  color: number,
  maxRadius: number = 60,
  duration: number = 600
): Promise<void> {
  const { Graphics } = await import('pixi.js');
  const ripple = new Graphics();

  ripple.circle(x, y, 0);
  ripple.stroke({ color, width: 3, alpha: 0.8 });
  parent.addChild(ripple);

  let elapsed = 0;
  const ticker = Ticker.shared;

  await new Promise<void>((resolve) => {
    const update = (deltaTime: Ticker) => {
      elapsed += deltaTime.deltaMS;
      const progress = Math.min(elapsed / duration, 1);
      const radius = maxRadius * Easing.easeOutCubic(progress);
      const alpha = 0.8 * (1 - progress);

      ripple.clear();
      ripple.circle(x, y, radius);
      ripple.stroke({ color, width: 3, alpha });

      if (progress >= 1) {
        ticker.remove(update);
        resolve();
      }
    };
    ticker.add(update);
  });

  parent.removeChild(ripple);
  ripple.destroy();
}

/**
 * Screen flash effect
 */
export async function screenFlash(
  parent: Container,
  color: number,
  duration: number = 200,
  maxAlpha: number = 0.3
): Promise<void> {
  const { Graphics } = await import('pixi.js');
  const flash = new Graphics();

  flash.rect(0, 0, parent.width || 1200, parent.height || 800);
  flash.fill({ color, alpha: 0 });
  parent.addChild(flash);

  await tween(flash, { alpha: maxAlpha }, duration / 2, Easing.easeOutQuad);
  await tween(flash, { alpha: 0 }, duration / 2, Easing.easeInQuad);

  parent.removeChild(flash);
  flash.destroy();
}
