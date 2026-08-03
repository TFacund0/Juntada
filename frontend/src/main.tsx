import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import { AppUpdateOverlay } from "./components/shell/AppUpdateOverlay";
import { useServiceWorkerUpdate } from "./hooks/useServiceWorkerUpdate";
import { JoinRedirect } from "./features/multiplayer/JoinRedirect";

function Root() {
  const updating = useServiceWorkerUpdate();
  return (
    <>
      {/* /join/:code is the only route that needs its own component
          (JoinRedirect) — every other path (/, /game/:id, /room/:gameId,
          /group, ...) is still handled by App itself, which reads
          location.pathname directly (see useAppNavigation/appRoutes) rather
          than relying on route-matched params. */}
      <Routes>
        <Route path="/join/:code" element={<JoinRedirect />} />
        <Route path="*" element={<App />} />
      </Routes>
      {updating && <AppUpdateOverlay />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>,
);
