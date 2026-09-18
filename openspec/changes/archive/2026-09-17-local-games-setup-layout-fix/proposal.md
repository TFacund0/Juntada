# Proposal: Local Games Setup Layout Fix

## Problem

In local game setup screens (specifically in `quien-soy` and any component using `AddPlayerForm`), the player addition block overflows and breaks layout alignment ("se sobresalen los bloques").

Root causes:

1. In `frontend/src/games/quien-soy/LocalGame.tsx`, `<AddPlayerForm>` (which renders an internal `<div className={T.card}>`) was nested directly inside `<div className={T.card}>` (the player list card). This caused invalid double card nesting, duplicated padding, conflicting margins, and visual overflow outside container bounds.
2. In `frontend/src/components/game-kit/AddPlayerForm.tsx`, the `<input className={clsx(T.input, "flex-1")} />` within `<div className="flex gap-2">` lacked `min-w-0`, causing flex items to overflow their parent containers on narrow mobile viewports.
3. In `frontend/src/games/color-correcto/components/PlayersConfig.tsx`, player row elements lacked `min-w-0` and text truncation on long names.

## Proposed Changes

- **Un-nest `<AddPlayerForm>` in `quien-soy/LocalGame.tsx`**: Render `<AddPlayerForm>` as a sibling to the player list card, wrapped inside a React Fragment under `{setupTab === "players" && (<> ... </React.Fragment>)}`.
- **Add `min-w-0` to flex-1 inputs**: Ensure inputs inside horizontal flex containers in `AddPlayerForm.tsx` and related roster editors do not overflow.
- **Ensure safe text truncation**: In `PlayersConfig.tsx` and `WordsEditor.tsx`, ensure long names or values don't push action buttons off-screen.
