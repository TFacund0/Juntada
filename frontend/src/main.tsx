import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";

// registerType: "autoUpdate" + skipWaiting/clientsClaim (see vite.config.ts)
// makes a newly deployed service worker activate immediately instead of
// waiting for every tab to close. Reloading once it takes control is what
// actually surfaces the new bundle — without this the tab keeps running the
// old JS until the user manually refreshes it enough times to "outlast" the
// stale worker.
registerSW({ immediate: true });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
