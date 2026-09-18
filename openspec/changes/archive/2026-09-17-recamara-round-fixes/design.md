# Design: Recámara Round Transition & State Fixes

## Component Changes

### 1. ChestReveal (`frontend/src/games/recamara/components/ChestReveal.tsx`)

Currently:

```tsx
{
  done && total < ITEMS_PER_RELOAD && (
    <p className="chest-full-warning">
      {total === 0
        ? `Inventario lleno (${MAX_ITEMS}/${MAX_ITEMS}) — no pudiste sumar ningún ítem nuevo. Usá alguno para hacer lugar.`
        : `Inventario casi lleno — solo entró ${total} de ${ITEMS_PER_RELOAD} ítems nuevos. Usá alguno para hacer lugar la próxima vez.`}
    </p>
  );
}
```

Problem:
`player.items` is the player's items after reload.
If `total < ITEMS_PER_RELOAD`, but the player had space (or round didn't grant items), it would falsely trigger or print false 5/5 assertions.
Solution:
Check `const isFull = player.items.length >= MAX_ITEMS;`.
Only render the warning when `done && total < ITEMS_PER_RELOAD && isFull`.
Message:

- If `total === 0`: `Inventario lleno (${MAX_ITEMS}/${MAX_ITEMS}) — no pudiste sumar ningún ítem nuevo. Usá alguno para hacer lugar.`
- If `total > 0`: `Inventario lleno (${MAX_ITEMS}/${MAX_ITEMS}) — solo entró ${total} de ${ITEMS_PER_RELOAD} ítems nuevos. Usá alguno para hacer lugar la próxima vez.`

### 2. ShotAnimation hook & RoundView / LocalGame

- In `shotAnimation.ts`:
  Add `clearShell: () => void` or ensure `resetRecoilFlash()` / `resetForNewRound()` explicitly clears `lastShell: null`.
  Specifically in `resetRecoilFlash()`, or in `enterDuel`: when entering duel, ensure `lastShell` is `null` so any stale shell from a prior round or round transition does not appear on the arena floor before a shot is fired.
- In `RoundView.tsx`:
  When round changes (`useEffect` for `round?.roundNumber`), `shotAnim.resetForNewRound()` is called. Also in `continueAfterFire()`, ensure clean state.
  In the idle-aim effect when `round.subPhase === "duel"`, also call `resetRecoilFlash()`.

### 3. Transition Overlap in `RoundView.tsx`

- In `RoundView.tsx`:
  `const { flashing: duelTransition, showDuel } = useDuelEntryFlash(round?.subPhase === "duel", DUEL_TRANSITION_MS);`
  If `round.subPhase === "duel"` arrives while `revealStage === "announce"` or `revealStage === "chests"`:
  Ensure `duelTransition` only triggers / overlays once `revealStage === "chamber"` or when `revealStage` has finished, avoiding flash overlays over "Ronda N Terminada".
