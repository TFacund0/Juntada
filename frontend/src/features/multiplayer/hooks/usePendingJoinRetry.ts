import { useEffect, useRef, useState } from "react";
import type { GroupPublicState } from "@juntada/shared-types";
import { getGame } from "../../../games/registry";

interface UsePendingJoinRetryArgs {
  connectionPhase: string;
  justReconnected: boolean;
  group: GroupPublicState | null;
  send: (msg: Record<string, unknown>) => void;
  setError: (message: string) => void;
  runTransition: (action: () => void, curtain?: boolean) => void;
}

interface UsePendingJoinRetryResult {
  pendingJoinCode: string | null;
  joinInstance: (roomCode: string) => void;
}

/**
 * Tracks a join_instance in flight so the tapped button can show
 * "Uniéndose..." instead of looking like nothing happened — and, since
 * send() silently drops the message if the socket isn't OPEN at the exact
 * moment of the tap (flaky connection, mid-reconnect), gives us something to
 * retry once the socket actually comes back instead of leaving the player
 * stuck restarting the tap themselves.
 */
export function usePendingJoinRetry({
  connectionPhase,
  justReconnected,
  group,
  send,
  setError,
  runTransition,
}: UsePendingJoinRetryArgs): UsePendingJoinRetryResult {
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);
  const pendingJoinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const joinInstance = (roomCode: string) => {
    const targetGame = getGame(group?.instances.find(i => i.roomCode === roomCode)?.gameType ?? "");
    runTransition(() => {
      setPendingJoinCode(roomCode);
      send({ type: "join_instance", roomCode });
      if (pendingJoinTimeoutRef.current) clearTimeout(pendingJoinTimeoutRef.current);
      // Covers the rare case where neither a success (phase leaves "group")
      // nor a server "error" ever comes back — without this the button would
      // stay stuck on "Uniéndose..." forever.
      pendingJoinTimeoutRef.current = setTimeout(() => {
        setPendingJoinCode(null);
        setError("No se pudo unir a la partida — probá de nuevo");
      }, 8000);
    }, Boolean(targetGame?.gameTheme));
  };

  // Cleared once the join actually succeeds — connectionPhase moves off
  // "group" (into "lobby"). Deliberately not cleared on a generic error:
  // send() itself can flash "Sin conexión con el servidor" in the very same
  // tick as the tap (socket not OPEN yet), and that shouldn't cancel the
  // pending retry-on-reconnect below — a genuine server rejection (room
  // filled up, etc.) still surfaces via the error banner and just leaves the
  // button on "Uniéndose..." until the timeout above clears it.
  useEffect(() => {
    if (connectionPhase !== "group") setPendingJoinCode(null);
  }, [connectionPhase]);

  // The tap itself already reached send(), which flashed "Sin conexión con
  // el servidor" and dropped it if the socket wasn't OPEN — retry it once
  // reconnected instead of leaving the player to notice and tap again.
  useEffect(() => {
    if (justReconnected && pendingJoinCode && connectionPhase === "group") send({ type: "join_instance", roomCode: pendingJoinCode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justReconnected]);

  useEffect(
    () => () => {
      if (pendingJoinTimeoutRef.current) clearTimeout(pendingJoinTimeoutRef.current);
    },
    [],
  );

  return { pendingJoinCode, joinInstance };
}
