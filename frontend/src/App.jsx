import { useState, useEffect } from "react";
import { S } from "./theme/styles";
import { GAME_LIST, getGame } from "./games/registry";
import { MultiplayerGame } from "./features/multiplayer/MultiplayerGame";
import { GameRules } from "./components/GameRules";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { QRDialog } from "./components/QRDialog";
import { clearMultiplayerSession } from "./features/multiplayer/useMultiplayerSocket";
import { consumeJoinLink } from "./features/multiplayer/joinLink";
import logo from "./assets/brand/logo.png";

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP — landing = elegir juego, luego elegir modo (local/multi) para ese
// juego. No conoce reglas de ningún juego: todo sale de games/registry.js.
// ═══════════════════════════════════════════════════════════════════════════════

// Remembers which game/mode was active so a mobile browser fully discarding
// the page while backgrounded (not just dropping the socket) still comes
// back to the same online room instead of the game picker.
const ACTIVE_KEY = "impostorgame:active";
function loadActive() {
  try { return JSON.parse(sessionStorage.getItem(ACTIVE_KEY)); } catch { return null; }
}
function saveActive(value) {
  try {
    if (value) sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch { /* storage unavailable — degrade silently */ }
}

export default function App() {
  // A join-link scan (?join=CODE&game=id) always wins over a restored
  // in-progress session — the user explicitly scanned a QR to go somewhere.
  // Computed once (lazy initializer) since consumeJoinLink() strips the URL
  // as a side effect and must not re-run on every render.
  const [validJoinLink] = useState(() => {
    const link = consumeJoinLink();
    return link && getGame(link.gameId) ? link : null;
  });
  const restored = validJoinLink ? null : loadActive();
  const [gameId, setGameId] = useState(validJoinLink?.gameId ?? restored?.gameId ?? null);
  const [mode, setMode] = useState(validJoinLink ? "multi" : restored?.mode ?? null); // null | "local" | "multi"
  const [showRules, setShowRules] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showHomeQR, setShowHomeQR] = useState(false);

  const game = gameId ? getGame(gameId) : null;

  useEffect(() => {
    saveActive(mode === "multi" && gameId ? { gameId, mode } : null);
  }, [gameId, mode]);

  const goBack = () => {
    if (mode) { if (mode === "multi") clearMultiplayerSession(); setMode(null); }
    else { setGameId(null); setShowRules(false); }
  };

  const goHome = () => {
    if (mode === "multi") clearMultiplayerSession();
    setGameId(null);
    setMode(null);
    setShowRules(false);
    setShowExitConfirm(false);
  };

  const pickGame = (id) => {
    setGameId(id);
    setMode(null);
    setShowRules(false);
  };

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet" />
      <div style={S.wrap}>
        <div style={S.header}>
          {(gameId || mode) && (
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 8 }}>
              <button onClick={goBack} style={{ background: "none", border: "none", color: "#6b6490", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}>Volver</button>
              <button onClick={() => setShowExitConfirm(true)} style={{ background: "none", border: "none", color: "#6b6490", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}>Menú principal</button>
            </div>
          )}
          {game?.icon
            ? <div style={{ fontSize: 48 }}>{game.icon}</div>
            : <img src={logo} alt="Juntada" style={{ width: 64, height: 64, borderRadius: 16 }} />}
          <h1 style={S.title}>{game?.label ?? "Juntada"}</h1>
          {!gameId && <p style={{ color: "#6b6490", fontSize: 14, marginTop: 6 }}>Elegí un juego para arrancar</p>}
          {!gameId && (
            <button
              onClick={() => setShowHomeQR(true)}
              style={{ background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700, marginTop: 10 }}
            >
              📱 Invitar por QR
            </button>
          )}
          {gameId && !mode && !game.comingSoon && <p style={{ color: "#7F77DD", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}>Elegí cómo jugar</p>}
          {mode === "local" && <p style={{ color: "#7F77DD", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}>Modo local · Un dispositivo</p>}
          {mode === "multi" && <p style={{ color: "#7F77DD", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}>Modo multijugador · Online</p>}
          {game?.rules?.length > 0 && (
            <button
              onClick={() => setShowRules(v => !v)}
              style={{ background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700, marginTop: 10 }}
            >
              {showRules ? "Ocultar reglas ▲" : "¿Cómo se juega? ▼"}
            </button>
          )}
        </div>

        {showRules && game?.rules?.length > 0 && <GameRules rules={game.rules} />}

        {/* ── Paso 1: elegir juego ── */}
        {!gameId && (
          <div>
            {[...GAME_LIST].sort((a, b) => (a.comingSoon ? 1 : 0) - (b.comingSoon ? 1 : 0)).map(g => (
              <div key={g.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => pickGame(g.id)}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{g.icon}</div>
                <p style={{ fontWeight: 800, fontSize: 18, margin: "0 0 6px" }}>
                  {g.label}
                  {g.comingSoon && <span style={{ ...S.pill(false), marginLeft: 8, verticalAlign: "middle" }}>Próximamente</span>}
                </p>
                <p style={{ color: "#6b6490", fontSize: 13, margin: 0 }}>{g.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Juego todavía no jugable: placeholder directo, sin pedir modo ── */}
        {gameId && game.comingSoon && !mode && <game.LocalGame />}

        {/* ── Juego solo local (sin motor de sala online): directo al juego ── */}
        {gameId && game.localOnly && !game.comingSoon && !mode && <game.LocalGame />}

        {/* ── Paso 2: elegir modo (solo si el juego ya está implementado y soporta online) ── */}
        {gameId && !mode && !game.comingSoon && !game.localOnly && (
          <div>
            <div style={{ ...S.card, cursor: "pointer", transition: "border 0.15s" }} onClick={() => setMode("multi")}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌐</div>
              <p style={{ fontWeight: 800, fontSize: 18, margin: "0 0 6px" }}>Multijugador online</p>
              <p style={{ color: "#6b6490", fontSize: 13, margin: 0 }}>Cada uno desde su celular. Código de sala para unirse.</p>
            </div>
            <div style={{ ...S.card, cursor: "pointer" }} onClick={() => setMode("local")}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📱</div>
              <p style={{ fontWeight: 800, fontSize: 18, margin: "0 0 6px" }}>Modo local · Un dispositivo</p>
              <p style={{ color: "#6b6490", fontSize: 13, margin: 0 }}>Todos pasan el celular por turnos.</p>
            </div>
          </div>
        )}

        {/* ── Paso 3: jugar ── */}
        {mode === "local" && <game.LocalGame />}
        {mode === "multi" && <MultiplayerGame gameId={gameId} initialJoinCode={validJoinLink?.code} />}
      </div>

      {showHomeQR && (
        <QRDialog
          title="Escaneá para entrar"
          subtitle="Te lleva directo al menú de juegos de Juntada."
          value={`${window.location.origin}${window.location.pathname}`}
          onClose={() => setShowHomeQR(false)}
        />
      )}

      {showExitConfirm && (
        <ConfirmDialog
          title="¿Volver al menú principal?"
          message="Vas a salir del juego actual y perder el progreso de esta partida."
          confirmLabel="Sí, salir"
          cancelLabel="Seguir jugando"
          onConfirm={goHome}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </div>
  );
}
