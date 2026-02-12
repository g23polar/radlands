/**
 * Animation Queue
 * Processes game events sequentially with animation effects
 */

import type { GameEvent } from '@radlands/core';
import type { Application } from 'pixi.js';

/** Animation factory function type */
export type AnimationFactory = (event: GameEvent, app: Application) => Promise<void>;

/**
 * Animation Queue Manager
 * Maintains a queue of game events and processes them sequentially
 */
export class AnimationQueue {
  private queue: GameEvent[] = [];
  private isProcessing = false;
  private animationFactories: Map<string, AnimationFactory> = new Map();
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  /**
   * Register an animation factory for a specific event type
   */
  registerAnimation(eventType: string, factory: AnimationFactory): void {
    this.animationFactories.set(eventType, factory);
  }

  /**
   * Enqueue one or more game events
   */
  enqueue(events: GameEvent | GameEvent[]): void {
    const eventArray = Array.isArray(events) ? events : [events];
    this.queue.push(...eventArray);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.process();
    }
  }

  /**
   * Process the queue sequentially
   */
  private async process(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const event = this.queue.shift();
      if (!event) continue;

      const factory = this.animationFactories.get(event.type);
      if (factory) {
        try {
          await factory(event, this.app);
        } catch (error) {
          console.error(`Animation error for event ${event.type}:`, error);
        }
      } else {
        // No animation registered for this event type - skip silently
        console.debug(`No animation registered for event type: ${event.type}`);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Flush the queue (clear all pending events without playing them)
   */
  flush(): void {
    this.queue = [];
  }

  /**
   * Check if animations are currently playing
   */
  get isAnimating(): boolean {
    return this.isProcessing;
  }

  /**
   * Get the number of queued events
   */
  get queueLength(): number {
    return this.queue.length;
  }
}
