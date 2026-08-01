import { Component } from "react";
import type { ReactNode } from "react";
import { Btn } from "../ui/Btn";
import { AlertIcon } from "../ui/icons";
import "./GameLoadErrorBoundary.css";

// Every game's LocalGame/ConfigPanel/RoundView is React.lazy() (see
// games/*/index.tsx) — a dynamic import() that fails throws inside the
// Suspense boundary in App.tsx, and with no ErrorBoundary anywhere in the
// app that used to unmount the whole tree to a blank white screen with no
// way back short of force-quitting.
//
// It's a lot more likely to actually happen now that useServiceWorkerUpdate
// deliberately delays reloading a new deploy until the player goes idle: a
// long session can end up navigating to a game whose chunk was never
// fetched yet, while the server (already on the new deploy) no longer has
// that old-hashed file — a plain 404 on the dynamic import, distinct from
// "the game genuinely crashed while rendering".
const CHUNK_ERROR_PATTERN = /fetch dynamically imported module|error loading dynamically imported module|failed to fetch/i;

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_ERROR_PATTERN.test(message);
}

interface State {
  error: Error | null;
  isChunkError: boolean;
}

export class GameLoadErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, isChunkError: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error) {
    // A stale chunk 404 has nothing to show the player either way — the
    // file just doesn't exist anymore — so there's no "try rendering the
    // fallback" value in staying put like the generic-crash case does.
    // Reloading picks up the new deploy's index.html/manifest, which is the
    // only thing that actually fixes it.
    if (isChunkLoadError(error)) window.location.reload();
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="jt-game-load-error">
        <span className="jt-game-load-error-icon" aria-hidden>
          <AlertIcon size={22} color="var(--jt-danger-text, #f09595)" />
        </span>
        <p className="jt-game-load-error-title">
          {this.state.isChunkError ? "Hay una versión nueva disponible" : "Hubo un problema cargando el juego"}
        </p>
        <p className="jt-game-load-error-subtitle">
          {this.state.isChunkError ? "Actualizando la página..." : "Puede ser un corte de conexión momentáneo. Probá de nuevo."}
        </p>
        {!this.state.isChunkError && (
          <Btn variant="primary" onClick={() => window.location.reload()} style={{ marginTop: 4 }}>
            Recargar
          </Btn>
        )}
      </div>
    );
  }
}
