import { useState, useEffect, useCallback, Suspense } from "react";
import { S } from "./theme/styles";
import { GAME_LIST, getGame } from "./games/registry";
import type { GameDef } from "./games/gameTypes";
import { MultiplayerGame } from "./features/multiplayer/MultiplayerGame";
import { Btn } from "./components/Btn";
import { Avatar } from "./components/Avatar";
import { GameRules } from "./components/GameRules";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DevNoticeDialog } from "./components/DevNoticeDialog";
import { clearMultiplayerSession } from "./features/multiplayer/useMultiplayerSocket";
import { consumeJoinLink } from "./features/multiplayer/joinLink";
import { getStoredPlayerName, setStoredPlayerName } from "./features/multiplayer/playerName";
import logo from "./assets/brand/logo.webp";

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP — landing = elegir juego, luego elegir modo (local/multi) para ese
// juego. No conoce reglas de ningún juego: todo sale de games/registry.js.
// ═══════════════════════════════════════════════════════════════════════════════

// Remembers which game/mode was active so a mobile browser fully discarding
// the page while backgrounded (not just dropping the socket) still comes
// back to the same online room instead of the game picker.
function GameLoading() {
  return <p style={{ textAlign: "center", color: "#6b6490", padding: 40 }}>Cargando juego...</p>;
}

interface ActiveSession {
  gameId: string;
  mode: "local" | "multi";
}

const ACTIVE_KEY = "impostorgame:active";
function loadActive(): ActiveSession | null {
  try {
    return JSON.parse(sessionStorage.getItem(ACTIVE_KEY) ?? "null");
  } catch {
    return null;
  }
}
function saveActive(value: ActiveSession | null): void {
  try {
    if (value) sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* storage unavailable — degrade silently */
  }
}

export default function App() {
  // A join-link scan (?join=CODE&game=id or ?join=CODE&kind=group) always
  // wins over a restored in-progress session — the user explicitly scanned
  // a QR to go somewhere. Computed once (lazy initializer) since
  // consumeJoinLink() strips the URL as a side effect and must not re-run
  // on every render. A group link carries no game — it just means the game
  // isn't known until the player picks (or joins) one from inside the group.
  const [validJoinLink] = useState(() => {
    const link = consumeJoinLink();
    if (!link) return null;
    if (link.kind === "room" && !getGame(link.gameId)) return null;
    return link;
  });
  const linkGameId = validJoinLink?.kind === "room" ? validJoinLink.gameId : null;
  const restored = validJoinLink ? null : loadActive();
  const [gameId, setGameId] = useState<string | null>(linkGameId ?? restored?.gameId ?? null);
  const [mode, setMode] = useState<"local" | "multi" | null>(validJoinLink ? "multi" : (restored?.mode ?? null));
  // "Crear o unirme a un grupo" (or scanning a group's join link) skips
  // straight to the multiplayer shell with no game chosen yet — the group
  // screen lets any member open/join independent game instances. Not
  // persisted across a backgrounded tab like a normal session (see
  // saveActive below): once inside an instance, its gameType drives
  // onGameTypeChange and normal session restore (rejoin_group) takes over.
  const [groupFlow, setGroupFlow] = useState(() => validJoinLink?.kind === "group");
  const [showRules, setShowRules] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showDevNotice, setShowDevNotice] = useState(() => {
    try {
      return !localStorage.getItem("impostorgame:devNoticeSeen");
    } catch {
      return false;
    }
  });

  const dismissDevNotice = () => {
    try {
      localStorage.setItem("impostorgame:devNoticeSeen", "1");
    } catch {
      /* storage unavailable */
    }
    setShowDevNotice(false);
  };

  // Asked once, right when the app is first opened — saved locally so
  // nothing downstream (creating/joining a room or group) ever has to ask
  // for it again. Editable later from the home screen ("Cambiar" link).
  const [playerName, setPlayerName] = useState(() => getStoredPlayerName());
  const [nameDraft, setNameDraft] = useState("");
  const [editingName, setEditingName] = useState(false);

  const savePlayerName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStoredPlayerName(trimmed);
    setPlayerName(trimmed);
    setEditingName(false);
  };

  const game = gameId ? (getGame(gameId) as GameDef | undefined) : null;

  // The room actually joined is the only source of truth for which game
  // this is — a stale/mismatched join link (or gameId picked before the
  // room was known) shouldn't leave the header showing the wrong game while
  // the room content underneath is correct.
  const handleRoomGameType = useCallback(
    (roomGameType: string | null) => {
      if (roomGameType === null) {
        // No active instance (sitting on the group screen) — only relevant
        // while in the group flow, where there's no fixed gameId to fall back
        // to; a standalone room always has a gameType.
        if (groupFlow) setGameId(null);
        return;
      }
      if (roomGameType !== gameId && getGame(roomGameType)) setGameId(roomGameType);
    },
    [groupFlow, gameId],
  );

  useEffect(() => {
    saveActive(mode === "multi" && gameId ? { gameId, mode } : null);
  }, [gameId, mode]);

  const goBack = () => {
    if (mode) {
      if (mode === "multi") clearMultiplayerSession();
      setMode(null);
      // Group flow jumps straight from home into multi mode with no "pick
      // mode" step in between, so going back from it goes straight home too.
      if (groupFlow) setGroupFlow(false);
    } else {
      setGameId(null);
      setShowRules(false);
    }
  };

  const goHome = () => {
    if (mode === "multi") clearMultiplayerSession();
    setGameId(null);
    setMode(null);
    setGroupFlow(false);
    setShowRules(false);
    setShowExitConfirm(false);
  };

  const pickGame = (id: string) => {
    setGameId(id);
    setMode(null);
    setShowRules(false);
  };

  const startGroupFlow = () => {
    setGameId(null);
    setGroupFlow(true);
    setMode("multi");
    setShowRules(false);
  };

  // First thing the app ever asks — before picking a game, before anything
  // else. Once saved, this screen never shows again on this device.
  if (!playerName)
    return (
      <div style={S.app}>
        <div style={S.wrap}>
          <div style={S.header}>
            <img src={logo} alt="Juntada" style={{ width: 64, height: 64, borderRadius: 16 }} />
            <h1 style={S.title}>Juntada</h1>
            <p style={{ color: "#6b6490", fontSize: 14, marginTop: 6 }}>¿Cómo te llamás?</p>
          </div>
          <div style={S.card}>
            <span style={S.label}>Tu nombre</span>
            <input
              style={S.input}
              placeholder="¿Cómo te llamás?"
              autoFocus
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") savePlayerName(nameDraft);
              }}
            />
            <p style={{ ...S.muted, marginTop: 10 }}>Así te van a ver los demás jugadores. Lo guardamos en este dispositivo, no te lo va a volver a pedir.</p>
          </div>
          <button onClick={() => savePlayerName(nameDraft)} disabled={!nameDraft.trim()} style={S.btn("primary", !nameDraft.trim())}>
            Continuar
          </button>
        </div>
      </div>
    );

  return (
    <div style={S.app}>
      <div style={S.wrap}>
        <div style={S.header}>
          {(gameId || mode) && (
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 8 }}>
              <button
                onClick={goBack}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6b6490",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "inherit",
                  fontWeight: 700,
                }}
              >
                Volver
              </button>
              <button
                onClick={() => setShowExitConfirm(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6b6490",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "inherit",
                  fontWeight: 700,
                }}
              >
                Menú principal
              </button>
            </div>
          )}
          {game?.icon ? (
            <div style={{ fontSize: 48 }}>{game.icon}</div>
          ) : (
            <img src={logo} alt="Juntada" style={{ width: 64, height: 64, borderRadius: 16 }} />
          )}
          <h1 style={S.title}>{game?.label ?? "Juntada"}</h1>
          {!gameId && !groupFlow && <p style={{ color: "#6b6490", fontSize: 14, marginTop: 6 }}>Elegí un juego para arrancar</p>}
          {!gameId && !groupFlow && !editingName && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                marginTop: 14,
                padding: "6px 8px 6px 10px",
                borderRadius: 999,
                background: "rgba(127,119,221,0.1)",
                border: "1px solid rgba(127,119,221,0.3)",
              }}
            >
              <Avatar name={playerName} size={26} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>{playerName}</span>
              <button
                onClick={() => {
                  setNameDraft(playerName);
                  setEditingName(true);
                }}
                style={{
                  background: "rgba(127,119,221,0.18)",
                  border: "none",
                  borderRadius: 999,
                  color: "#AFA9EC",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  fontWeight: 700,
                  padding: "5px 12px",
                }}
              >
                Cambiar
              </button>
            </div>
          )}
          {!gameId && !groupFlow && editingName && (
            <div style={{ ...S.card, textAlign: "left", marginTop: 12 }}>
              <span style={S.label}>Tu nombre</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{ ...S.input, flex: 1 }}
                  autoFocus
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") savePlayerName(nameDraft);
                    if (e.key === "Escape") setEditingName(false);
                  }}
                />
                <Btn onClick={() => savePlayerName(nameDraft)} disabled={!nameDraft.trim()} style={{ width: "auto", padding: "11px 18px" }}>
                  Guardar
                </Btn>
              </div>
            </div>
          )}
          {gameId && !mode && !game?.comingSoon && (
            <p
              style={{ color: "#7F77DD", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}
            >
              Elegí cómo jugar
            </p>
          )}
          {mode === "local" && (
            <p
              style={{ color: "#7F77DD", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}
            >
              Modo local · Un dispositivo
            </p>
          )}
          {mode === "multi" && (
            <p
              style={{ color: "#7F77DD", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}
            >
              Modo multijugador · Online
            </p>
          )}
          {(game?.rules?.length ?? 0) > 0 && (
            <button
              onClick={() => setShowRules(v => !v)}
              style={{
                background: "none",
                border: "none",
                color: "#7F77DD",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
                fontWeight: 700,
                marginTop: 10,
              }}
            >
              {showRules ? "Ocultar reglas ▲" : "¿Cómo se juega? ▼"}
            </button>
          )}
        </div>

        {showRules && (game?.rules?.length ?? 0) > 0 && <GameRules rules={game!.rules} />}

        {/* ── Paso 1: elegir juego, o crear/unirse a un grupo persistente ── */}
        {!gameId && !groupFlow && (
          <div>
            <div
              style={{ ...S.cardHighlight, cursor: "pointer", textAlign: "center" }}
              onClick={startGroupFlow}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <p style={{ fontWeight: 800, fontSize: 18, margin: "0 0 6px" }}>Crear o unirme a un grupo</p>
              <p style={{ color: "#6b6490", fontSize: 13, margin: 0 }}>
                Armá una sala con tus amigos y jueguen varios juegos seguidos, sin crear una sala nueva cada vez.
              </p>
            </div>
            <p style={{ ...S.muted, textAlign: "center", margin: "16px 0 10px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              O elegí un juego para jugar directo
            </p>
            {[...(GAME_LIST as GameDef[])]
              .sort((a, b) => (a.comingSoon ? 1 : 0) - (b.comingSoon ? 1 : 0))
              .map(g => (
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
        {gameId && game?.comingSoon && !mode && (
          <Suspense fallback={<GameLoading />}>
            <game.LocalGame />
          </Suspense>
        )}

        {/* ── Juego solo local (sin motor de sala online): directo al juego ── */}
        {gameId && game?.localOnly && !game.comingSoon && !mode && (
          <Suspense fallback={<GameLoading />}>
            <game.LocalGame />
          </Suspense>
        )}

        {/* ── Paso 2: elegir modo (solo si el juego ya está implementado y soporta online) ── */}
        {gameId && !mode && game && !game.comingSoon && !game.localOnly && (
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
        {mode === "local" && game && (
          <Suspense fallback={<GameLoading />}>
            <game.LocalGame />
          </Suspense>
        )}
        {mode === "multi" && (gameId || groupFlow) && (
          <MultiplayerGame
            entryKind={groupFlow ? "group" : "room"}
            gameId={gameId}
            playerName={playerName}
            initialJoinCode={validJoinLink?.code}
            onGameTypeChange={handleRoomGameType}
            onLeaveGroup={goHome}
          />
        )}
      </div>

      {showDevNotice && <DevNoticeDialog onClose={dismissDevNotice} />}

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
