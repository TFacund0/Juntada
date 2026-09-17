# Proposal: Recámara Spectator Chamber View & Elimination Dramatic Animation

## Problem

Currently in Recámara:

1. **Spectators miss the chamber countdown**: When an eliminated player enters the reload/reveal phase, they are immediately shown a waiting screen (_"Estás eliminado — mirando la partida"_) with a checklist of who is ready. They never get to see the shotgun chamber card (`ChamberCard`) showing how many live vs blank shells are loaded for the upcoming round. The spectators should see the chamber card (shells/countdown) just like the alive players, without needing to click "Listo, a disparar" or holding up the round start.
2. **Lack of elimination impact/animation**: When a player loses their last life, their token simply becomes muted (`opacity: 0.4`) and the banner says _"Cartucho real — pierde vida"_. There is no dramatic, visually impactful moment celebrating or dramatizing the elimination (e.g., elimination banner highlight/sound effect/skull badge/shake and death flash animation on the player token).

## Proposed Solution

1. **Spectator ChamberCard View**:
   - In `RoundView.tsx`, eliminated players will follow the normal announcement (`RoundAnnounce`) -> skip chest reveal (since they receive 0 items) -> view the `ChamberCard`.
   - On the `ChamberCard`, eliminated players see the live/blank shell counts and countdown timer, but the action button displays a spectator message or disabled status (_"Mirando la partida"_ or automatically counts down), and the game starts without waiting for them (handled by backend `aliveRoomIds`).
   - Once the chamber countdown finishes or the alive players confirm, the spectator transitions into the duel arena seamlessly.
2. **Elimination Dramatic Animation & Banner**:
   - Detect when a shot eliminates a player (`lives <= 0` where `preShotLives > 0`).
   - In `OutcomeBanner`, if the target was eliminated by the shot, highlight with an `eliminated` badge and dramatic text: e.g. `¡ELIMINADO!` or `💀 ¡[Jugador] ha sido eliminado!`.
   - In `PlayerToken` & CSS (`arena.css` / `motion.css`), add a dramatic elimination visual effect:
     - Skull indicator `💀` on dead tokens.
     - Shake/glitch and red flash animation (`rec-token-eliminated`) when freshly eliminated.
     - Darker, burned or cracked styling for dead players.

## Scope

- `frontend/src/games/recamara/RoundView.tsx`
- `frontend/src/games/recamara/components/ChamberCard.tsx`
- `frontend/src/games/recamara/components/OutcomeBanner.tsx`
- `frontend/src/games/recamara/components/PlayerToken.tsx`
- `frontend/src/games/recamara/css/arena.css`
- `frontend/src/games/recamara/css/overlays.css`
- `frontend/src/games/recamara/css/motion.css`
- Unit tests
