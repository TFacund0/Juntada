# Proposal: Recámara Round Transition & State Fixes

## Problem

In Recámara (both local pass-and-play and multiplayer rooms), players experience three UI glitches:

1. **Spent shell leftover**: An ejected shell casing from the previous round remains visible on the arena floor when entering a new duel.
2. **Overlapping round end / duel transition**: When a round finishes and a reload occurs, the "Ronda N terminada" announcement and the duel entry transition / chest phase can clash or overlay awkwardly.
3. **False positive "Inventario lleno"**: In `ChestReveal`, players receive a warning claiming the inventory is full (5/5) or almost full even when they have empty slots, or displaying inaccurate counts.

## Proposed Solution

1. In `shotAnimation.ts`, `RoundView.tsx`, and `LocalGame.tsx`, ensure `lastShell` is cleaned up reliably upon round reload and when mounting/entering the duel arena.
2. In `RoundView.tsx`, gate the duel entry flash and duel transition so they do not overlay the round announcement or active reveal sequence.
3. In `ChestReveal.tsx`, update the warning logic to strictly check whether the inventory is actually full (`player.items.length >= MAX_ITEMS`) and whether items were actually lost due to space constraints (`isFull && total < ITEMS_PER_RELOAD`).

## Scope

- `frontend/src/games/recamara/components/ChestReveal.tsx`
- `frontend/src/games/recamara/hooks/shotAnimation.ts`
- `frontend/src/games/recamara/RoundView.tsx`
- `frontend/src/games/recamara/LocalGame.tsx`
- Unit tests for `ChestReveal` and `shotAnimation`
