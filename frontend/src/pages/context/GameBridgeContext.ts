import { createRequiredContext } from "./createRequiredContext";

// Mirrors useGameBridgeRefs — lets a locally-running game expose its own
// back/reset behavior up to the global header/dialogs without those pages
// needing to know how each game implements them.
export interface GameBridgeContextValue {
  exposeReturnToGroup: (fn: () => void) => void;
  exposeLocalGameBack: (fn: () => boolean) => void;
  exposeLocalGameReset: (fn: () => void) => void;
}

export const [GameBridgeContext, useGameBridgeContext] = createRequiredContext<GameBridgeContextValue>("GameBridgeContext");
