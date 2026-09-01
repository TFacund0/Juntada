// Full-screen gate shown while navigator.onLine is false — same "block the
// whole screen instead of a floating banner" call as AppUpdateOverlay, since
// there's genuinely nothing useful to do mid-round without a network. Doesn't
// unmount anything underneath: it's a fixed overlay, so game state stays
// intact and multiplayerSocketService keeps reconnecting on its own once the
// adapter comes back — this screen just disappears when that happens.
export function OfflineScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[3000] flex animate-[jt-offline-screen-fade-in_0.2s_ease-out_both] flex-col items-center justify-center gap-2 bg-[#0f0c1d] p-6 text-center motion-reduce:animate-none"
    >
      <p className="m-0 text-[15px] font-bold text-white">Sin conexión</p>
      <p className="m-0 max-w-[280px] text-[13px] text-[#a49dc9]">Esperando a que vuelva la red. Se reconecta solo apenas la tengas.</p>
    </div>
  );
}
