import "./OfflineScreen.css";

// Full-screen gate shown while navigator.onLine is false — same "block the
// whole screen instead of a floating banner" call as AppUpdateOverlay, since
// there's genuinely nothing useful to do mid-round without a network. Doesn't
// unmount anything underneath: it's a fixed overlay, so game state stays
// intact and multiplayerSocketService keeps reconnecting on its own once the
// adapter comes back — this screen just disappears when that happens.
export function OfflineScreen() {
  return (
    <div className="jt-offline-screen" role="status" aria-live="polite">
      <p className="jt-offline-screen-title">Sin conexión</p>
      <p className="jt-offline-screen-subtitle">Esperando a que vuelva la red. Se reconecta solo apenas la tengas.</p>
    </div>
  );
}
