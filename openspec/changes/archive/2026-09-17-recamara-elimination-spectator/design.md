# Design: Recámara Elimination Animation & Spectator Chamber View

## Architectural Changes

### 1. Spectator ChamberCard Integration (`RoundView.tsx`)

Currently:

```tsx
if (!amAlive) {
  return (
    <div className="recamara">
      <div className="table">
        <p className="mono eyebrow">Estás eliminado — mirando la partida</p>
        ...
```

New design:

- When `revealStage === "announce"`, show `RoundAnnounce`. On finish, if `!amAlive` or `round.roundNumber === 1`, set `revealStage = "chamber"`; otherwise `"chests"`.
- If `!amAlive`, when entering the reveal flow, `revealStage` defaults to `"announce"` -> `"chamber"`.
- In `ChamberCard`:
  - If `!amAlive`: Controls show a disabled or informative badge: `<p className="spectator-badge mono">👁️ Modo espectador · Comienza pronto</p>`.
  - Alive players keep their button: `<button className="act primary" onClick={...}>Listo, a disparar</button>`.
- If all alive players send `ready_for_duel` and server switches `subPhase = "duel"`, `useDuelEntryFlash` activates and smoothly moves the spectator to the duel arena!

### 2. Elimination Banner & Outcome (`RoundView.tsx` & `LocalGame.tsx` & `OutcomeBanner.tsx`)

In `OutcomeBanner.tsx`:
Add an optional `eliminatedPlayerName?: string` or `isElimination?: boolean` prop.
When a player is eliminated:
Render an impactful badge or header:

```tsx
{
  isElimination && (
    <div className="elimination-callout">
      <span className="elimination-skull">💀</span>
      <span className="elimination-tag">¡JUGADOR ELIMINADO!</span>
    </div>
  );
}
```

In `RoundView.tsx` and `LocalGame.tsx`:
Detect whether `targetPlayer` had `lives > 0` before and `lives <= 0` after the shot.
Pass `isElimination={true}` to `OutcomeBanner`.

### 3. Token Death Animation (`arena.css`, `motion.css`, `PlayerToken.tsx`)

In `PlayerToken.tsx`:

- Show a small skull `💀` badge or strike when `isDead`.
- If recently dead / when `isDead`, apply CSS class `token dead rec-token-eliminated`.
- In `arena.css`:
  - `.token.dead`: skull overlay, subtle red glow that fades to grayscale ash, strike-through name, broken life dots.
  - `@keyframes rec-token-eliminated`: screen shake, red border pulse, smoke/ash fade.
