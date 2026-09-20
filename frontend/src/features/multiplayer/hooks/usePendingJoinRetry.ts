import type { GroupPublicState } from "@juntada/shared-types";
import { getGame } from "../../../games/registry";
import { usePendingActionRetry } from "./usePendingActionRetry";

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
 * "Uniéndose..." instead of looking like nothing happened — the actual
 * retry-on-reconnect/timeout mechanics live in usePendingActionRetry, this
 * just supplies the join-specific payload, settle condition and curtain.
 */
export function usePendingJoinRetry({
  connectionPhase,
  justReconnected,
  group,
  send,
  setError,
  runTransition,
}: UsePendingJoinRetryArgs): UsePendingJoinRetryResult {
  // Settled once the join actually succeeds — connectionPhase moves off
  // "group" (into "lobby"). Deliberately not settled on a generic error:
  // send() itself can flash "Sin conexión con el servidor" in the very same
  // tick as the tap (socket not OPEN yet), and that shouldn't cancel the
  // pending retry-on-reconnect — a genuine server rejection (room filled up,
  // etc.) still surfaces via the error banner and just leaves the button on
  // "Uniéndose..." until the timeout clears it.
  const { pending: pendingJoinCode, perform } = usePendingActionRetry<string>({
    justReconnected,
    settled: connectionPhase !== "group",
    send: roomCode => send({ type: "join_instance", roomCode }),
    onTimeout: () => setError("No se pudo unir a la partida — probá de nuevo"),
  });

  const joinInstance = (roomCode: string) => {
    const targetGame = getGame(group?.instances.find(i => i.roomCode === roomCode)?.gameType ?? "");
    runTransition(() => perform(roomCode), Boolean(targetGame?.gameTheme));
  };

  return { pendingJoinCode, joinInstance };
}
