import { useEffect, useState } from "react";

// navigator.onLine reflects the OS/browser's network adapter state, not
// actual reachability of our own server — good enough for "the device has no
// network at all" (airplane mode, wifi off), which is the case an
// always-online multiplayer app can't do anything about anyway. Real server
// unreachability while the adapter is "online" is already handled by
// multiplayerSocketService's own reconnect/watchdog logic.
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}
