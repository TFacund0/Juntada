import { createRequiredContext } from "./createRequiredContext";

// Mirrors the curtain slice of useStepTransition.
export interface CurtainContextValue {
  curtain: "none" | "out" | "in";
  withCurtain: (action: () => void, themed?: boolean) => void;
  // Broader than useCurtainTransition's own withAsyncCurtain (which calls
  // `action()` with no arguments) — RoomPage/GroupPage call it with a
  // `(settle) => void` action from MultiplayerGame's runTransition, so the
  // value provided here is bridged through a cast at the Provider (see
  // useAppContextValues.ts). Behavior unchanged, just relocated from
  // AppOutletContext.ts.
  withAsyncCurtain: (action: (settle: () => void) => void | Promise<void>, themed?: boolean) => void;
  settleAsyncCurtain: () => void;
}

export const [CurtainContext, useCurtainContext] = createRequiredContext<CurtainContextValue>("CurtainContext");
