/**
 * Main PixiJS GameBoard component for Radlands
 * Uses direct PixiJS integration instead of @pixi/react for reliability
 */

import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useGameStore } from '../stores/gameStore';
import type { GameState, PlayerState } from '@radlands/core';
import { getCard } from '@radlands/core';

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
  damagedOverlay: 0xff4444,
  readyGlow: 0x44ff44,
  text: 0xffffff,
  textSecondary: 0xaaaaaa,
  water: 0x4488ff,
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
  const gameState = useGameStore((state) => state.gameState);
  const localPlayerId = useGameStore((state) => state.localPlayerId);
  const selectedCardId = useGameStore((state) => state.ui.selectedCardId);
  const selectCard = useGameStore((state) => state.selectCard);

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

        // Initial render
        renderGame(app, gameState, localPlayerId, selectedCardId, selectCard);
      }
    };

    initApp();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
    };
  }, [width, height]);

  // Re-render when game state changes
  useEffect(() => {
    if (appRef.current) {
      renderGame(appRef.current, gameState, localPlayerId, selectedCardId, selectCard);
    }
  }, [gameState, localPlayerId, selectedCardId]);

  return <div ref={containerRef} style={{ width, height }} />;
}

function renderGame(
  app: Application,
  gameState: GameState | null,
  localPlayerId: string | null,
  selectedCardId: string | null,
  selectCard: (id: string | null) => void
) {
  // Clear previous render
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
  drawPlayerArea(app, opponentPlayer, gameState, 'top', centerX, 60, selectedCardId, selectCard);

  // Draw local player area (bottom)
  drawPlayerArea(app, localPlayer, gameState, 'bottom', centerX, app.screen.height - 280, selectedCardId, selectCard);

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
  selectCard: (id: string | null) => void
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
        selectCard
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
        selectCard
      );
    });
  }

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
  selectCard: (id: string | null) => void
) {
  const instance = gameState.cardInstances[instanceId];
  if (!instance) return;

  const card = getCard(instance.cardId);
  const isSelected = selectedCardId === instanceId;
  const isPunk = instance.isPunk;

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
  cardContainer.cursor = 'pointer';

  // Click handler
  cardContainer.on('pointerdown', (e) => {
    e.stopPropagation();
    selectCard(isSelected ? null : instanceId);
  });

  // Card background
  const bg = new Graphics();
  bg.roundRect(-CARD.width / 2, -CARD.height / 2, CARD.width, CARD.height, CARD.cornerRadius);
  bg.fill({ color: cardColor });

  // Border
  const borderColor = isSelected ? COLORS.selectedBorder : COLORS.cardBorder;
  const borderWidth = isSelected ? 3 : 1;
  bg.stroke({ color: borderColor, width: borderWidth });

  cardContainer.addChild(bg);

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
