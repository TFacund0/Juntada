# Specification: Recámara Round Transitions and Inventory Fixes

## Requirements

### Requirement 1: Spent Shell Cleanliness

- When starting a round or mounting the duel arena, no spent shell (`lastShell`) shall be displayed on the arena floor from prior rounds or shots before a new shot has been fired in the active duel.
- `shotAnim.resetForNewRound()` and/or `resetRecoilFlash()` shall ensure shell state is clear when settling into duel or when resetting round state.

### Requirement 2: Clean Phase Sequencing (No Overlaps)

- In `RoundView.tsx`, when `round.subPhase === "duel"`, duel flash (`FlashOverlay text="A disparar"`) shall only display if the player is not currently viewing the `announce` or active `chests` stage.
- In `RoundAnnounce.tsx`, the completion callback `onDone` transitions into `chests` or `chamber` smoothly without clipping or double overlays.

### Requirement 3: Accurate Inventory Warning in ChestReveal

- The "Inventario lleno" warning in `ChestReveal.tsx` shall ONLY be shown when:
  1. The chest opening is finished (`done === true`).
  2. The reload yielded fewer items than `ITEMS_PER_RELOAD` (`total < ITEMS_PER_RELOAD`).
  3. The player's inventory is genuinely at capacity (`player.items.length >= MAX_ITEMS`).
- If `total === 0` and `player.items.length >= MAX_ITEMS`, the full warning (`Inventario lleno (MAX/MAX)`) is displayed.
- If `total > 0` and `player.items.length >= MAX_ITEMS` (e.g. inventory held 4 items, got 1, reached 5), it correctly notes that only `total` of `ITEMS_PER_RELOAD` could fit and inventory is full.
- Under no circumstances shall an "Inventario lleno" or "Inventario casi lleno" warning be displayed if `player.items.length < MAX_ITEMS`.
