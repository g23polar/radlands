import { useState, useRef, useEffect } from 'react';
import { getCard, type GameState, type PlayerState, type CardInstanceId } from '@radlands/core';
import { useGameStore, useActionMode } from '../stores/gameStore';
import { CardPreview } from './CardPreview';
import './HandView.css';

interface HandViewProps {
  gameState: GameState;
  player: PlayerState;
}

interface DragState {
  cardId: CardInstanceId;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function HandView({ gameState, player }: HandViewProps) {
  const selectedCardId = useGameStore((state) => state.ui.selectedCardId);
  const actionMode = useActionMode();
  const selectCard = useGameStore((state) => state.selectCard);
  const performAction = useGameStore((state) => state.performAction);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredCard, setHoveredCard] = useState<{ id: CardInstanceId; x: number; y: number } | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);

  const handCount = player.hand.length;
  const isActionInProgress = actionMode !== 'idle';

  // Handle mouse move for drag
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragState((prev) =>
        prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null
      );
    };

    const handleMouseUp = (e: MouseEvent) => {
      handleDragEnd(e.clientX, e.clientY);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDragState(null);
        window.dispatchEvent(new Event('card-drag-end'));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragState]);

  const handleDragStart = (instanceId: CardInstanceId, e: React.MouseEvent) => {
    e.preventDefault();
    setDragState({
      cardId: instanceId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });

    // Dispatch custom event to show drop zones
    window.dispatchEvent(new Event('card-drag-start'));
  };

  const handleDragEnd = (x: number, y: number) => {
    if (!dragState) return;

    const dropResult = getDropTarget(x, y);

    if (dropResult) {
      const instance = gameState.cardInstances[dragState.cardId];
      if (!instance) {
        setDragState(null);
        return;
      }

      const card = getCard(instance.cardId);
      if (!card) {
        setDragState(null);
        return;
      }

      // Execute the appropriate action based on drop target
      if (dropResult.type === 'column') {
        // Determine if it's a person or punk based on water availability
        const isPersonOrEvent = card.type === 'person' || card.type === 'event';
        const cost = isPersonOrEvent ? card.cost : 0;
        const hasEnoughWater = player.water >= cost;

        if (card.type === 'person' && hasEnoughWater) {
          performAction({
            type: 'play_person',
            playerId: player.id,
            cardInstanceId: dragState.cardId,
            columnIndex: dropResult.index as 0 | 1 | 2,
          });
        } else {
          // Play as punk if not enough water or choosing punk
          performAction({
            type: 'play_punk',
            playerId: player.id,
            cardInstanceId: dragState.cardId,
            columnIndex: dropResult.index as 0 | 1 | 2,
          });
        }
      } else if (dropResult.type === 'queue') {
        performAction({
          type: 'play_event',
          playerId: player.id,
          cardInstanceId: dragState.cardId,
          queuePosition: dropResult.index as 0 | 1 | 2,
        });
      } else if (dropResult.type === 'junk') {
        performAction({
          type: 'junk_card',
          playerId: player.id,
          cardInstanceId: dragState.cardId,
        });
      }
    }

    setDragState(null);

    // Dispatch custom event to hide drop zones
    window.dispatchEvent(new Event('card-drag-end'));
  };

  const getDropTarget = (x: number, y: number): { type: 'column' | 'queue' | 'junk'; index?: number } | null => {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;

    // Check for column drop zones
    const columnZone = element.closest('[data-drop-zone="column"]');
    if (columnZone) {
      const index = parseInt(columnZone.getAttribute('data-column-index') || '-1');
      if (index >= 0 && index <= 2) {
        return { type: 'column', index };
      }
    }

    // Check for queue drop zones
    const queueZone = element.closest('[data-drop-zone="queue"]');
    if (queueZone) {
      const index = parseInt(queueZone.getAttribute('data-queue-index') || '-1');
      if (index >= 0 && index <= 2) {
        return { type: 'queue', index };
      }
    }

    // Check for junk zone
    const junkZone = element.closest('[data-drop-zone="junk"]');
    if (junkZone) {
      return { type: 'junk' };
    }

    return null;
  };

  if (handCount === 0) {
    return (
      <div className="hand-panel">
        <div className="hand-header">
          <span>Hand</span>
          <span>0 cards</span>
        </div>
        <div className="hand-empty">No cards in hand</div>
      </div>
    );
  }

  return (
    <>
      <div className="hand-panel">
        <div className="hand-header">
          <span>Hand</span>
          <span>{handCount} {handCount === 1 ? 'card' : 'cards'}</span>
        </div>
        <div className="hand-cards">
          {player.hand.map((instanceId) => {
            const instance = gameState.cardInstances[instanceId];
            if (!instance) return null;

            const card = getCard(instance.cardId);
            if (!card) return null;

            const isSelected = selectedCardId === instanceId;
            const isDragging = dragState?.cardId === instanceId;
            const cost = card.type === 'person' || card.type === 'event' ? card.cost : null;
            const junkIcon = card.type === 'person' || card.type === 'event' ? card.junkIcon : null;
            const description = card.abilities?.[0]?.description ?? card.flavorText ?? '';
            const isDimmed = isActionInProgress && !isSelected;

            return (
              <div
                key={instanceId}
                className={`hand-card card ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''} ${isDragging ? 'dragging' : ''}`}
                onClick={() => selectCard(isSelected ? null : instanceId)}
                onMouseDown={(e) => {
                  if (e.button === 0 && !isActionInProgress) {
                    handleDragStart(instanceId, e);
                  }
                }}
                onMouseEnter={(e) => {
                  if (!isDragging && !isActionInProgress) {
                    setHoveredCard({
                      id: instanceId,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }
                }}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="hand-card-header">
                  <span className="hand-card-name">{card.name}</span>
                  {cost !== null && (
                    <span className="hand-card-cost">{cost}</span>
                  )}
                </div>

                <div className="hand-card-meta">
                  <span className={`hand-card-type type-${card.type}`}>{card.type}</span>
                  {junkIcon && (
                    <span className="hand-card-junk">{junkIcon}</span>
                  )}
                </div>

                {description && (
                  <div className="hand-card-desc">{description}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Drag ghost */}
      {dragState && (() => {
        const instance = gameState.cardInstances[dragState.cardId];
        if (!instance) return null;

        const card = getCard(instance.cardId);
        if (!card) return null;

        return (
          <div
            ref={dragGhostRef}
            className="drag-ghost"
            style={{
              left: dragState.currentX + 10,
              top: dragState.currentY + 10,
            }}
          >
            <div className="drag-ghost-name">{card.name}</div>
            <div className="drag-ghost-type">{card.type}</div>
          </div>
        );
      })()}

      {/* Card preview on hover */}
      {hoveredCard && !dragState && (
        <CardPreview
          gameState={gameState}
          cardInstanceId={hoveredCard.id}
          position={{ x: hoveredCard.x, y: hoveredCard.y }}
        />
      )}
    </>
  );
}
