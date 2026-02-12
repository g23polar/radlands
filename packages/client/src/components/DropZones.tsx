import { useMyPlayer } from '../stores/gameStore';
import './DropZones.css';

interface DropZonesProps {
  visible: boolean;
}

/**
 * Drop zones overlaid on the game board for drag-and-drop
 * Only visible during drag operations
 */
export function DropZones({ visible }: DropZonesProps) {
  const myPlayer = useMyPlayer();

  if (!myPlayer || !visible) return null;

  // Calculate positions based on typical game board layout
  // These should roughly align with the PixiJS rendering positions

  return (
    <div className="drop-zones">
      {/* Column drop zones (3 columns for player) */}
      {[0, 1, 2].map((index) => {
        const column = myPlayer.columns[index];
        const canPlace = column && column.personInstanceIds.length < 2;

        return canPlace ? (
          <div
            key={`column-${index}`}
            className="drop-zone drop-zone-column"
            data-drop-zone="column"
            data-column-index={index}
            style={{
              left: `calc(50% - 135px + ${index * 90}px)`,
              bottom: '280px',
            }}
          />
        ) : null;
      })}

      {/* Event queue drop zones (3 slots) */}
      {[0, 1, 2].map((index) => {
        const slot = myPlayer.eventQueue[index];
        const isEmpty = slot && slot.eventInstanceId === null;

        return isEmpty ? (
          <div
            key={`queue-${index}`}
            className="drop-zone drop-zone-queue"
            data-drop-zone="queue"
            data-queue-index={index}
            style={{
              left: 'calc(50% - 300px)',
              bottom: `calc(280px + ${index * 65}px)`,
            }}
          />
        ) : null;
      })}

      {/* Junk area (bottom right) */}
      <div
        className="drop-zone drop-zone-junk"
        data-drop-zone="junk"
        style={{
          right: '40px',
          bottom: '40px',
        }}
      >
        <div className="drop-zone-label">Junk</div>
      </div>
    </div>
  );
}
