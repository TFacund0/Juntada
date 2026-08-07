import { Outlet } from "react-router-dom";
import { AppUpdateOverlay } from "./components/shell/AppUpdateOverlay";
import { useServiceWorkerUpdate } from "./hooks/useServiceWorkerUpdate";

// Shared root route element for the whole tree (see routes.tsx) — keeps the
// service-worker update overlay visible from both App and /join/:code,
// matching the previous main.tsx Root wrapper exactly.
export function RootLayout() {
  const updating = useServiceWorkerUpdate();
  return (
    <>
      <Outlet />
      {updating && <AppUpdateOverlay />}
    </>
  );
}
