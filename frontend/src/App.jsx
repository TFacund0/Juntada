import { useState } from "react";
import { S } from "./theme/styles";
import { GAME_LIST, getGame } from "./games/registry";
import { MultiplayerGame } from "./features/multiplayer/MultiplayerGame";

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP — landing = elegir juego, luego elegir modo (local/multi) para ese
// juego. No conoce reglas de ningún juego: todo sale de games/registry.js.
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [gameId, setGameId] = useState(null);
  const [mode, setMode] = useState(null); // null | "local" | "multi"

  const game = gameId ? getGame(gameId) : null;

  const goBack = () => {
    if (mode) setMode(null);
    else setGameId(null);
  };

  const pickGame = (id) => {
    setGameId(id);
    setMode(null);
  };

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet" />
      <div style={S.wrap}>
        <div style={S.header}>
          {(gameId || mode) && <button onClick={goBack} style={{ background: "none", border: "none", color: "#6b6490", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700, marginBottom: 8, display: "block" }}>← Volver</button>}
          <div style={{ fontSize: 48 }}>{game?.icon ?? "🎉"}</div>
          <h1 style={S.title}>{game?.label ?? "Juntada"}</h1>
          {!gameId && <p style={{ color: "#6b6490", fontSize: 14, marginTop: 6 }}>Elegí un juego para arrancar</p>}
          {gameId && !mode && !game.comingSoon && <p style={{ color: "#7F77DD", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}>Elegí cómo jugar</p>}
          {mode === "local" && <p style={{ color: "#7F77DD", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}>Modo local · Un dispositivo</p>}
          {mode === "multi" && <p style={{ color: "#7F77DD", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}>Modo multijugador · Online</p>}
        </div>

        {/* ── Paso 1: elegir juego ── */}
        {!gameId && (
          <div>
            {GAME_LIST.map(g => (
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

        {/* ── Paso 2: elegir modo (solo si el juego ya está implementado) ── */}
        {gameId && !mode && !game.comingSoon && (
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
        {mode === "multi" && <MultiplayerGame gameId={gameId} />}
      </div>
    </div>
  );
}
