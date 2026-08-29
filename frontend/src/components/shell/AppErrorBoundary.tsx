import { Component } from "react";
import type { ReactNode } from "react";
import { Btn } from "../ui/Btn";
import { AlertIcon } from "../ui/icons";
import "./AppErrorBoundary.css";
import { DEFAULT_COLORS } from "../../theme/styles/colors";

// Root-level fallback: catches any render throw not already caught by a
// more specific boundary (e.g. GameLoadErrorBoundary around each game's lazy
// chunk). Mounted in main.tsx, wrapping <RouterProvider/>, so it can catch
// errors thrown by App.tsx itself and not just its children.
//
// Deliberately does NOT reproduce GameLoadErrorBoundary's chunk-404
// auto-reload: at the root, an unconditional reload-on-catch would become an
// unrecoverable reload loop for any error that keeps re-throwing after
// reload. Chunk recovery stays scoped to the 4 game-subtree mounts.
interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="jt-app-error">
        <span className="jt-app-error-icon" aria-hidden>
          <AlertIcon size={22} color={`var(--jt-danger-text, ${DEFAULT_COLORS.dangerText})`} />
        </span>
        <p className="jt-app-error-title">Algo salió mal</p>
        <p className="jt-app-error-subtitle">Se rompió algo de nuestro lado. Probá recargar la página.</p>
        <Btn variant="primary" onClick={() => window.location.reload()} style={{ marginTop: 4 }}>
          Recargar
        </Btn>
      </div>
    );
  }
}
