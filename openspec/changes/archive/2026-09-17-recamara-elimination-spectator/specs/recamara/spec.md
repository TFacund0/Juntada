# Specification: Recámara Elimination Animation & Spectator Chamber View

## Requirements

### Requirement 1: Spectator Chamber View

- In `RoundView.tsx`, an eliminated player (`amAlive === false`) shall participate in the reveal phase beats:
  1. See the `RoundAnnounce` for the round.
  2. Skip `ChestReveal` directly (since they have no items granted).
  3. View the `ChamberCard` with the full bullet icons and countdown timer (`useChamberCountdown`), allowing them to inspect how many live and blank shells were loaded.
  4. On the `ChamberCard`, the control area for eliminated players shall indicate spectator mode (e.g. `Mirando como espectador`) without requiring or blocking on "Listo".
  5. If the alive players all ready up before the spectator's countdown completes, or when the countdown completes, the spectator transitions smoothly to the duel view with the `FlashOverlay`.

### Requirement 2: Dramatic Elimination Visuals & Animation

- When a shot reduces a player's lives to 0 or below (`lives <= 0`):
  1. **Banner announcement**: The `OutcomeBanner` shall display an elimination headline/badge (e.g., `💀 ¡[Jugador] eliminado!`) so all players clearly register the kill.
  2. **Token animation**: The player's token shall play a dramatic death/elimination animation (`rec-token-death`) with red vignette, shake, and fade to a skull/crossed icon indicator.
  3. **Audio/Tactile feel**: The visual cues shall make the elimination feel definitive and high-stakes.
