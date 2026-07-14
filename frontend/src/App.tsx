import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { S } from "./theme/styles";
import { GAME_LIST, getGame } from "./games/registry";
import type { GameDef } from "./games/gameTypes";
import { MultiplayerGame } from "./features/multiplayer/MultiplayerGame";
import { Btn } from "./components/Btn";
import { Avatar } from "./components/Avatar";
import { GamePicker } from "./components/GamePicker";
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
  // Which tab the multiplayer shell should land on when entering via the
  // home screen's compact group menu (tap "+" → Crear grupo / Unirme a un
  // grupo) — lets it skip the neutral menu screen and go straight there.
  const [groupIntent, setGroupIntent] = useState<"create" | "join" | undefined>(undefined);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!showGroupMenu) return;
    const onClickOutside = (e: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) setShowGroupMenu(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showGroupMenu]);

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

  const startGroupFlow = (intent: "create" | "join") => {
    setGameId(null);
    setGroupIntent(intent);
    setGroupFlow(true);
    setMode("multi");
    setShowRules(false);
    setShowGroupMenu(false);
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
            <p style={{ color: "#9089c0", fontSize: 15, marginTop: 10, lineHeight: 1.4 }}>
              Antes de ver los juegos, decinos cómo te llamás.
            </p>
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
            <p style={{ ...S.muted, marginTop: 10 }}>
              Así te van a ver los demás jugadores. Lo guardamos en este dispositivo, no te lo va a volver a pedir.
            </p>
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
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, position: "relative" }}>
              <button
                onClick={() => {
                  setNameDraft(playerName);
                  setEditingName(true);
                }}
                style={S.namePill}
              >
                <Avatar name={playerName} size={26} />
                <span style={{ fontWeight: 700, fontSize: 14, color: "#e8e4f0" }}>{playerName}</span>
              </button>
              <div ref={groupMenuRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setShowGroupMenu(v => !v)}
                  aria-label="Crear o unirme a un grupo"
                  style={{ ...S.roundIconButton, transform: showGroupMenu ? "rotate(45deg)" : "none" }}
                >
                  {/* Se dibuja con dos barras en vez de depender del glyph
                      "+" de la fuente — así queda perfectamente centrado en
                      cualquier dispositivo, sin el desvío vertical que trae
                      el line-height del carácter de texto. */}
                  <span style={{ position: "relative", width: 16, height: 16 }}>
                    <span
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: 0,
                        width: "100%",
                        height: 2.5,
                        background: "#fff",
                        borderRadius: 2,
                        transform: "translateY(-50%)",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: 0,
                        height: "100%",
                        width: 2.5,
                        background: "#fff",
                        borderRadius: 2,
                        transform: "translateX(-50%)",
                      }}
                    />
                  </span>
                </button>
                {showGroupMenu && (
                  <div style={S.dropdownMenu}>
                    <button onClick={() => startGroupFlow("create")} style={S.dropdownMenuItem}>
                      ➕ Crear grupo
                    </button>
                    <button onClick={() => startGroupFlow("join")} style={S.dropdownMenuItem}>
                      🔗 Unirme a un grupo
                    </button>
                  </div>
                )}
              </div>
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
          {gameId && !mode && (
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

        {/* ── Paso 1: elegir juego (crear/unirse a un grupo vive en el "+" del header) ── */}
        {!gameId && !groupFlow && (
          <div>
            <GamePicker games={GAME_LIST as GameDef[]} onPick={pickGame} />
          </div>
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
            <div style={{ ...S.modeRow, borderLeft: "3px solid #7F77DD" }} onClick={() => setMode("multi")}>
              <div style={{ ...S.modeIconBadge, background: "rgba(127,119,221,0.18)" }}>🌐</div>
              <div style={{ flex: 1 }}>
                <p style={S.modeRowTitle}>Multijugador online</p>
                <p style={S.modeRowSubtitle}>Código de sala, cada uno desde su celular</p>
              </div>
              <div style={{ color: "#7F77DD", fontSize: 20 }}>›</div>
            </div>
            <div style={{ ...S.modeRow, borderLeft: "3px solid #5DCAA5" }} onClick={() => setMode("local")}>
              <div style={{ ...S.modeIconBadge, background: "rgba(93,202,165,0.15)" }}>📱</div>
              <div style={{ flex: 1 }}>
                <p style={S.modeRowTitle}>Modo local</p>
                <p style={S.modeRowSubtitle}>Un dispositivo, se pasa por turnos</p>
              </div>
              <div style={{ color: "#5DCAA5", fontSize: 20 }}>›</div>
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
            onChangeName={savePlayerName}
            initialJoinCode={validJoinLink?.code}
            initialGroupIntent={groupIntent}
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
