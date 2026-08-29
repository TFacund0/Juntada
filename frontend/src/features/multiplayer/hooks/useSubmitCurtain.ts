import { useCallback, useEffect, useRef, useState } from "react";

interface UseSubmitCurtainArgs {
  connectionPhase: string;
  setError: (message: string) => void;
  onTransitionSettled?: () => void;
}

interface UseSubmitCurtainResult {
  submitting: boolean;
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  armSubmitTimeout: (message: string) => void;
  settle: () => void;
}

/**
 * Set the instant "Crear partida"/"Unirse" is tapped, cleared by the same two
 * signals that settle the curtain below — the create/join round-trip can take
 * a moment (slow connection, cold-started server), and without this the
 * button just looked unresponsive, like the tap hadn't done anything at all.
 */
export function useSubmitCurtain({ connectionPhase, setError, onTransitionSettled }: UseSubmitCurtainArgs): UseSubmitCurtainResult {
  const [submitting, setSubmitting] = useState(false);

  // Same safety net as usePendingJoinRetry's joinInstance, for
  // create_room/create_group and join_room/join_group: if the socket drops
  // (or the server never answers) before a "joined"/"group_joined"/"error"
  // comes back, ws.onclose stays silent — it only reconnects/reports once a
  // session (me/groupMe) already exists, which isn't true yet mid-handshake
  // (see useMultiplayerSocket's onclose). Without this, "Creando..."/
  // "Uniéndose..." would stay on screen forever instead of surfacing a
  // retryable error.
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSubmitTimeout = () => {
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
      submitTimeoutRef.current = null;
    }
  };
  const armSubmitTimeout = (message: string) => {
    clearSubmitTimeout();
    submitTimeoutRef.current = setTimeout(() => {
      submitTimeoutRef.current = null;
      setSubmitting(false);
      setError(message);
    }, 8000);
  };
  useEffect(() => clearSubmitTimeout, []);

  // The other half of settling the curtain: a successful create/join lands
  // here once connectionPhase actually leaves the pre-connection screens
  // ("menu"/"create"/"join") for a real destination (lobby, group, or
  // straight into a round on rejoin) — the moment there's something real to
  // reveal instead of the same form the curtain covered.
  useEffect(() => {
    if (!["menu", "create", "join"].includes(connectionPhase)) {
      onTransitionSettled?.();
      setSubmitting(false);
      clearSubmitTimeout();
    }
  }, [connectionPhase, onTransitionSettled]);

  const settle = useCallback(() => {
    onTransitionSettled?.();
    setSubmitting(false);
    clearSubmitTimeout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTransitionSettled]);

  return { submitting, setSubmitting, armSubmitTimeout, settle };
}
