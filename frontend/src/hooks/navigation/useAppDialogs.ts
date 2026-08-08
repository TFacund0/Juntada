import { useState } from "react";

/**
 * Estado de las confirmaciones reales de "volver"/"salir" — extraído de
 * useAppNavigation.ts. Los toggles del header (profile menu / rules) NO
 * viven acá, ver useHeaderUI.ts.
 */
export function useAppDialogs() {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // "Volver" from inside a chosen mode (local or online) is one tap away
  // from the round/lobby itself and, unlike "Menú principal", had no
  // confirmation — a mis-tap silently dropped the whole match. Only that
  // branch of goBack is destructive enough to warn about; going back from
  // "elegí local u online" (mode still null) has nothing in progress to lose.
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  // "Volver" mid-match in local mode: always confirms too (see goBack) —
  // separate from showBackConfirm above since confirming here resets the
  // local game back to its players screen instead of exiting local mode.
  const [showLocalResetConfirm, setShowLocalResetConfirm] = useState(false);
  const [showReturnToGroupConfirm, setShowReturnToGroupConfirm] = useState(false);

  return {
    showExitConfirm,
    setShowExitConfirm,
    showBackConfirm,
    setShowBackConfirm,
    showLocalResetConfirm,
    setShowLocalResetConfirm,
    showReturnToGroupConfirm,
    setShowReturnToGroupConfirm,
  };
}
