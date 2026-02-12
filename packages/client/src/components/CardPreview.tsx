import { motion, AnimatePresence } from 'framer-motion';
import { getCard, getCardInstance, type GameState, type CardInstanceId } from '@radlands/core';
import './CardPreview.css';

interface CardPreviewProps {
  gameState: GameState;
  cardInstanceId: CardInstanceId | null;
  position: { x: number; y: number };
}

export function CardPreview({ gameState, cardInstanceId, position }: CardPreviewProps) {
  if (!cardInstanceId) return null;

  const instance = getCardInstance(gameState, cardInstanceId);
  if (!instance) return null;

  const card = getCard(instance.cardId);
  if (!card) return null;

  const isPunk = instance.isPunk;
  const isPersonOrEvent = card.type === 'person' || card.type === 'event';
  const cost = isPersonOrEvent ? card.cost : null;
  const junkIcon = isPersonOrEvent ? card.junkIcon : null;

  return (
    <AnimatePresence>
      <motion.div
        className="card-preview"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        style={{
          left: position.x + 20,
          top: position.y + 20,
        }}
      >
        <div className="card-preview-header">
          <h3 className="card-preview-name">{isPunk ? 'PUNK' : card.name}</h3>
          {cost !== null && (
            <span className="card-preview-cost">{cost} water</span>
          )}
        </div>

        <div className="card-preview-type">
          <span className={`type-badge type-${card.type}`}>{card.type}</span>
          {junkIcon && (
            <span className="card-preview-junk">Junk: {junkIcon}</span>
          )}
        </div>

        {!isPunk && (
          <>
            {card.abilities && card.abilities.length > 0 && (
              <div className="card-preview-abilities">
                <h4>Abilities:</h4>
                {card.abilities.map((ability, index) => (
                  <div key={index} className="ability-item">
                    <div className="ability-cost">
                      {ability.cost > 0 ? `${ability.cost} water` : 'Free'}
                    </div>
                    <div className="ability-desc">{ability.description}</div>
                  </div>
                ))}
              </div>
            )}

            {card.traits && card.traits.length > 0 && (
              <div className="card-preview-traits">
                <h4>Traits:</h4>
                <div className="trait-list">
                  {card.traits.map((trait, index) => (
                    <span key={index} className="trait-badge">{trait}</span>
                  ))}
                </div>
              </div>
            )}

            {card.flavorText && (
              <div className="card-preview-flavor">
                {card.flavorText}
              </div>
            )}
          </>
        )}

        {instance.isDamaged && (
          <div className="card-preview-status damaged">Damaged</div>
        )}
        {instance.isReady && !instance.isDamaged && (
          <div className="card-preview-status ready">Ready</div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
