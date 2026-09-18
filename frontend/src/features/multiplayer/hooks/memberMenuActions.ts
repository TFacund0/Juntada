/**
 * Wraps `onTransferHost`/`onKickMember` so each also closes the member's
 * actions menu after firing — the same pattern PlayerChip.tsx (per-player
 * menu, `onToggleMenu(null)`) and GroupScreen.tsx (single open-menu id,
 * `onTogglePlayerMenu(null)`) both inlined identically before this was
 * extracted. Plain function, not a hook — no internal state/effects — so it
 * can be called conditionally (e.g. GroupScreen's open-menu-member IIFE)
 * without tripping the rules-of-hooks lint.
 */
export function buildMemberMenuActions(
  memberId: string,
  onTransferHost: (id: string) => void,
  onKickMember: (id: string) => void,
  onClose: () => void,
): { transferHost: () => void; kickMember: () => void } {
  return {
    transferHost: () => {
      onTransferHost(memberId);
      onClose();
    },
    kickMember: () => {
      onKickMember(memberId);
      onClose();
    },
  };
}
