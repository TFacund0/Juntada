import { useCallback, useRef, useState } from "react";

// Shared behavior for a transient validation/error message: setting it to a
// non-empty string bumps `errorKey` (so ErrorBanner's flash animation
// replays even on an identical repeated message, e.g. retrying the same
// duplicate name twice in a row) and auto-clears it after `duration` ms;
// setting it to "" clears immediately.
export function useFlashError(duration = 4000) {
  const [error, setErrorState] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setError = useCallback(
    (message: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setErrorState(message);
      if (message) {
        setErrorKey(k => k + 1);
        timeoutRef.current = setTimeout(() => setErrorState(""), duration);
      }
    },
    [duration],
  );

  return [error, errorKey, setError] as const;
}
