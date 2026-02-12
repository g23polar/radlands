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
  shake,
  shrinkAndFade,
  slideCard,
  Easing,
} from '../tweenUtils';

// Color constants (matching GameBoard.tsx)
const COLORS = {
  damagedOverlay: 0xff4444,
  readyGlow: 0x44ff44,
  water: 0x4488ff,
  eventCard: 0x4a2d6f,
  personCard: 0x2d4a6f,
  text: 0xffffff,
  validTarget: 0x00ff00,
  targetHighlight: 0xff6600,
};

// Card dimensions (matching GameBoard.tsx)
const CARD = {
  width: 80,
  height: 110,
  spacing: 10,
};

/**
 * Calculate card position based on game event data
 * Returns { x, y } for the card's location on screen
 */
function getCardPosition(event: GameEvent, app: Application): { x: number; y: number } {
  const data = event.data as {
    x?: number;
    y?: number;
    playerId?: string;
    columnIndex?: number;
    position?: 'camp' | 'person' | 'hand' | 'deck' | 'queue';
    personIndex?: number;
    queuePosition?: number;
  };

  // If explicit coordinates provided, use them
  if (data.x !== undefined && data.y !== undefined) {
    return { x: data.x, y: data.y };
  }

  const centerX = app.screen.width / 2;
  const isTopPlayer = data.playerId === 'player2' || data.playerId !== 'player1';

  // Calculate based on position type
  if (data.position === 'deck') {
    // Deck position (off-screen right)
    return {
      x: app.screen.width + 100,
      y: isTopPlayer ? 100 : app.screen.height - 200,
    };
  }

  if (data.position === 'hand') {
    // Hand area (bottom center for player1, top for player2)
    return {
      x: centerX,
      y: isTopPlayer ? 50 : app.screen.height - 50,
    };
  }

  if (data.position === 'queue' && data.queuePosition !== undefined) {
    // Event queue position
    const queueX = centerX - 180;
    const queueY = isTopPlayer ? 80 + data.queuePosition * 65 : 360 + data.queuePosition * 65;
    return { x: queueX, y: queueY };
  }

  if (data.columnIndex !== undefined) {
    // Board position (camp or person)
    const columnWidth = CARD.width + CARD.spacing;
    const totalWidth = columnWidth * 3;
    const startX = centerX - totalWidth / 2;
    const colX = startX + data.columnIndex * columnWidth + CARD.width / 2;

    let y: number;
    if (data.position === 'camp') {
      y = isTopPlayer ? 190 : 360;
    } else if (data.position === 'person' && data.personIndex !== undefined) {
      if (isTopPlayer) {
        y = data.personIndex === 0 ? 80 : 130;
      } else {
        y = data.personIndex === 0 ? 480 : 530;
      }
    } else {
      // Default person position
      y = isTopPlayer ? 130 : 480;
    }

    return { x: colX, y };
  }

  // Default fallback to center
  return { x: centerX, y: app.screen.height / 2 };
}

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
 * Card slides from hand to destination with particle effect
 */
async function animateCardPlayed(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const data = event.data as {
    playerId?: string;
    columnIndex?: number;
    position?: 'person' | 'camp' | 'queue';
    queuePosition?: number;
  };

  // Calculate start position (hand)
  const fromPos = getCardPosition(
    { type: 'card_played', data: { ...data, position: 'hand' } },
    app
  );

  // Calculate end position (board)
  const toPos = getCardPosition(event, app);

  // Slide the card from hand to board
  await Promise.all([
    slideCard(overlay, fromPos.x, fromPos.y, toPos.x, toPos.y, COLORS.personCard, 500),
    (async () => {
      await delay(400);
      await particleBurst(overlay, toPos.x, toPos.y, COLORS.validTarget, 6, 40, 300);
    })(),
  ]);
}

/**
 * Animation: Card Damaged
 * Shake + red flash overlay at the card's position
 */
async function animateCardDamaged(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const pos = getCardPosition(event, app);

  // Create a card visual to shake
  const cardVisual = new Graphics();
  cardVisual.roundRect(-CARD.width / 2, -CARD.height / 2, CARD.width, CARD.height, 6);
  cardVisual.fill({ color: COLORS.personCard, alpha: 0.8 });
  cardVisual.stroke({ color: COLORS.damagedOverlay, width: 3 });
  cardVisual.position.set(pos.x, pos.y);
  overlay.addChild(cardVisual);

  // Create flash overlay
  const flashOverlay = new Graphics();
  flashOverlay.roundRect(-CARD.width / 2, -CARD.height / 2, CARD.width, CARD.height, 6);
  flashOverlay.fill({ color: COLORS.damagedOverlay, alpha: 0 });
  flashOverlay.position.set(pos.x, pos.y);
  overlay.addChild(flashOverlay);

  // Shake and flash simultaneously
  await Promise.all([
    shake(cardVisual, 8, 300),
    flash(overlay, flashOverlay, COLORS.damagedOverlay, 2, 150),
  ]);

  // Fade out the visual
  await tween(cardVisual, { alpha: 0 }, 150, Easing.easeOutQuad);

  overlay.removeChild(cardVisual);
  overlay.removeChild(flashOverlay);
  cardVisual.destroy();
  flashOverlay.destroy();
}

/**
 * Animation: Card Destroyed
 * Shrink/fade/rotate + particle burst at the card's last position
 */
async function animateCardDestroyed(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const pos = getCardPosition(event, app);

  // Create a card visual to destroy
  const cardVisual = new Graphics();
  cardVisual.roundRect(-CARD.width / 2, -CARD.height / 2, CARD.width, CARD.height, 6);
  cardVisual.fill({ color: COLORS.personCard, alpha: 0.9 });
  cardVisual.stroke({ color: COLORS.damagedOverlay, width: 2 });
  cardVisual.position.set(pos.x, pos.y);
  overlay.addChild(cardVisual);

  // Shrink and fade with particle burst
  await Promise.all([
    shrinkAndFade(cardVisual, 400),
    (async () => {
      await delay(200);
      await particleBurst(overlay, pos.x, pos.y, COLORS.damagedOverlay, 12, 60, 500);
    })(),
  ]);

  overlay.removeChild(cardVisual);
  cardVisual.destroy();
}

/**
 * Animation: Card Restored
 * Green glow pulse + brief scale bounce at the card's position
 */
async function animateCardRestored(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const pos = getCardPosition(event, app);

  // Create a card visual to animate
  const cardVisual = new Graphics();
  cardVisual.roundRect(-CARD.width / 2, -CARD.height / 2, CARD.width, CARD.height, 6);
  cardVisual.fill({ color: COLORS.personCard, alpha: 0.7 });
  cardVisual.stroke({ color: COLORS.readyGlow, width: 3 });
  cardVisual.position.set(pos.x, pos.y);
  overlay.addChild(cardVisual);

  const target = new Graphics();
  target.rect(pos.x - 40, pos.y - 55, 80, 110);
  target.fill({ color: 0x000000, alpha: 0 });
  overlay.addChild(target);

  // Glow pulse with scale bounce
  await Promise.all([
    glowPulse(overlay, target, COLORS.readyGlow, 2, 300),
    (async () => {
      await tween(cardVisual, { scale: 1.15 }, 150, Easing.easeOutQuad);
      await tween(cardVisual, { scale: 1.0, alpha: 0 }, 150, Easing.easeInQuad);
    })(),
  ]);

  overlay.removeChild(target);
  overlay.removeChild(cardVisual);
  target.destroy();
  cardVisual.destroy();
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
 * Card slides from deck to hand with glow effect
 */
async function animateCardDrawn(event: GameEvent, app: Application): Promise<void> {
  const overlay = getOverlay(app);
  const data = event.data as { playerId?: string };

  // Calculate start position (deck - off screen right)
  const fromPos = getCardPosition(
    { type: 'card_drawn', data: { ...data, position: 'deck' } },
    app
  );

  // Calculate end position (hand)
  const toPos = getCardPosition(
    { type: 'card_drawn', data: { ...data, position: 'hand' } },
    app
  );

  // Slide card from deck to hand
  await Promise.all([
    slideCard(overlay, fromPos.x, fromPos.y, toPos.x, toPos.y, COLORS.personCard, 600),
    (async () => {
      await delay(500);
      // Create a temporary target for the glow effect at destination
      const target = new Graphics();
      target.rect(toPos.x - 40, toPos.y - 20, 80, 40);
      target.fill({ color: 0x000000, alpha: 0 });
      overlay.addChild(target);

      await glowPulse(overlay, target, COLORS.water, 1, 200);

      overlay.removeChild(target);
      target.destroy();
    })(),
  ]);
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
