import { Component } from "react";
import type { ReactNode } from "react";
import { Btn } from "../ui/Btn";
import { AlertIcon } from "../ui/icons";
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-1.5 p-6 text-center">
        <span
          aria-hidden
          className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--jt-danger-bg-soft,rgba(226,75,74,0.14))]"
        >
          <AlertIcon size={22} color={`var(--jt-danger-text, ${DEFAULT_COLORS.dangerText})`} />
        </span>
        <p className="m-0 text-[15px] font-bold text-[var(--jt-text,#e8e4f0)]">Algo salió mal</p>
        <p className="mx-0 mt-0 mb-2 max-w-[280px] text-[13px] text-[var(--jt-muted-text,#a49dc9)]">
          Se rompió algo de nuestro lado. Probá recargar la página.
        </p>
        <Btn variant="primary" onClick={() => window.location.reload()} className="mt-1">
          Recargar
        </Btn>
      </div>
    );
  }
}
