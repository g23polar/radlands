/**
 * Animation factory registry
 * Maps GameEventType to animation functions
 *
 * Uses overlay-based approach: animations add temporary sprites/graphics
 * on top of the existing rendered board, then clean up
 */

import type { GameEvent } from '@radlands/core';
import type { Application } from 'pixi.js';
import { Text, TextStyle, Graphics, Container } from 'pixi.js';
import {
  delay,
  particleBurst,
  flash,
  glowPulse,
  ripple,
  screenFlash,
  tween,
  Easing,
} from '../tweenUtils';

// Color constants (matching GameBoard.tsx)
const COLORS = {
  damagedOverlay: 0xff4444,
  readyGlow: 0x44ff44,
  water: 0x4488ff,
  eventCard: 0x4a2d6f,
  text: 0xffffff,
  validTarget: 0x00ff00,
  targetHighlight: 0xff6600,
};

/** Get the overlay container from the app stage */
function getOverlay(app: Application): Container {
  // The overlay should be added by GameBoard.tsx
  const overlay = app.stage.getChildByName('animationOverlay') as Container;
  if (!overlay) {
    console.warn('Animation overlay not found on stage');
    // Create a temporary container as fallback
    const tempOverlay = new Container();
    tempOverlay.name = 'animationOverlay';
    app.stage.addChild(tempOverlay);
    return tempOverlay;
  }
  return overlay;
}

/**
 * Animation: Card Played
 * Brief "whoosh" particle effect at the card's destination
 */
async function animateCardPlayed(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const { x = app.screen.width / 2, y = app.screen.height / 2 } = event.data as { x?: number; y?: number };

  await particleBurst(overlay, x, y, COLORS.validTarget, 6, 40, 400);
}

/**
 * Animation: Card Damaged
 * Red flash overlay at the card's position
 */
async function animateCardDamaged(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const { x = app.screen.width / 2, y = app.screen.height / 2 } = event.data as { x?: number; y?: number };

  // Create a temporary target at the position for flashing
  const target = new Graphics();
  target.rect(x - 40, y - 55, 80, 110);
  target.fill({ color: 0x000000, alpha: 0 });
  overlay.addChild(target);

  await flash(overlay, target, COLORS.damagedOverlay, 2, 150);

  overlay.removeChild(target);
  target.destroy();
}

/**
 * Animation: Card Destroyed
 * Fade-out + particle burst at the card's last position
 */
async function animateCardDestroyed(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const { x = app.screen.width / 2, y = app.screen.height / 2 } = event.data as { x?: number; y?: number };

  await Promise.all([
    particleBurst(overlay, x, y, COLORS.damagedOverlay, 12, 60, 500),
    delay(200),
  ]);
}

/**
 * Animation: Card Restored
 * Green glow pulse at the card's position
 */
async function animateCardRestored(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const { x = app.screen.width / 2, y = app.screen.height / 2 } = event.data as { x?: number; y?: number };

  const target = new Graphics();
  target.rect(x - 40, y - 55, 80, 110);
  target.fill({ color: 0x000000, alpha: 0 });
  overlay.addChild(target);

  await glowPulse(overlay, target, COLORS.readyGlow, 2, 300);

  overlay.removeChild(target);
  target.destroy();
}

/**
 * Animation: Card Junked
 * Quick fade and slide effect
 */
async function animateCardJunked(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const { x = app.screen.width / 2, y = app.screen.height / 2 } = event.data as { x?: number; y?: number };

  // Create a visual representation that slides away
  const cardVisual = new Graphics();
  cardVisual.roundRect(x - 40, y - 55, 80, 110, 6);
  cardVisual.fill({ color: 0x3d3d3d, alpha: 0.7 });
  overlay.addChild(cardVisual);

  await Promise.all([
    tween(cardVisual, { x: x - 200, alpha: 0 }, 300, Easing.easeInQuad),
  ]);

  overlay.removeChild(cardVisual);
  cardVisual.destroy();
}

/**
 * Animation: Card Drawn
 * Brief highlight glow in the hand area
 */
async function animateCardDrawn(_event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const { playerId } = _event.data as { playerId?: string };

  // Position depends on which player drew
  // Bottom player = local, top = opponent (simplified)
  const y = playerId === 'player1' ? app.screen.height - 100 : 100;
  const x = app.screen.width / 2;

  // Create a temporary target for the glow effect
  const target = new Graphics();
  target.rect(x - 40, y - 20, 80, 40);
  target.fill({ color: 0x000000, alpha: 0 });
  overlay.addChild(target);

  await glowPulse(overlay, target, COLORS.water, 1, 200);

  overlay.removeChild(target);
  target.destroy();
}

/**
 * Animation: Water Changed
 * Ripple effect near the water counter
 */
async function animateWaterChanged(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const { playerId } = event.data as { playerId?: string };

  // Position depends on which player
  const y = playerId === 'player1' ? app.screen.height - 200 : 140;
  const x = app.screen.width / 2 + 200;

  await ripple(overlay, x, y, COLORS.water, 50, 400);
}

/**
 * Animation: Turn Started
 * Screen flash + text overlay
 */
async function animateTurnStarted(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const { playerId } = event.data as { playerId?: string };

  // Create text overlay
  const text = new Text({
    text: playerId === 'player1' ? 'YOUR TURN' : "OPPONENT'S TURN",
    style: new TextStyle({
      fill: COLORS.text,
      fontSize: 48,
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
    }),
  });
  text.anchor.set(0.5);
  text.position.set(app.screen.width / 2, app.screen.height / 2);
  text.alpha = 0;
  overlay.addChild(text);

  // Flash and fade in/out
  await Promise.all([
    screenFlash(overlay, COLORS.readyGlow, 300, 0.2),
    (async () => {
      await tween(text, { alpha: 1 }, 150, Easing.easeOutQuad);
      await delay(400);
      await tween(text, { alpha: 0 }, 150, Easing.easeInQuad);
    })(),
  ]);

  overlay.removeChild(text);
  text.destroy();
}

/**
 * Animation: Turn Ended
 * Brief screen flash
 */
async function animateTurnEnded(_event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  await screenFlash(overlay, COLORS.damagedOverlay, 200, 0.15);
}

/**
 * Animation: Event Resolved
 * Purple flash at the event queue area
 */
async function animateEventResolved(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const { playerId } = event.data as { playerId?: string };

  const y = playerId === 'player1' ? app.screen.height - 200 : 140;
  const x = app.screen.width / 2 - 180;

  // Create a temporary target for the flash effect
  const target = new Graphics();
  target.rect(x - 35, y - 60, 70, 120);
  target.fill({ color: 0x000000, alpha: 0 });
  overlay.addChild(target);

  await flash(overlay, target, COLORS.eventCard, 2, 200);

  overlay.removeChild(target);
  target.destroy();
}

/**
 * Animation: Event Advanced
 * Subtle shift animation in the queue area
 */
async function animateEventAdvanced(_event: GameEvent, _app: Application): Promise<void> {
  await delay(100); // Subtle pause to show movement
}

/**
 * Animation: Punk Created
 * Dark puff effect at destination
 */
async function animatePunkCreated(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const { x = app.screen.width / 2, y = app.screen.height / 2 } = event.data as { x?: number; y?: number };

  await particleBurst(overlay, x, y, 0x3d3d3d, 8, 35, 400);
}

/**
 * Animation: Ability Used
 * Glow ring emanating from the source card
 */
async function animateAbilityUsed(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const { x = app.screen.width / 2, y = app.screen.height / 2 } = event.data as { x?: number; y?: number };

  const target = new Graphics();
  target.rect(x - 40, y - 55, 80, 110);
  target.fill({ color: 0x000000, alpha: 0 });
  overlay.addChild(target);

  await glowPulse(overlay, target, COLORS.targetHighlight, 3, 250);

  overlay.removeChild(target);
  target.destroy();
}

/**
 * Animation: Game Ended
 * Victory/defeat overlay with particle effects
 */
async function animateGameEnded(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const { winnerId, localPlayerId } = event.data as { winnerId?: string; localPlayerId?: string };

  const isVictory = winnerId === localPlayerId;
  const text = new Text({
    text: isVictory ? 'VICTORY!' : 'DEFEAT',
    style: new TextStyle({
      fill: isVictory ? COLORS.readyGlow : COLORS.damagedOverlay,
      fontSize: 64,
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
    }),
  });
  text.anchor.set(0.5);
  text.position.set(app.screen.width / 2, app.screen.height / 2);
  text.alpha = 0;
  overlay.addChild(text);

  // Dramatic entrance
  await Promise.all([
    screenFlash(overlay, isVictory ? COLORS.readyGlow : COLORS.damagedOverlay, 500, 0.4),
    tween(text, { alpha: 1, scale: 1.2 }, 400, Easing.easeOutElastic),
    particleBurst(
      overlay,
      app.screen.width / 2,
      app.screen.height / 2,
      isVictory ? COLORS.readyGlow : COLORS.damagedOverlay,
      16,
      150,
      800
    ),
  ]);

  // Keep text visible
  await delay(2000);
}

/**
 * Register all animation factories
 */
export function registerAllAnimations(
  registerFn: (eventType: string, factory: (event: GameEvent, app: Application) => Promise<void>) => void
): void {
  registerFn('card_played', animateCardPlayed);
  registerFn('card_damaged', animateCardDamaged);
  registerFn('card_destroyed', animateCardDestroyed);
  registerFn('card_restored', animateCardRestored);
  registerFn('card_junked', animateCardJunked);
  registerFn('card_drawn', animateCardDrawn);
  registerFn('water_changed', animateWaterChanged);
  registerFn('turn_started', animateTurnStarted);
  registerFn('turn_ended', animateTurnEnded);
  registerFn('event_resolved', animateEventResolved);
  registerFn('event_advanced', animateEventAdvanced);
  registerFn('punk_created', animatePunkCreated);
  registerFn('ability_used', animateAbilityUsed);
  registerFn('game_ended', animateGameEnded);
}
