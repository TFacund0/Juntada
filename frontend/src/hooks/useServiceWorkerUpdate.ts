import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import { onceAppIdle } from "../utils/appActivity";

// registerType "autoUpdate" (see vite.config.ts) only checks for a new sw.js
// on navigation — a tab left open for a while (typical mid-game) never
// notices a deploy on its own. This polls registration.update() instead, so
// an open tab picks up a new version without the player having to reload.
const UPDATE_CHECK_INTERVAL_MS = 60_000;

// skipWaiting + clientsClaim make the new worker take control immediately,
// which would otherwise reload the page in the player's face mid-tap. This
// delay exists purely so AppUpdateOverlay gets a beat on screen first,
// turning that into a deliberate "actualizando" moment instead of a jump
// scare that looks like a crash.
const RELOAD_DELAY_MS = 600;

export function useServiceWorkerUpdate() {
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;

    let cancelIdleWait: (() => void) | undefined;

    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        intervalId = setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
      },
      onNeedReload() {
        // A new worker already has control at this point (skipWaiting +
        // clientsClaim, see vite.config.ts) — reloading is what actually
        // surfaces it, but a round can be over in a few seconds, so firing
        // this the moment it happens would yank the page out from under an
        // active tap/vote/answer far more often than it would ever catch
        // someone idle. Waiting for the app to go idle (menu, lobby, between
        // rounds) means the update sits ready-but-invisible for however long
        // the player keeps playing, then applies on the very next natural
        // pause instead of forcing one.
        cancelIdleWait = onceAppIdle(() => {
          setUpdating(true);
          setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
        });
      },
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      cancelIdleWait?.();
    };
  }, []);

  return updating;
}
