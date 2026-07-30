import { useState, useEffect, useRef, useCallback, Suspense, type CSSProperties } from "react";
import { S } from "./theme/styles";
import { GAME_THEMES } from "./theme/gameThemes";
import "./theme/curtain.css";
import "./theme/sharedChrome.css";
import { GAME_LIST, getGame } from "./games/registry";
import type { GameDef } from "./games/gameTypes";
import { isUnderMaintenance } from "./games/maintenance";
import { MultiplayerGame } from "./features/multiplayer/MultiplayerGame";
import { GamePicker } from "./components/GamePicker";
import { GameRules } from "./components/GameRules";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { RETURN_TO_GROUP_CONFIRM, roomHasProgress } from "./components/ReturnToGroupButton";
import { DevNoticeDialog } from "./components/DevNoticeDialog";
import { NamePillEditor } from "./components/NamePillEditor";
import { clearMultiplayerSession } from "./features/multiplayer/hooks/useMultiplayerSocket";
import { consumeJoinLink } from "./features/multiplayer/utils/joinLink";
import { getStoredPlayerName, setStoredPlayerName } from "./features/multiplayer/utils/playerName";
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
  // Set when the room-join form detects the typed code actually belongs to
  // a group (see MultiplayerGame's onSwitchToGroup) and the player confirms
  // switching over — takes priority over a scanned link's code so the
  // group flow picks up right where the room form left off.
  const [pendingGroupJoinCode, setPendingGroupJoinCode] = useState<string | null>(null);
  const switchToGroupJoin = (code: string) => {
    setPendingGroupJoinCode(code);
    setGroupIntent("join");
    setGroupFlow(true);
  };
  // True once actually joined/created a group (not just sitting on the
  // create/join forms) — while true, "Volver" redirects to the group screen
  // instead of exiting, and "Menú principal" warns it'll leave the group
  // before actually doing so (see goBack/showExitConfirm below).
  const [groupAttached, setGroupAttached] = useState(false);
  // MultiplayerGame exposes its "return to the group screen" action here
  // (see onExposeReturnToGroup) so the global header's "Volver" button can
  // trigger it without lifting the whole group/instance state up into App.
  const returnToGroupRef = useRef<() => void>(() => {});
  const exposeReturnToGroup = useCallback((fn: () => void) => {
    returnToGroupRef.current = fn;
  }, []);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const [showRules, setShowRules] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // "Volver" from inside a chosen mode (local or online) is one tap away
  // from the round/lobby itself and, unlike "Menú principal", had no
  // confirmation — a mis-tap silently dropped the whole match. Only that
  // branch of goBack is destructive enough to warn about; going back from
  // "elegí local u online" (mode still null) has nothing in progress to lose.
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  // Fade-to-black played whenever a themed game (see gameTheme on GameDef)
  // is about to come on screen or leave it, so the full-app palette swap
  // always happens under full black cover instead of as a hard cut.
  const [curtain, setCurtain] = useState<"none" | "in" | "out">("none");
  // Used only by the synchronous case below ("Modo local") — action()
  // finishes instantly, so a fixed timer is enough: no network round-trip to
  // actually wait on.
  const withCurtain = useCallback((action: () => void, themed: boolean) => {
    if (!themed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      action();
      return;
    }
    setCurtain("in");
    setTimeout(() => {
      action();
      setCurtain("out");
      setTimeout(() => setCurtain("none"), 380);
    }, 260);
  }, []);
  // Online create/join (see MultiplayerGame's runTransition) isn't
  // synchronous — action() only *sends* the create/join request; the room
  // actually arrives later, over the socket, whenever the server responds.
  // A fixed timer here doesn't know that: on a slow connection the curtain
  // used to lift before the room existed, flashing the old "Crear partida"
  // screen back for a moment before the real lobby suddenly replaced it —
  // read as the transition "happening twice". This variant keeps the
  // curtain down until the caller explicitly signals the room actually
  // showed up (see MultiplayerGame's onTransitionSettled), with a floor so a
  // very fast response still gets to be seen as a deliberate transition
  // instead of an instant flash, and a safety-net timeout so a connection
  // that never responds at all doesn't trap the player behind black forever.
  const curtainSettleRef = useRef<(() => void) | null>(null);
  const withAsyncCurtain = useCallback((action: () => void, themed: boolean) => {
    if (!themed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      action();
      return;
    }
    setCurtain("in");
    const shownAt = Date.now();
    const MIN_VISIBLE_MS = 400;
    const SAFETY_TIMEOUT_MS = 6000;
    const lift = () => {
      curtainSettleRef.current = null;
      setCurtain("out");
      setTimeout(() => setCurtain("none"), 380);
    };
    const settle = () => {
      // A later call (a fresh transition) already replaced this one — don't
      // let a stale settle/timeout clear a curtain that isn't "ours" anymore.
      if (curtainSettleRef.current !== settle) return;
      const elapsed = Date.now() - shownAt;
      if (elapsed >= MIN_VISIBLE_MS) lift();
      else setTimeout(lift, MIN_VISIBLE_MS - elapsed);
    };
    curtainSettleRef.current = settle;
    setTimeout(action, 260);
    setTimeout(settle, SAFETY_TIMEOUT_MS);
  }, []);
  // Called once the room/group this curtain was covering actually arrives
  // (or fails) — see MultiplayerGame's connectionPhase-watching effect.
  const settleAsyncCurtain = useCallback(() => {
    curtainSettleRef.current?.();
  }, []);
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
  // Only used by the first-run "how should we call you" screen below (see
  // `if (!playerName)`) — the pill editor (NamePillEditor) that lets you
  // change it afterwards owns its own draft state.
  const [nameDraft, setNameDraft] = useState("");

  const savePlayerName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStoredPlayerName(trimmed);
    setPlayerName(trimmed);
  };

  const game = gameId ? (getGame(gameId) as GameDef | undefined) : null;

  // The room actually joined is the only source of truth for which game
  // this is — a stale/mismatched join link (or gameId picked before the
  // room was known) shouldn't leave the header showing the wrong game while
  // the room content underneath is correct.
  //
  // Also the signal for whether a themed game's reskin (see gameTheme on
  // GameDef) should be live: a room only exists once "Crear partida"/
  // "Unirse" actually lands, not just from picking "Multijugador online" —
  // this is null the whole time you're still on that create/join screen.
  const [inRoom, setInRoom] = useState(false);
  // Whether a themed game's reskin is actually on screen right now — used
  // below to decide what "Paso 1.5"/"Paso 3" render, and here to drive the
  // body/theme-color sync effect. Computed above the "!playerName" early
  // return further down since Hooks (the effect right after it) can never
  // be called conditionally.
  const inGameView = game
    ? game.localOnly
      ? !game.comingSoon && !isUnderMaintenance(game)
      : mode === "local" || (mode === "multi" && inRoom)
    : false;
  const activeTheme = inGameView && game?.gameTheme ? GAME_THEMES[game.gameTheme] : null;
  // S.app's background only paints the app's own root div — on mobile,
  // overscroll/rubber-banding (pull past the top/bottom of the page) shows
  // whatever's actually behind that div: <body>'s own background (set once,
  // statically, in index.html) and the browser chrome's theme-color meta
  // tag. Neither followed a themed game's background before, so pulling
  // down mid-Recámara flashed the app's default dark-purple instead of its
  // own near-black. Kept in sync here instead of in index.html since the
  // theme is only known at runtime, and reset on unmount so leaving the
  // themed game doesn't leave the tint behind for the next screen.
  useEffect(() => {
    const bg = (activeTheme?.app.background as string | undefined) ?? "#0f0c1d";
    document.body.style.background = bg;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
    return () => {
      document.body.style.background = "#0f0c1d";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0f0c1d");
    };
  }, [activeTheme]);
  // Lets goBack decide whether delegating to returnToGroupRef (see below)
  // would actually interrupt a round in progress — the same question
  // ReturnToGroupButton asks for its own in-screen control, via the same
  // shared roomHasProgress check, instead of silently leaving either way.
  const [roomPhase, setRoomPhase] = useState<string | null>(null);
  const handleRoomGameType = useCallback(
    (roomGameType: string | null) => {
      setInRoom(roomGameType !== null);
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

  const [showReturnToGroupConfirm, setShowReturnToGroupConfirm] = useState(false);
  const goBack = () => {
    // Inside a group with an active instance, "Volver" just sends the
    // player back to the group screen (same as the in-lobby/in-round "👥
    // Volver al grupo" control) — no exit. Confirms first iff a round is
    // actually in progress (roomHasProgress), same check and same copy as
    // that in-screen control uses for the identical leave_instance action —
    // pressed again once already sitting on the group screen (no instance
    // left to back out of), there's nowhere left to "go back" to except
    // leaving the group, so it warns instead of doing that silently.
    if (groupAttached) {
      if (gameId) {
        if (roomHasProgress(roomPhase)) setShowReturnToGroupConfirm(true);
        else returnToGroupRef.current?.();
      } else {
        setShowExitConfirm(true);
      }
      return;
    }
    if (mode) {
      setShowBackConfirm(true);
    } else {
      // Reskin never turns on until "Modo local" or an actual online room
      // (see inGameView/inRoom above) — with no mode chosen yet there was
      // never anything themed on screen to fade out of.
      setGameId(null);
      setShowRules(false);
    }
  };

  // Whether the themed reskin (see gameTheme on GameDef) is actually live
  // right now, for games with one — used to decide whether leaving needs
  // the fade-to-black curtain or can just happen instantly.
  const themeIsLive = Boolean(game?.gameTheme) && (mode === "local" || (mode === "multi" && inRoom));

  const confirmGoBack = () => {
    withCurtain(() => {
      if (mode === "multi") clearMultiplayerSession();
      setMode(null);
      // Group flow jumps straight from home into multi mode with no "pick
      // mode" step in between, so going back from it goes straight home too.
      if (groupFlow) setGroupFlow(false);
      setShowBackConfirm(false);
    }, themeIsLive);
  };

  const goHome = () => {
    withCurtain(() => {
      if (mode === "multi") clearMultiplayerSession();
      setGameId(null);
      setMode(null);
      setGroupFlow(false);
      setShowRules(false);
      setShowExitConfirm(false);
      setGroupAttached(false);
    }, themeIsLive);
  };

  const pickGame = (id: string) => {
    // No curtain here either — picking a game from the list only sets
    // gameId, well before "Modo local"/an actual room turns its theme on.
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

  const accentColor = activeTheme?.accent ?? "#7F77DD";
  const mutedColor = activeTheme?.muted ?? "#6b6490";
  const themedTitleStyle: CSSProperties = activeTheme
    ? { ...S.title, background: "none", WebkitBackgroundClip: "unset", WebkitTextFillColor: "unset", color: accentColor }
    : S.title;
  // Every shared "join a room" component (CodeDisplay, QRDialog) reads
  // these CSS vars instead of hardcoding the default purple/green — see
  // theme/sharedChrome.css. Only set when a theme is actually live;
  // otherwise the vars just keep sharedChrome.css's own :root defaults
  // (this app's normal look, untouched for every non-themed game).
  const chromeVars = activeTheme
    ? ({
        "--jt-accent": accentColor,
        "--jt-accent-strong": activeTheme.accentStrong ?? accentColor,
        "--jt-surface": activeTheme.surface ?? (activeTheme.app.background as string | undefined),
        "--jt-muted": mutedColor,
        // The "Iniciar ronda"-style CTA matches this theme's accent too,
        // instead of staying the app-wide green.
        "--jt-cta-from": accentColor,
        "--jt-cta-to": `color-mix(in srgb, ${accentColor} 70%, black)`,
        "--jt-cta-shadow": `color-mix(in srgb, ${accentColor} 35%, transparent)`,
        // StickyActionBar's fade-to-bg strip (behind that same CTA).
        "--jt-bg": activeTheme.app.background as string | undefined,
        // The shared card/label/muted-text look (S.card/S.label/S.muted in
        // theme/styles.ts) — covers the online lobby's player-list card for
        // free, no per-screen changes needed.
        "--jt-card-bg": "color-mix(in srgb, black 25%, transparent)",
        "--jt-card-border": `color-mix(in srgb, ${accentColor} 30%, transparent)`,
        "--jt-row-border": `color-mix(in srgb, ${accentColor} 15%, transparent)`,
        "--jt-label": accentColor,
        "--jt-muted-text": mutedColor,
      } as CSSProperties)
    : {};

  return (
    <div
      style={{
        ...S.app,
        ...activeTheme?.app,
        ...chromeVars,
        position: "relative",
        transition: "background-color .4s ease, color .4s ease",
      }}
    >
      {curtain !== "none" && <div className={`app-curtain ${curtain}`} />}
      {activeTheme?.backdropEmoji && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "60vh",
            lineHeight: 1,
            opacity: 0.07,
            color: accentColor,
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          {activeTheme.backdropEmoji}
        </div>
      )}
      <div style={{ ...S.wrap, position: "relative", zIndex: 1 }}>
        <div style={S.header}>
          {(gameId || mode) && (
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 8 }}>
              <button
                onClick={goBack}
                style={{
                  background: "none",
                  border: "none",
                  color: mutedColor,
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
                  color: mutedColor,
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
          {game?.logo ? (
            <img src={game.logo} alt={game.label} style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover" }} />
          ) : game?.icon ? (
            <div style={{ fontSize: 48 }}>{game.icon}</div>
          ) : (
            <img src={logo} alt="Juntada" style={{ width: 64, height: 64, borderRadius: 16 }} />
          )}
          <h1 style={themedTitleStyle}>{game?.label ?? "Juntada"}</h1>
          {!gameId && !groupFlow && <p style={{ color: mutedColor, fontSize: 14, marginTop: 6 }}>Elegí un juego para arrancar</p>}
          {!gameId && !groupFlow && (
            <>
              <div style={{ marginTop: 14 }}>
                <NamePillEditor name={playerName} onSave={savePlayerName} />
              </div>
              <div ref={groupMenuRef} style={{ position: "relative", marginTop: 14, textAlign: "left" }}>
                <button onClick={() => setShowGroupMenu(v => !v)} style={S.groupFlowBar}>
                  👥 Crear o unirme a un grupo
                </button>
                {showGroupMenu && (
                  <div style={{ ...S.dropdownMenu, left: 0, right: 0, width: "auto" }}>
                    <button onClick={() => startGroupFlow("create")} style={S.dropdownMenuItem}>
                      ➕ Crear grupo
                    </button>
                    <button onClick={() => startGroupFlow("join")} style={S.dropdownMenuItem}>
                      🔗 Unirme a un grupo
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          {gameId && !mode && (
            <p
              style={{
                color: accentColor,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginTop: 6,
              }}
            >
              Elegí cómo jugar
            </p>
          )}
          {mode === "local" && (
            <p
              style={{
                color: accentColor,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginTop: 6,
              }}
            >
              Modo local · Un dispositivo
            </p>
          )}
          {mode === "multi" && (
            <p
              style={{
                color: accentColor,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginTop: 6,
              }}
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
                color: accentColor,
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
        {gameId && game?.localOnly && !game.comingSoon && !isUnderMaintenance(game) && !mode && (
          <Suspense fallback={<GameLoading />}>
            <game.LocalGame />
          </Suspense>
        )}

        {/* ── Paso 2: elegir modo (solo si el juego ya está implementado y soporta online) ── */}
        {gameId && !mode && game && !game.comingSoon && !isUnderMaintenance(game) && !game.localOnly && (
          <div>
            <div style={{ ...S.modeRow, borderLeft: "3px solid #7F77DD" }} onClick={() => setMode("multi")}>
              <div style={{ ...S.modeIconBadge, background: "rgba(127,119,221,0.18)" }}>🌐</div>
              <div style={{ flex: 1 }}>
                <p style={S.modeRowTitle}>Multijugador online</p>
                <p style={S.modeRowSubtitle}>Código de sala, cada uno desde su celular</p>
              </div>
              <div style={{ color: "#7F77DD", fontSize: 20 }}>›</div>
            </div>
            <div
              style={{ ...S.modeRow, borderLeft: "3px solid #5DCAA5" }}
              onClick={() => withCurtain(() => setMode("local"), Boolean(game?.gameTheme))}
            >
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
            initialJoinCode={pendingGroupJoinCode ?? validJoinLink?.code}
            initialGroupIntent={groupIntent}
            onGameTypeChange={handleRoomGameType}
            onRoomPhaseChange={setRoomPhase}
            onLeaveGroup={goHome}
            onSwitchToGroup={switchToGroupJoin}
            onGroupAttachedChange={setGroupAttached}
            onExposeReturnToGroup={exposeReturnToGroup}
            // `game` only reflects the *route's* gameId (set upfront for a
            // standalone room) — a group instance's game is picked from
            // inside the group screen itself, so `game` is still whatever it
            // was before (often null) at the exact moment a group create/
            // join fires. Callers there know the target game synchronously
            // (the picker's own gameId, or the instance's gameType) and pass
            // it as `themedOverride` instead of relying on this closure.
            runTransition={(action, themedOverride) => withAsyncCurtain(action, themedOverride ?? Boolean(game?.gameTheme))}
            onTransitionSettled={settleAsyncCurtain}
          />
        )}
      </div>

      {showDevNotice && <DevNoticeDialog onClose={dismissDevNotice} />}

      {showBackConfirm && (
        <ConfirmDialog
          title="¿Volver atrás?"
          message="Vas a salir del juego actual y perder el progreso de esta partida."
          confirmLabel="Sí, volver"
          cancelLabel="Seguir jugando"
          onConfirm={confirmGoBack}
          onCancel={() => setShowBackConfirm(false)}
        />
      )}

      {showExitConfirm && (
        <ConfirmDialog
          title="¿Volver al menú principal?"
          message={
            groupAttached
              ? "Vas a salir del grupo (y perder el progreso de esta partida, si había una en curso). Para volver vas a necesitar el código de nuevo."
              : "Vas a salir del juego actual y perder el progreso de esta partida."
          }
          confirmLabel="Sí, salir"
          cancelLabel="Seguir jugando"
          onConfirm={goHome}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}

      {showReturnToGroupConfirm && (
        <ConfirmDialog
          {...RETURN_TO_GROUP_CONFIRM}
          onConfirm={() => {
            setShowReturnToGroupConfirm(false);
            returnToGroupRef.current?.();
          }}
          onCancel={() => setShowReturnToGroupConfirm(false)}
        />
      )}
    </div>
  );
}
