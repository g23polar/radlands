import { getCard, type GameState, type PlayerState } from '@radlands/core';
import { useGameStore, useActionMode } from '../stores/gameStore';
import './HandView.css';

interface HandViewProps {
  gameState: GameState;
  player: PlayerState;
}

export function HandView({ gameState, player }: HandViewProps) {
  const selectedCardId = useGameStore((state) => state.ui.selectedCardId);
  const actionMode = useActionMode();
  const selectCard = useGameStore((state) => state.selectCard);

  const handCount = player.hand.length;
  const isActionInProgress = actionMode !== 'idle';

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
          const cost = card.type === 'person' || card.type === 'event' ? card.cost : null;
          const junkIcon = card.type === 'person' || card.type === 'event' ? card.junkIcon : null;
          const description = card.abilities?.[0]?.description ?? card.flavorText ?? '';
          const isDimmed = isActionInProgress && !isSelected;

          return (
            <div
              key={instanceId}
              className={`hand-card card ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''}`}
              onClick={() => selectCard(isSelected ? null : instanceId)}
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
  );
}
