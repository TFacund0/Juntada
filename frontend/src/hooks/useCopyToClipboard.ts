import { useCallback, useState } from "react";

// Shared by every "tap to copy, show 'Copiado' for a beat" affordance (room/
// group code, invite link, QR dialog's fallback copy) — each of those used
// to hand-repeat the same clipboard write + timed "copied" flag itself.
export function useCopyToClipboard(timeoutMs = 1500) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), timeoutMs);
      } catch {
        /* clipboard unavailable (permissions, insecure context, etc.) — nothing else to do */
      }
    },
    [timeoutMs],
  );

  return { copied, copy };
}
