# Radlands Animation System

## Overview

The animation system provides visual feedback for game events using an overlay-based approach that works seamlessly with the existing tear-down/rebuild rendering pattern in GameBoard.tsx.

## Architecture

### Core Components

1. **AnimationQueue.ts** - Sequential event processor
   - Maintains a queue of `GameEvent[]`
   - Processes events one at a time (awaits each before starting next)
   - Non-blocking: game state updates immediately, animations play separately
   - Provides `isAnimating` state and queue length

2. **tweenUtils.ts** - Frame-accurate animation utilities
   - Built on PixiJS Ticker for smooth 60fps animations
   - Core functions:
     - `tween()` - Animate properties (x, y, alpha, scale, rotation)
     - `delay()` - Promise-based delays
     - `flash()` - Flash colored overlay on target
     - `particleBurst()` - Particle explosion effect
     - `glowPulse()` - Expanding glow ring
     - `ripple()` - Expanding ripple circle
     - `screenFlash()` - Full-screen flash effect
     - `slideOut()` - Slide object off-screen

3. **animations/index.ts** - Animation factory registry
   - Maps each `GameEventType` to an animation function
   - Factory signature: `(event: GameEvent, app: Application) => Promise<void>`
   - Overlay-based: adds temporary graphics on top, then cleans up

### Overlay Approach

Instead of requiring a persistent scene graph, animations use a temporary overlay:

1. **GameBoard renders** the NEW state immediately (tear-down/rebuild)
2. **Overlay container** persists across renders (added after each render)
3. **Animations play** as temporary effects on the overlay
4. **Cleanup** removes temporary graphics when animation completes

This keeps the existing rendering approach while adding smooth visual feedback.

## Implemented Animations

| Event Type | Animation | Duration |
|------------|-----------|----------|
| `card_played` | Green particle whoosh | 400ms |
| `card_damaged` | Red flash overlay (2x) | 300ms |
| `card_destroyed` | Red particle burst + fade | 500ms |
| `card_restored` | Green glow pulse (2x) | 600ms |
| `card_junked` | Slide off-screen left | 300ms |
| `card_drawn` | Blue glow in hand area | 200ms |
| `water_changed` | Water ripple effect | 400ms |
| `turn_started` | Screen flash + "YOUR TURN" text | 700ms |
| `turn_ended` | Brief red screen flash | 200ms |
| `event_resolved` | Purple flash at queue | 400ms |
| `event_advanced` | Subtle pause | 100ms |
| `punk_created` | Dark particle puff | 400ms |
| `ability_used` | Orange glow pulse (3x) | 750ms |
| `game_ended` | Victory/defeat overlay + burst | 3000ms |

## Integration Points

### GameBoard.tsx
- Creates persistent overlay container on init
- Initializes AnimationQueue with registered animations
- Re-adds overlay after each render
- Processes pendingEvents from store

### gameStore.ts
- Added `pendingEvents: GameEvent[]` field
- Added `clearPendingEvents()` method
- Stores events from `applyAction()` results (local mode)
- Receives events from server via `game:state` socket event (online mode)

### Server handlers.ts
- Updated `game:state` event type to include optional `events` array
- Broadcasts `result.events` along with new state after action

## Usage

### For Game Logic (Core Package)
Return events from `applyAction()`:

```typescript
const result = applyAction(state, action);
// result.events will contain GameEvent[] for animations
```

### For UI Developers
Events automatically trigger animations. To add a new animation:

1. Add the event type to `GameEventType` in `core/types/game.ts`
2. Create an animation function in `animations/index.ts`:
   ```typescript
   async function animateMyEvent(event: GameEvent, app: Application): Promise<void> {
     const overlay = getOverlay(app);
     // Add temporary graphics to overlay
     // Use tween utils for smooth animations
     // Clean up when done
   }
   ```
3. Register it in `registerAllAnimations()`:
   ```typescript
   registerFn('my_event', animateMyEvent);
   ```

### Animation Best Practices

- **Keep animations short** (200-500ms) to not slow gameplay
- **Clean up** temporary graphics after animation completes
- **Use overlay** for all temporary visuals
- **Non-blocking** - user can interact during animations
- **Graceful degradation** - missing animations won't break gameplay

## Customization

### Adjust Animation Speeds
Edit durations in `animations/index.ts`:
```typescript
await particleBurst(overlay, x, y, color, 8, 50, 400); // Last param is duration
```

### Add New Effects
Use the tween utilities to create custom effects:
```typescript
const target = new Graphics();
// ... setup graphics
await tween(target, { alpha: 0, scale: 2 }, 500, Easing.easeOutQuad);
```

### Disable Animations
Set animations to instant completion:
```typescript
async function animateMyEvent() {
  return; // Instant, no animation
}
```

## Performance Notes

- Animations run on requestAnimationFrame via PixiJS Ticker
- Queue processes sequentially to avoid overwhelming GPU
- Temporary graphics are destroyed after use
- No memory leaks from animation lifecycle
- Animations don't block game state updates or user input

## Troubleshooting

**Animations not playing?**
- Check browser console for animation errors
- Verify overlay container exists on stage
- Check that events are in the pendingEvents array

**Animations too slow/fast?**
- Adjust duration parameters in animation functions
- Use different easing functions for feel

**Animations conflicting?**
- Queue ensures sequential processing
- Events are processed in the order they occurred
