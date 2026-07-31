import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import brandLogo from "../../../assets/brand/logo.webp";
import type { OverlayMode } from "../hooks/useMultiplayerSocket";

// Modes with buttons a keyboard/screen-reader user actually needs to act on
// — everything else ("connecting"/"reconnected") is a passive status update
// that resolves on its own, so there's nothing to move focus to.
const ACTIONABLE_MODES: OverlayMode[] = ["prompt", "gone", "failed"];

const overlayStyle = `
  @keyframes session-recovery-spin { to { transform: rotate(360deg); } }
  @keyframes session-recovery-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes session-recovery-pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(226,75,74,0.45); }
    70% { box-shadow: 0 0 0 14px rgba(226,75,74,0); }
    100% { box-shadow: 0 0 0 0 rgba(226,75,74,0); }
  }
  @keyframes session-recovery-check-pop {
    0% { transform: scale(0.6); opacity: 0; }
    60% { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes session-recovery-mascot-pop {
    0% { transform: scale(0.7) translateY(-10px); opacity: 0; }
    55% { transform: scale(1.06) translateY(2px); opacity: 1; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes session-recovery-mascot-bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  @keyframes session-recovery-line-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes session-recovery-badge-pop {
    0% { transform: scale(0); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .session-recovery-mascot {
    animation: session-recovery-mascot-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both, session-recovery-mascot-bob 3s ease-in-out 0.5s infinite;
  }
  .session-recovery-mascot.gone { animation: session-recovery-mascot-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
  .session-recovery-badge {
    animation: session-recovery-badge-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s both;
  }
  .session-recovery-line {
    animation: session-recovery-line-in 0.35s ease-out both;
  }
  .session-recovery-link {
    background: none;
    border: none;
    font-family: inherit;
    cursor: pointer;
    color: rgba(255,255,255,0.75);
    font-weight: 700;
    font-size: 14px;
    padding: 8px;
    position: relative;
    transition: color 0.15s ease-out;
  }
  .session-recovery-link::after {
    content: "";
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 4px;
    height: 1px;
    background: currentColor;
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 0.2s ease-out;
  }
  .session-recovery-link:hover { color: #fff; }
  .session-recovery-link:hover::after { transform: scaleX(1); }
  .session-recovery-link:active { transform: scale(0.97); }
  .session-recovery-failed-icon {
    animation: session-recovery-pulse-ring 1.8s ease-out infinite;
  }
  .session-recovery-failed-icon svg {
    animation: session-recovery-spin 2.2s linear infinite;
  }
  .session-recovery-check {
    animation: session-recovery-check-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  .session-recovery-btn {
    border: none;
    font-family: inherit;
    cursor: pointer;
    width: 100%;
    box-sizing: border-box;
    padding: 14px 24px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 15px;
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.15s ease-out, box-shadow 0.2s ease-out;
  }
  .session-recovery-btn:hover { transform: translateY(-2px) scale(1.015); filter: brightness(1.15); }
  .session-recovery-btn:active { transform: scale(0.96) translateY(0); filter: brightness(0.97); transition-duration: 0.05s; }
  .session-recovery-btn.primary {
    background: linear-gradient(135deg,#7F77DD,#534AB7);
    color: #fff;
    box-shadow: 0 8px 24px rgba(127,119,221,0.35);
  }
  .session-recovery-btn.primary:hover { box-shadow: 0 10px 30px rgba(127,119,221,0.5); }
  .session-recovery-btn.ghost {
    background: transparent;
    color: #fff;
    border: 1px solid rgba(255,255,255,0.18);
  }
  .session-recovery-btn.ghost:hover { border-color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.06); }
`;

// Staggers the "prompt"/"gone" title → subtitle → button-stack reveal so
// they read as a deliberate sequence instead of popping in all at once.
const LINE_DELAY_2 = "0.06s";
const LINE_DELAY_3 = "0.12s";

// Shared shell for every "circle background + centered svg" icon this
// overlay uses (the failed spinner, the reconnected check, the gone badge)
// — each mode only differs in size/color/animation class, not the wrapper.
function IconCircle({
  size,
  background,
  className,
  style,
  children,
}: {
  size: number;
  background: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Full-screen, fully opaque black gate — shown both on a cold start (app
// just opened/remounted with a session saved in localStorage) and on any
// live connection drop mid-game, instead of a small banner floating over an
// otherwise-interactive screen. A dropped socket used to "reconnect" behind
// the player's back while they kept tapping around a stale screen; blocking
// the whole screen makes the state impossible to miss or act on top of.
export function SessionRecoveryOverlay({
  mode,
  contextLabel,
  hostName,
  attempt,
  maxAttempts,
  onReconnect,
  onGoToMenu,
  onCreateNew,
}: {
  mode: Exclude<OverlayMode, "none">;
  contextLabel: string;
  hostName?: string;
  attempt?: number;
  maxAttempts?: number;
  onReconnect: () => void;
  onGoToMenu: () => void;
  onCreateNew?: () => void;
}) {
  const isActionable = ACTIONABLE_MODES.includes(mode);
  // Screen-reader users land wherever focus already was (nowhere useful,
  // usually — this gate just took over the whole screen) unless something
  // explicitly moves it. Only the actionable modes have anything worth
  // landing on; "connecting"/"reconnected" are passive and resolve on their
  // own, so focus is left alone there.
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isActionable) primaryButtonRef.current?.focus();
  }, [mode, isActionable]);

  return (
    <div
      role={isActionable ? "alertdialog" : "status"}
      aria-live={isActionable ? "assertive" : "polite"}
      aria-modal={isActionable || undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "#0f0c1d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <style>{overlayStyle}</style>
      <div style={{ animation: "session-recovery-fade-in 0.25s ease-out both", width: "100%", maxWidth: 320 }}>
        {mode !== "failed" && (
          <div style={{ position: "relative", display: "inline-block", marginBottom: 24 }}>
            <img
              src={brandLogo}
              alt=""
              className={mode === "prompt" ? "session-recovery-mascot" : mode === "gone" ? "session-recovery-mascot gone" : undefined}
              style={{
                display: "block",
                width: mode === "prompt" || mode === "gone" ? 108 : 88,
                height: mode === "prompt" || mode === "gone" ? 108 : 88,
                borderRadius: 24,
                filter: mode === "gone" ? "grayscale(1) brightness(0.75)" : undefined,
                boxShadow: mode === "reconnected" ? "0 0 28px -4px rgba(93,202,165,0.6)" : "0 0 28px -4px rgba(127,119,221,0.5)",
              }}
            />
            {mode === "gone" && (
              <IconCircle
                size={34}
                background="rgba(226,75,74,0.25)"
                className="session-recovery-badge"
                style={{ position: "absolute", bottom: -6, right: -6, border: "2px solid #0f0c1d" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#F09595"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <line x1="6.5" y1="17.5" x2="17.5" y2="6.5" />
                </svg>
              </IconCircle>
            )}
          </div>
        )}

        {mode === "failed" && (
          <IconCircle
            size={76}
            background="rgba(226,75,74,0.14)"
            className="session-recovery-failed-icon"
            style={{ margin: "0 auto 24px" }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F09595"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
          </IconCircle>
        )}

        {mode === "connecting" && (
          <>
            <div
              style={{
                width: 32,
                height: 32,
                margin: "0 auto 18px",
                borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.15)",
                borderTopColor: "#7F77DD",
                animation: "session-recovery-spin 0.8s linear infinite",
              }}
            />
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>Autenticando</p>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
              {attempt
                ? `Reconectando a la ${contextLabel}... (${attempt}${maxAttempts ? `/${maxAttempts}` : ""})`
                : "Verificando sesión..."}
            </p>
          </>
        )}

        {mode === "reconnected" && (
          <>
            <IconCircle size={44} background="rgba(93,202,165,0.14)" className="session-recovery-check" style={{ margin: "0 auto 14px" }}>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#5DCAA5"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </IconCircle>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#5DCAA5" }}>Reconectado</p>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.5)" }}>Volviendo a la {contextLabel}...</p>
          </>
        )}

        {mode === "prompt" && (
          <>
            <p
              className="session-recovery-line"
              style={{
                margin: "0 0 4px",
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "0.01em",
                textTransform: "uppercase",
                color: "#fff",
              }}
            >
              Unirse a la partida de
            </p>
            <p
              className="session-recovery-line"
              style={{
                margin: "0 0 28px",
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "0.01em",
                textTransform: "uppercase",
                color: "#AFA9EC",
                animationDelay: LINE_DELAY_2,
              }}
            >
              {hostName ?? "Anfitrión desconocido"}
            </p>
            <div
              className="session-recovery-line"
              style={{ display: "flex", flexDirection: "column", gap: 14, animationDelay: LINE_DELAY_3 }}
            >
              <button ref={primaryButtonRef} className="session-recovery-btn primary" onClick={onReconnect}>
                Entrar a la partida
              </button>
              <button className="session-recovery-link" onClick={onGoToMenu}>
                Volver al inicio
              </button>
            </div>
          </>
        )}

        {mode === "gone" && (
          <>
            <p
              className="session-recovery-line"
              style={{
                margin: "0 0 8px",
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "0.01em",
                textTransform: "uppercase",
                color: "#fff",
              }}
            >
              La {contextLabel} ya no existe
            </p>
            <p
              className="session-recovery-line"
              style={{ margin: "0 0 28px", fontSize: 14, color: "rgba(255,255,255,0.55)", animationDelay: LINE_DELAY_2 }}
            >
              Crea una sala nueva para volver a jugar.
            </p>
            <div
              className="session-recovery-line"
              style={{ display: "flex", flexDirection: "column", gap: 10, animationDelay: LINE_DELAY_3 }}
            >
              {onCreateNew && (
                <button ref={primaryButtonRef} className="session-recovery-btn primary" onClick={onCreateNew}>
                  + Crear nueva sala
                </button>
              )}
              <button
                ref={onCreateNew ? undefined : primaryButtonRef}
                className={onCreateNew ? "session-recovery-link" : "session-recovery-btn primary"}
                onClick={onGoToMenu}
              >
                Volver al inicio
              </button>
            </div>
          </>
        )}

        {mode === "failed" && (
          <>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                color: "#fff",
              }}
            >
              Conexión perdida
            </p>
            <p style={{ margin: "0 0 26px", fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.55)" }}>
              No se puede conectar al servidor. Esto puede deberse a problemas de red o el servidor está inactivo.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button ref={primaryButtonRef} className="session-recovery-btn primary" onClick={onReconnect}>
                Reintentar conexión
              </button>
              <button className="session-recovery-btn ghost" onClick={onGoToMenu}>
                Forzar salida
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
