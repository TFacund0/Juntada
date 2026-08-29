import { useCallback } from "react";

interface UseMemberActionsArgs {
  send: (msg: Record<string, unknown>) => void;
  closePlayerMenu: () => void;
}

interface UseMemberActionsResult {
  transferHost: (targetId: string) => void;
  kickMember: (targetId: string) => void;
  kickPlayer: (targetId: string) => void;
}

/**
 * The three member-action emitters shared by GroupScreen (transferHost,
 * kickMember) and LobbyScreen (transferHost, kickPlayer) — each just sends
 * its message type with the target and closes the player menu, optimistic
 * client-side (no server-ack gating), matching the previous inline closures
 * in MultiplayerGame.tsx exactly. `kick_member` (group) and `kick_player`
 * (room) stay distinct message types on purpose — the domain split between
 * kicking a group member vs. a room player is real, not incidental.
 */
export function useMemberActions({ send, closePlayerMenu }: UseMemberActionsArgs): UseMemberActionsResult {
  const emit = useCallback(
    (type: string) => (targetId: string) => {
      send({ type, targetId });
      closePlayerMenu();
    },
    [send, closePlayerMenu],
  );

  const transferHost = useCallback(emit("transfer_host"), [emit]);
  const kickMember = useCallback(emit("kick_member"), [emit]);
  const kickPlayer = useCallback(emit("kick_player"), [emit]);

  return { transferHost, kickMember, kickPlayer };
}
