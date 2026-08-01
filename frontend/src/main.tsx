import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppUpdateOverlay } from "./components/shell/AppUpdateOverlay";
import { useServiceWorkerUpdate } from "./hooks/useServiceWorkerUpdate";

function Root() {
  const updating = useServiceWorkerUpdate();
  return (
    <>
      <App />
      {updating && <AppUpdateOverlay />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
