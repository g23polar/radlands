/**
 * Main PixiJS GameBoard component for Radlands
 * Uses direct PixiJS integration instead of @pixi/react for reliability
 */

import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js';
import { useGameStore } from '../stores/gameStore';
import type { GameState, PlayerState, CardInstanceId } from '@radlands/core';
import { getCard, getCardInstance } from '@radlands/core';
import { AnimationQueue } from './AnimationQueue';
import { registerAllAnimations } from './animations';

// Constants
const COLORS = {
  background: 0x1a1a2e,
  boardArea: 0x16213e,
  campCard: 0x8b4513,
  personCard: 0x2d4a6f,
  eventCard: 0x4a2d6f,
  punkCard: 0x3d3d3d,
  cardBorder: 0x4a4a4a,
  selectedBorder: 0xffd700,
  validTarget: 0x00ff00,
  targetHighlight: 0xff6600,
  damagedOverlay: 0xff4444,
  readyGlow: 0x44ff44,
  text: 0xffffff,
  textSecondary: 0xaaaaaa,
  water: 0x4488ff,
  emptySlot: 0x2a2a3e,
};

const CARD = {
  width: 80,
  height: 110,
  spacing: 10,
  cornerRadius: 6,
};

interface GameBoardProps {
  width?: number;
  height?: number;
}

export function GameBoard({ width = 1200, height = 800 }: GameBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const overlayRef = useRef<Container | null>(null);
  const animationQueueRef = useRef<AnimationQueue | null>(null);
  const pulseTickerRef = useRef<Ticker | null>(null);

  const gameState = useGameStore((state) => state.gameState);
  const localPlayerId = useGameStore((state) => state.localPlayerId);
  const selectedCardId = useGameStore((state) => state.ui.selectedCardId);
  const selectCard = useGameStore((state) => state.selectCard);
  const actionMode = useGameStore((state) => state.ui.actionMode);
  const validColumns = useGameStore((state) => state.ui.validColumns);
  const validQueueSlots = useGameStore((state) => state.ui.validQueueSlots);
  const validTargets = useGameStore((state) => state.ui.validTargets);
  const selectColumn = useGameStore((state) => state.selectColumn);
  const selectQueueSlot = useGameStore((state) => state.selectQueueSlot);
  const selectTarget = useGameStore((state) => state.selectTarget);
  const pendingEvents = useGameStore((state) => state.pendingEvents);
  const clearPendingEvents = useGameStore((state) => state.clearPendingEvents);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create PixiJS application
    const app = new Application();

    const initApp = async () => {
      await app.init({
        width,
        height,
        backgroundColor: COLORS.background,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (containerRef.current && app.canvas) {
        containerRef.current.appendChild(app.canvas);
        appRef.current = app;

        // Create persistent overlay container for animations
        const overlay = new Container();
        overlay.name = 'animationOverlay';
        overlayRef.current = overlay;

        // Initialize animation queue
        const animQueue = new AnimationQueue(app);
        registerAllAnimations((type, factory) => animQueue.registerAnimation(type, factory));
        animationQueueRef.current = animQueue;

        // Initial render
        renderGame(app, overlay, gameState, localPlayerId, selectedCardId, selectCard, actionMode, validColumns, validQueueSlots, validTargets, selectColumn, selectQueueSlot, selectTarget);
      }
    };

    initApp();

    return () => {
      if (pulseTickerRef.current) {
        pulseTickerRef.current.destroy();
        pulseTickerRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
      overlayRef.current = null;
      animationQueueRef.current = null;
    };
  }, [width, height]);

  // Re-render when game state changes
  useEffect(() => {
    if (appRef.current && overlayRef.current) {
      renderGame(appRef.current, overlayRef.current, gameState, localPlayerId, selectedCardId, selectCard, actionMode, validColumns, validQueueSlots, validTargets, selectColumn, selectQueueSlot, selectTarget);
    }
  }, [gameState, localPlayerId, selectedCardId, selectCard, actionMode, validColumns, validQueueSlots, validTargets, selectColumn, selectQueueSlot, selectTarget]);

  // Process pending animation events
  useEffect(() => {
    if (pendingEvents.length > 0 && animationQueueRef.current) {
      animationQueueRef.current.enqueue(pendingEvents);
      clearPendingEvents();
    }
  }, [pendingEvents, clearPendingEvents]);

  return <div ref={containerRef} style={{ width, height }} />;
}

function renderGame(
  app: Application,
  overlay: Container,
  gameState: GameState | null,
  localPlayerId: string | null,
  selectedCardId: string | null,
  selectCard: (id: string | null) => void,
  actionMode: string,
  validColumns: number[],
  validQueueSlots: number[],
  validTargets: CardInstanceId[],
  selectColumn: (index: 0 | 1 | 2) => void,
  selectQueueSlot: (position: 0 | 1 | 2) => void,
  selectTarget: (targetId: CardInstanceId) => void
) {
  // Clear previous render (but preserve overlay)
  app.stage.removeChildren();

  if (!gameState || !localPlayerId) {
    renderLoadingScreen(app);
    return;
  }

  const localPlayer = gameState.players[localPlayerId];
  const opponentId = gameState.playerOrder.find((id) => id !== localPlayerId);

  if (!localPlayer || !opponentId) {
    renderErrorScreen(app, 'Player not found');
    return;
  }

  const opponentPlayer = gameState.players[opponentId];
  if (!opponentPlayer) {
    renderErrorScreen(app, 'Opponent not found');
    return;
  }

  const centerX = app.screen.width / 2;

  // Draw background grid
  drawBackgroundGrid(app);

  // Draw center divider and phase info
  drawCenterArea(app, gameState, localPlayerId);

  // Draw opponent area (top)
  drawPlayerArea(app, opponentPlayer, gameState, 'top', centerX, 60, selectedCardId, selectCard, actionMode, validColumns, validQueueSlots, validTargets, selectColumn, selectQueueSlot, selectTarget, localPlayerId, false);

  // Draw local player area (bottom)
  drawPlayerArea(app, localPlayer, gameState, 'bottom', centerX, app.screen.height - 280, selectedCardId, selectCard, actionMode, validColumns, validQueueSlots, validTargets, selectColumn, selectQueueSlot, selectTarget, localPlayerId, true);

  // Re-add the overlay container on top of everything
  app.stage.addChild(overlay);
}

function renderLoadingScreen(app: Application) {
  const text = new Text({
    text: 'Initializing game...',
    style: new TextStyle({
      fill: COLORS.text,
      fontSize: 24,
      fontFamily: 'Courier New, monospace',
    }),
  });
  text.anchor.set(0.5);
  text.position.set(app.screen.width / 2, app.screen.height / 2);
  app.stage.addChild(text);
}

function renderErrorScreen(app: Application, message: string) {
  const text = new Text({
    text: `Error: ${message}`,
    style: new TextStyle({
      fill: COLORS.damagedOverlay,
      fontSize: 24,
      fontFamily: 'Courier New, monospace',
    }),
  });
  text.anchor.set(0.5);
  text.position.set(app.screen.width / 2, app.screen.height / 2);
  app.stage.addChild(text);
}

function drawBackgroundGrid(app: Application) {
  const grid = new Graphics();
  grid.setStrokeStyle({ width: 1, color: COLORS.textSecondary, alpha: 0.1 });

  for (let x = 0; x < app.screen.width; x += 50) {
    grid.moveTo(x, 0).lineTo(x, app.screen.height);
  }
  for (let y = 0; y < app.screen.height; y += 50) {
    grid.moveTo(0, y).lineTo(app.screen.width, y);
  }
  grid.stroke();

  app.stage.addChild(grid);
}

function drawCenterArea(app: Application, gameState: GameState, localPlayerId: string) {
  const centerX = app.screen.width / 2;
  const centerY = app.screen.height / 2;

  // Divider line
  const divider = new Graphics();
  divider.setStrokeStyle({ width: 2, color: COLORS.textSecondary, alpha: 0.4 });
  divider.moveTo(50, centerY).lineTo(app.screen.width - 50, centerY);
  divider.stroke();
  app.stage.addChild(divider);

  // Phase text
  const phaseText = new Text({
    text: `${gameState.turnPhase.toUpperCase()} PHASE`,
    style: new TextStyle({
      fill: COLORS.text,
      fontSize: 18,
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
    }),
  });
  phaseText.anchor.set(0.5);
  phaseText.position.set(centerX, centerY - 30);
  app.stage.addChild(phaseText);

  // Turn text
  const turnText = new Text({
    text: `Turn ${gameState.currentTurn}`,
    style: new TextStyle({
      fill: COLORS.textSecondary,
      fontSize: 14,
      fontFamily: 'Courier New, monospace',
    }),
  });
  turnText.anchor.set(0.5);
  turnText.position.set(centerX, centerY);
  app.stage.addChild(turnText);

  // Active player indicator
  const isMyTurn = gameState.activePlayerId === localPlayerId;
  const indicatorBg = new Graphics();
  indicatorBg.roundRect(centerX - 80, centerY + 15, 160, 30, 4);
  indicatorBg.fill({ color: isMyTurn ? COLORS.readyGlow : COLORS.damagedOverlay, alpha: 0.2 });
  indicatorBg.stroke({ color: isMyTurn ? COLORS.readyGlow : COLORS.damagedOverlay, width: 2 });
  app.stage.addChild(indicatorBg);

  const turnIndicator = new Text({
    text: isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN",
    style: new TextStyle({
      fill: isMyTurn ? COLORS.readyGlow : COLORS.damagedOverlay,
      fontSize: 12,
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
    }),
  });
  turnIndicator.anchor.set(0.5);
  turnIndicator.position.set(centerX, centerY + 30);
  app.stage.addChild(turnIndicator);
}

function drawPlayerArea(
  app: Application,
  player: PlayerState,
  gameState: GameState,
  side: 'top' | 'bottom',
  centerX: number,
  y: number,
  selectedCardId: string | null,
  selectCard: (id: string | null) => void,
  actionMode: string,
  validColumns: number[],
  validQueueSlots: number[],
  validTargets: CardInstanceId[],
  selectColumn: (index: 0 | 1 | 2) => void,
  selectQueueSlot: (position: 0 | 1 | 2) => void,
  selectTarget: (targetId: CardInstanceId) => void,
  localPlayerId: string,
  isLocalPlayer: boolean
) {
  const container = new Container();
  container.position.set(0, y);

  // Draw 3 columns
  const columnWidth = CARD.width + CARD.spacing;
  const totalWidth = columnWidth * 3;
  const startX = centerX - totalWidth / 2;

  for (let i = 0; i < 3; i++) {
    const column = player.columns[i];
    if (!column) continue;

    const colX = startX + i * columnWidth + CARD.width / 2;

    // Draw camp
    if (column.campInstanceId) {
      const campY = side === 'top' ? 130 : 0;
      drawCard(
        container,
        column.campInstanceId,
        gameState,
        colX,
        campY,
        'camp',
        selectedCardId,
        selectCard,
        actionMode,
        validTargets,
        selectTarget,
        localPlayerId
      );
    }

    // Draw people (up to 2)
    column.personInstanceIds.forEach((personId, idx) => {
      const personY = side === 'top'
        ? (idx === 0 ? 20 : 70)  // Front person first for opponent
        : (idx === 0 ? 120 : 170); // Front person closer to center for player
      drawCard(
        container,
        personId,
        gameState,
        colX,
        personY,
        'person',
        selectedCardId,
        selectCard,
        actionMode,
        validTargets,
        selectTarget,
        localPlayerId
      );
    });

    // Draw empty column slots if in select_column mode and local player
    if (isLocalPlayer && actionMode === 'select_column' && validColumns.includes(i)) {
      // Find the position for the next person in this column
      const numPeople = column.personInstanceIds.length;
      if (numPeople < 2) {
        const slotY = side === 'bottom'
          ? (numPeople === 0 ? 120 : 170)
          : (numPeople === 0 ? 20 : 70);
        drawColumnSlot(container, colX, slotY, i, selectColumn);
      }
    }
  }

  // Draw event queue (left side)
  const queueX = startX - 120;
  const queueY = side === 'top' ? 80 : 80;
  drawEventQueue(container, player, gameState, queueX, queueY, side, isLocalPlayer, actionMode, validQueueSlots, selectQueueSlot);

  // Draw water counter
  const waterX = centerX + totalWidth / 2 + 60;
  const waterY = side === 'top' ? 80 : 80;

  const waterBg = new Graphics();
  waterBg.circle(0, 0, 30);
  waterBg.fill({ color: COLORS.water, alpha: 0.3 });
  waterBg.stroke({ color: COLORS.water, width: 2 });
  waterBg.position.set(waterX, waterY);
  container.addChild(waterBg);

  const waterText = new Text({
    text: `${player.water}`,
    style: new TextStyle({
      fill: COLORS.water,
      fontSize: 24,
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
    }),
  });
  waterText.anchor.set(0.5);
  waterText.position.set(waterX, waterY);
  container.addChild(waterText);

  // Player name
  const nameText = new Text({
    text: player.name,
    style: new TextStyle({
      fill: COLORS.textSecondary,
      fontSize: 14,
      fontFamily: 'Courier New, monospace',
    }),
  });
  nameText.anchor.set(0.5);
  nameText.position.set(waterX, waterY + 45);
  container.addChild(nameText);

  app.stage.addChild(container);
}

function drawCard(
  container: Container,
  instanceId: string,
  gameState: GameState,
  x: number,
  y: number,
  _location: 'camp' | 'person' | 'hand',
  selectedCardId: string | null,
  selectCard: (id: string | null) => void,
  actionMode: string,
  validTargets: CardInstanceId[],
  selectTarget: (targetId: CardInstanceId) => void,
  localPlayerId: string
) {
  const instance = gameState.cardInstances[instanceId];
  if (!instance) return;

  const card = getCard(instance.cardId);
  const isSelected = selectedCardId === instanceId;
  const isPunk = instance.isPunk;
  const isValidTarget = validTargets.includes(instanceId);
  const isInTargetMode = actionMode === 'select_target';

  // Determine card color
  let cardColor = COLORS.punkCard;
  if (!isPunk && card) {
    switch (card.type) {
      case 'camp': cardColor = COLORS.campCard; break;
      case 'person': cardColor = COLORS.personCard; break;
      case 'event': cardColor = COLORS.eventCard; break;
    }
  }

  const cardContainer = new Container();
  cardContainer.position.set(x, y);
  cardContainer.eventMode = 'static';
  cardContainer.cursor = isInTargetMode && isValidTarget ? 'pointer' : 'default';

  // Click handler
  cardContainer.on('pointerdown', (e) => {
    e.stopPropagation();
    if (isInTargetMode && isValidTarget) {
      selectTarget(instanceId);
    } else {
      selectCard(isSelected ? null : instanceId);
    }
  });

  // Card background
  const bg = new Graphics();
  bg.roundRect(-CARD.width / 2, -CARD.height / 2, CARD.width, CARD.height, CARD.cornerRadius);
  bg.fill({ color: cardColor });

  // Border - handle target highlighting
  let borderColor = COLORS.cardBorder;
  let borderWidth = 1;

  if (isSelected) {
    borderColor = COLORS.selectedBorder;
    borderWidth = 3;
  } else if (isInTargetMode && isValidTarget) {
    // Determine if card is friendly or enemy
    const isFriendly = instance.ownerId === localPlayerId;
    borderColor = isFriendly ? COLORS.validTarget : COLORS.targetHighlight;
    borderWidth = 3;
  }

  bg.stroke({ color: borderColor, width: borderWidth });

  cardContainer.addChild(bg);

  // Dim non-target cards when in target mode
  if (isInTargetMode && !isValidTarget) {
    const dim = new Graphics();
    dim.roundRect(-CARD.width / 2, -CARD.height / 2, CARD.width, CARD.height, CARD.cornerRadius);
    dim.fill({ color: 0x000000, alpha: 0.6 });
    cardContainer.addChild(dim);
  }

  // Animated pulsing glow for valid targets
  if (isInTargetMode && isValidTarget) {
    const isFriendly = instance.ownerId === localPlayerId;
    const glowColor = isFriendly ? COLORS.validTarget : COLORS.targetHighlight;

    // Outer glow that pulses
    const outerGlow = new Graphics();
    outerGlow.roundRect(-CARD.width / 2 - 4, -CARD.height / 2 - 4, CARD.width + 8, CARD.height + 8, CARD.cornerRadius + 2);
    outerGlow.stroke({ color: glowColor, width: 3, alpha: 0.6 });
    cardContainer.addChild(outerGlow);

    // Inner glow (static)
    const innerGlow = new Graphics();
    innerGlow.roundRect(-CARD.width / 2 - 2, -CARD.height / 2 - 2, CARD.width + 4, CARD.height + 4, CARD.cornerRadius + 1);
    innerGlow.stroke({ color: glowColor, width: 1, alpha: 0.8 });
    cardContainer.addChild(innerGlow);

    // Animate the outer glow with a pulsing effect
    let pulseTime = 0;
    const pulseTicker = new Ticker();
    pulseTicker.add(() => {
      pulseTime += 0.05;
      const pulseScale = 1 + Math.sin(pulseTime) * 0.1;
      const pulseAlpha = 0.4 + Math.sin(pulseTime) * 0.3;
      outerGlow.scale.set(pulseScale);
      outerGlow.alpha = pulseAlpha;
    });
    pulseTicker.start();

    // Store ticker for cleanup
    cardContainer.on('destroyed', () => {
      pulseTicker.destroy();
    });

    // Hover effect - brighten on hover
    let hoverGlow: Graphics | null = null;
    cardContainer.on('pointerenter', () => {
      hoverGlow = new Graphics();
      hoverGlow.roundRect(-CARD.width / 2 - 6, -CARD.height / 2 - 6, CARD.width + 12, CARD.height + 12, CARD.cornerRadius + 3);
      hoverGlow.stroke({ color: glowColor, width: 2, alpha: 0.9 });
      cardContainer.addChild(hoverGlow);
    });

    cardContainer.on('pointerleave', () => {
      if (hoverGlow) {
        cardContainer.removeChild(hoverGlow);
        hoverGlow = null;
      }
    });
  }

  // Damaged overlay
  if (instance.isDamaged) {
    const damage = new Graphics();
    damage.roundRect(-CARD.width / 2, -CARD.height / 2, CARD.width, CARD.height, CARD.cornerRadius);
    damage.fill({ color: COLORS.damagedOverlay, alpha: 0.4 });
    cardContainer.addChild(damage);
  }

  // Ready indicator
  if (instance.isReady && !instance.isDamaged) {
    const ready = new Graphics();
    ready.roundRect(-CARD.width / 2 - 2, -CARD.height / 2 - 2, CARD.width + 4, CARD.height + 4, CARD.cornerRadius + 2);
    ready.stroke({ color: COLORS.readyGlow, width: 2, alpha: 0.6 });
    cardContainer.addChild(ready);
  }

  // Card name
  const name = isPunk ? 'PUNK' : (card?.name || '???');
  const nameText = new Text({
    text: name,
    style: new TextStyle({
      fill: COLORS.text,
      fontSize: isPunk ? 12 : 10,
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: CARD.width - 10,
      align: 'center',
    }),
  });
  nameText.anchor.set(0.5);
  nameText.position.set(0, -CARD.height / 2 + 20);
  cardContainer.addChild(nameText);

  // Card type indicator
  if (!isPunk && card) {
    const typeText = new Text({
      text: card.type.toUpperCase(),
      style: new TextStyle({
        fill: COLORS.textSecondary,
        fontSize: 8,
        fontFamily: 'Courier New, monospace',
      }),
    });
    typeText.anchor.set(0.5);
    typeText.position.set(0, CARD.height / 2 - 15);
    cardContainer.addChild(typeText);
  }

  container.addChild(cardContainer);
}

/**
 * Get icon for effect type
 */
function getEffectIcon(effectType: string): string {
  switch (effectType) {
    case 'damage': return '⚔';
    case 'destroy': return '💥';
    case 'restore': return '❤';
    case 'draw': return '🃏';
    case 'water': return '💧';
    case 'punk': return '👤';
    case 'raid': return '🔥';
    case 'ready': return '⚡';
    case 'unready': return '💤';
    default: return '✦';
  }
}

/**
 * Draw event queue for a player
 */
function drawEventQueue(
  container: Container,
  player: PlayerState,
  gameState: GameState,
  x: number,
  y: number,
  _side: 'top' | 'bottom',
  isLocalPlayer: boolean,
  actionMode: string,
  validQueueSlots: number[],
  selectQueueSlot: (position: 0 | 1 | 2) => void
) {
  const queueTitle = new Text({
    text: 'EVENT QUEUE',
    style: new TextStyle({
      fill: 0xd4a574, // Rust accent color
      fontSize: 12,
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
    }),
  });
  queueTitle.anchor.set(0.5);
  queueTitle.position.set(x, y - 50);
  container.addChild(queueTitle);

  // Queue countdown labels and colors
  const countdownLabels = ['RESOLVES NEXT', 'IN 2 TURNS', 'IN 3 TURNS'];
  const countdownColors = [0xff6b6b, 0xffa500, 0xffd700]; // Red -> Orange -> Gold

  // Draw 3 queue slots vertically
  const slotHeight = 65;
  const slotWidth = 90;
  const slotDisplayHeight = 55;

  for (let i = 0; i < 3; i++) {
    const slot = player.eventQueue[i];
    if (!slot) continue;

    const slotY = y + i * slotHeight;

    if (slot.eventInstanceId) {
      // Draw event card
      const instance = getCardInstance(gameState, slot.eventInstanceId);
      if (instance) {
        const card = getCard(instance.cardId);

        const slotContainer = new Container();
        slotContainer.position.set(x, slotY);

        // Outer glow based on countdown
        const glow = new Graphics();
        glow.roundRect(-slotWidth / 2 - 3, -slotDisplayHeight / 2 - 3, slotWidth + 6, slotDisplayHeight + 6, 6);
        glow.stroke({ color: countdownColors[i], width: 2, alpha: 0.4 });
        slotContainer.addChild(glow);

        // Card background
        const bg = new Graphics();
        bg.roundRect(-slotWidth / 2, -slotDisplayHeight / 2, slotWidth, slotDisplayHeight, 4);
        bg.fill({ color: COLORS.eventCard });
        bg.stroke({ color: countdownColors[i], width: 2 });
        slotContainer.addChild(bg);

        // Countdown label at top
        const countdownText = new Text({
          text: countdownLabels[i],
          style: new TextStyle({
            fill: countdownColors[i],
            fontSize: 7,
            fontFamily: 'Courier New, monospace',
            fontWeight: 'bold',
          }),
        });
        countdownText.anchor.set(0.5);
        countdownText.position.set(0, -slotDisplayHeight / 2 + 8);
        slotContainer.addChild(countdownText);

        // Card name
        const name = card?.name || '???';
        const nameText = new Text({
          text: name,
          style: new TextStyle({
            fill: COLORS.text,
            fontSize: 9,
            fontFamily: 'Courier New, monospace',
            fontWeight: 'bold',
            wordWrap: true,
            wordWrapWidth: slotWidth - 10,
            align: 'center',
          }),
        });
        nameText.anchor.set(0.5);
        nameText.position.set(0, 0);
        slotContainer.addChild(nameText);

        // Effect preview (show primary effect type)
        if (card && 'effects' in card && card.effects && card.effects.length > 0) {
          const primaryEffect = card.effects[0];
          if (primaryEffect) {
            const effectIcon = getEffectIcon(primaryEffect.type);
            const effectText = new Text({
              text: effectIcon,
              style: new TextStyle({
                fill: 0xd4a574,
                fontSize: 11,
                fontFamily: 'Courier New, monospace',
              }),
            });
            effectText.anchor.set(0.5);
            effectText.position.set(-slotWidth / 2 + 12, slotDisplayHeight / 2 - 10);
            slotContainer.addChild(effectText);
          }
        }

        // Cost indicator
        if (card && 'cost' in card) {
          const costBg = new Graphics();
          costBg.circle(slotWidth / 2 - 12, slotDisplayHeight / 2 - 10, 8);
          costBg.fill({ color: COLORS.water, alpha: 0.8 });
          slotContainer.addChild(costBg);

          const costText = new Text({
            text: `${card.cost}`,
            style: new TextStyle({
              fill: COLORS.text,
              fontSize: 10,
              fontFamily: 'Courier New, monospace',
              fontWeight: 'bold',
            }),
          });
          costText.anchor.set(0.5);
          costText.position.set(slotWidth / 2 - 12, slotDisplayHeight / 2 - 10);
          slotContainer.addChild(costText);
        }

        container.addChild(slotContainer);
      }
    } else {
      // Draw empty slot with enhanced visuals
      drawQueueSlot(
        container,
        x,
        slotY,
        i,
        isLocalPlayer,
        actionMode,
        validQueueSlots,
        selectQueueSlot,
        countdownLabels[i] || 'EMPTY',
        countdownColors[i] || COLORS.textSecondary
      );
    }
  }
}

/**
 * Draw an empty column slot with highlighting
 */
function drawColumnSlot(
  container: Container,
  x: number,
  y: number,
  columnIndex: number,
  selectColumn: (index: 0 | 1 | 2) => void
) {
  const slotContainer = new Container();
  slotContainer.position.set(x, y);
  slotContainer.eventMode = 'static';
  slotContainer.cursor = 'pointer';

  // Click handler
  slotContainer.on('pointerdown', (e) => {
    e.stopPropagation();
    selectColumn(columnIndex as 0 | 1 | 2);
  });

  // Slot background
  const bg = new Graphics();
  bg.roundRect(-CARD.width / 2, -CARD.height / 2, CARD.width, CARD.height, CARD.cornerRadius);
  bg.fill({ color: COLORS.emptySlot, alpha: 0.5 });
  bg.stroke({ color: COLORS.validTarget, width: 2 });
  slotContainer.addChild(bg);

  // Animated pulsing glow
  const outerGlow = new Graphics();
  outerGlow.roundRect(-CARD.width / 2 - 3, -CARD.height / 2 - 3, CARD.width + 6, CARD.height + 6, CARD.cornerRadius + 2);
  outerGlow.stroke({ color: COLORS.validTarget, width: 2, alpha: 0.6 });
  slotContainer.addChild(outerGlow);

  // Pulse animation
  let pulseTime = 0;
  const pulseTicker = new Ticker();
  pulseTicker.add(() => {
    pulseTime += 0.05;
    const pulseAlpha = 0.3 + Math.sin(pulseTime) * 0.3;
    outerGlow.alpha = pulseAlpha;
  });
  pulseTicker.start();

  slotContainer.on('destroyed', () => {
    pulseTicker.destroy();
  });

  // Hover effect
  let hoverGlow: Graphics | null = null;
  slotContainer.on('pointerenter', () => {
    hoverGlow = new Graphics();
    hoverGlow.roundRect(-CARD.width / 2 - 5, -CARD.height / 2 - 5, CARD.width + 10, CARD.height + 10, CARD.cornerRadius + 3);
    hoverGlow.stroke({ color: COLORS.validTarget, width: 3, alpha: 0.9 });
    slotContainer.addChild(hoverGlow);
  });

  slotContainer.on('pointerleave', () => {
    if (hoverGlow) {
      slotContainer.removeChild(hoverGlow);
      hoverGlow = null;
    }
  });

  // Plus icon
  const plusText = new Text({
    text: '+',
    style: new TextStyle({
      fill: COLORS.validTarget,
      fontSize: 32,
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
    }),
  });
  plusText.anchor.set(0.5);
  plusText.position.set(0, 0);
  slotContainer.addChild(plusText);

  container.addChild(slotContainer);
}

/**
 * Draw an empty queue slot with optional highlighting
 */
function drawQueueSlot(
  container: Container,
  x: number,
  y: number,
  position: number,
  isLocalPlayer: boolean,
  actionMode: string,
  validQueueSlots: number[],
  selectQueueSlot: (position: 0 | 1 | 2) => void,
  countdownLabel: string,
  countdownColor: number
) {
  const isValid = isLocalPlayer && actionMode === 'select_queue_slot' && validQueueSlots.includes(position);
  const slotWidth = 90;
  const slotDisplayHeight = 55;

  const slotContainer = new Container();
  slotContainer.position.set(x, y);

  if (isValid) {
    slotContainer.eventMode = 'static';
    slotContainer.cursor = 'pointer';

    // Click handler
    slotContainer.on('pointerdown', (e) => {
      e.stopPropagation();
      selectQueueSlot(position as 0 | 1 | 2);
    });
  }

  // Outer glow
  const glow = new Graphics();
  glow.roundRect(-slotWidth / 2 - 3, -slotDisplayHeight / 2 - 3, slotWidth + 6, slotDisplayHeight + 6, 6);
  glow.stroke({ color: isValid ? COLORS.validTarget : countdownColor, width: 2, alpha: isValid ? 0.6 : 0.2 });
  slotContainer.addChild(glow);

  // Slot background
  const bg = new Graphics();
  bg.roundRect(-slotWidth / 2, -slotDisplayHeight / 2, slotWidth, slotDisplayHeight, 4);
  bg.fill({ color: COLORS.emptySlot, alpha: isValid ? 0.5 : 0.2 });
  bg.stroke({ color: isValid ? COLORS.validTarget : COLORS.cardBorder, width: isValid ? 2 : 1 });
  slotContainer.addChild(bg);

  // Add animated glow for valid slots
  if (isValid) {
    // Pulse animation
    let pulseTime = 0;
    const pulseTicker = new Ticker();
    pulseTicker.add(() => {
      pulseTime += 0.05;
      const pulseAlpha = 0.3 + Math.sin(pulseTime) * 0.3;
      glow.alpha = pulseAlpha;
    });
    pulseTicker.start();

    slotContainer.on('destroyed', () => {
      pulseTicker.destroy();
    });

    // Hover effect
    let hoverGlow: Graphics | null = null;
    slotContainer.on('pointerenter', () => {
      hoverGlow = new Graphics();
      hoverGlow.roundRect(-slotWidth / 2 - 5, -slotDisplayHeight / 2 - 5, slotWidth + 10, slotDisplayHeight + 10, 7);
      hoverGlow.stroke({ color: COLORS.validTarget, width: 2, alpha: 0.9 });
      slotContainer.addChild(hoverGlow);
    });

    slotContainer.on('pointerleave', () => {
      if (hoverGlow) {
        slotContainer.removeChild(hoverGlow);
        hoverGlow = null;
      }
    });
  }

  // Countdown label at top
  const labelText = new Text({
    text: countdownLabel,
    style: new TextStyle({
      fill: isValid ? COLORS.validTarget : countdownColor,
      fontSize: 7,
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
    }),
  });
  labelText.anchor.set(0.5);
  labelText.position.set(0, -slotDisplayHeight / 2 + 8);
  slotContainer.addChild(labelText);

  // Text
  const text = new Text({
    text: isValid ? '+' : 'EMPTY',
    style: new TextStyle({
      fill: isValid ? COLORS.validTarget : COLORS.textSecondary,
      fontSize: isValid ? 24 : 10,
      fontFamily: 'Courier New, monospace',
      fontWeight: isValid ? 'bold' : 'normal',
    }),
  });
  text.anchor.set(0.5);
  text.position.set(0, 5);
  slotContainer.addChild(text);

  container.addChild(slotContainer);
}
