import { Spinner } from "../ui/Spinner";
import "./AppUpdateOverlay.css";

// Full-screen gate shown for the brief window between a new service worker
// taking control (see useServiceWorkerUpdate) and the reload that surfaces
// it — without this the reload just happens in the player's face with no
// explanation, mid-tap, looking like a crash instead of a deploy. Same
// "block the whole screen instead of a floating banner" call as
// SessionRecoveryOverlay, but its own component: this fires from outside
// the multiplayer socket entirely, on every screen (menu, local game,
// mid-round), not just while connected to a room.
export function AppUpdateOverlay() {
  return (
    <div className="jt-app-update-overlay" role="status" aria-live="polite">
      <Spinner size={40} />
      <p>Actualizando la app...</p>
    </div>
  );
}
