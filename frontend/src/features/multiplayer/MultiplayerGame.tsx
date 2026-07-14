import { useState, useEffect, useRef, Suspense } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import { CodeDisplay } from "../../components/CodeDisplay";
import { QRDialog } from "../../components/QRDialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { TabRow } from "../../components/TabRow";
import { StickyActionBar } from "../../components/StickyActionBar";
import { getGame, GAME_LIST } from "../../games/registry";
import { isUnderMaintenance } from "../../games/maintenance";
import type { GameDef } from "../../games/gameTypes";
import { useMultiplayerSocket } from "./useMultiplayerSocket";
import { buildRoomJoinUrl, buildGroupJoinUrl } from "./joinLink";

// ═══════════════════════════════════════════════════════════════════════════════
// MULTIPLAYER SHELL (WebSocket) — two independent entry points:
//   - "room": a standalone room for one specific game, picked up front on the
//     home screen (create_room/join_room/rejoin) — unchanged from before the
//     group feature existed.
//   - "group": a persistent group (create_group/join_group/rejoin_group) that
//     can have several game instances open at once; any member opens an
//     instance (create_instance) and any member independently joins one
//     (join_instance) or leaves it (leave_instance) to go back to the group
//     screen. The instance itself, once attached (`joined`), reuses the same
//     per-game lobby/round/result UI as a standalone room — that machinery is
//     unrelated to the group/room distinction.
// ═══════════════════════════════════════════════════════════════════════════════

interface MultiplayerGameProps {
  entryKind: "room" | "group";
  // Only meaningful for entryKind "room" — the game picked on the home
  // screen before ever connecting.
  gameId: string | null;
  // Collected once by App.tsx on first visit (and persisted there) — this
  // shell never asks for it itself, so creating/joining rooms and groups
  // never re-prompts.
  playerName: string;
  // Lets this screen update the stored name in place (e.g. after a "nombre
  // ya está en uso" error) instead of forcing the player back to App.tsx's
  // home screen just to retype it.
  onChangeName?: (name: string) => void;
  initialJoinCode?: string;
  // Only meaningful for entryKind "group" — lets the home screen's compact
  // group menu (tap "+" → Crear grupo / Unirme a un grupo) land directly on
  // the matching tab instead of the neutral menu screen.
  initialGroupIntent?: "create" | "join";
  // Lets the parent (App.tsx) keep its own header/title in sync with the
  // game actually active — e.g. after scanning a QR/join link for room X,
  // joining a room whose real gameType turns out to differ (a stale link,
  // or a different game than expected) should still show that room's actual
  // game, not whatever the link happened to encode. Called with null when
  // there's no active instance (e.g. sitting on the group screen).
  onGameTypeChange?: (gameType: string | null) => void;
  // Fires once the player has fully left the group (not just an instance
  // under it) — the group's own "menu" screen is indistinguishable from the
  // very first screen before ever connecting, so App.tsx needs this signal
  // to know it should leave the whole group flow and go back to its home
  // screen (pick a game / start a new group), not just re-render this shell.
  onLeaveGroup?: () => void;
}

function playableGames(): GameDef[] {
  return (GAME_LIST as GameDef[]).filter(g => !g.comingSoon && !isUnderMaintenance(g) && !g.localOnly);
}

export function MultiplayerGame({
  entryKind,
  gameId,
  playerName,
  onChangeName,
  initialJoinCode,
  initialGroupIntent,
  onGameTypeChange,
  onLeaveGroup,
}: MultiplayerGameProps) {
  const {
    connectionPhase,
    setConnectionPhase,
    me,
    room,
    groupMe,
    group,
    myRole,
    wordReveal,
    roomPreview,
    setRoomPreview,
    error,
    setError,
    reconnecting,
    reconnectAttempt,
    reconnectFailed,
    justReconnected,
    maxReconnectAttempts,
    connect,
    retryConnection,
    send,
    leave,
  } = useMultiplayerSocket({ onLeftGroup: onLeaveGroup, entryKind });

  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? "");
  const [joinGroupName, setJoinGroupName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(playerName);
  const [showQR, setShowQR] = useState(false);
  const [showCreateInstance, setShowCreateInstance] = useState(false);
  // Leaving mid-game silently forfeits whatever's in progress, so that path
  // gets a confirm — same pattern as the pre-existing "volver al lobby"
  // confirms elsewhere. Leaving from the lobby (nothing to lose) doesn't.
  const [confirmLeaveInstance, setConfirmLeaveInstance] = useState(false);
  const [confirmLeaveGroup, setConfirmLeaveGroup] = useState(false);
  // Host-only per-player actions (transfer host / kick) live behind a small
  // "⋮" menu instead of two always-visible buttons — only one open at a
  // time, keyed by playerId. Closed on outside click, same pattern as the
  // home screen's "+" group menu (see App.tsx's groupMenuRef).
  const [openPlayerMenu, setOpenPlayerMenu] = useState<string | null>(null);
  const playerMenuRef = useRef<HTMLDivElement>(null);
  // Some games' lobby has enough going on (player list + a meatier
  // ConfigPanel) that stacking both under one scroll reads as cluttered —
  // split them into top-level tabs instead, mirroring local mode's own
  // layout. Opt-in per game via GameDef.tabbedLobby (see gameTypes.ts);
  // most games' ConfigPanel is short enough that splitting it just adds a
  // click, so this only applies when the active game asks for it.
  const [lobbyTab, setLobbyTab] = useState<"players" | "config">("players");

  useEffect(() => {
    if (!openPlayerMenu) return;
    const onClickOutside = (e: MouseEvent) => {
      if (playerMenuRef.current && !playerMenuRef.current.contains(e.target as Node)) setOpenPlayerMenu(null);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openPlayerMenu]);

  // Scanned a "join this room/group" QR — skip straight to the join form
  // with the code already filled in, they just need to type their name.
  useEffect(() => {
    if (connectionPhase !== "menu") return;
    if (initialJoinCode) setConnectionPhase("join");
    else if (initialGroupIntent) setConnectionPhase(initialGroupIntent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The server's room.gameType is the only source of truth for which game
  // is actually active — surface it upward as soon as it's known, and clear
  // it back to null once there's no active instance (group screen).
  useEffect(() => {
    onGameTypeChange?.(room?.gameType ?? null);
  }, [room?.gameType, onGameTypeChange]);

  useEffect(() => {
    setConfirmLeaveInstance(false);
  }, [room?.code]);

  // Live preview of a standalone room as soon as the code is fully typed —
  // read-only lookup, no commitment (see checkRoomCode/room_preview on the
  // backend). Groups skip this: joining one already requires the name to
  // match the code (see joinRoom below), so there's no ambiguity left to
  // preview there.
  useEffect(() => {
    if (entryKind === "group") return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 5) {
      setRoomPreview(null);
      return;
    }
    connect(ws => ws.send(JSON.stringify({ type: "check_room_code", code })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode, entryKind]);

  // A join rejected for having a name someone else already has in that
  // room/group is recoverable right here — open the inline rename instead
  // of leaving the player stuck re-reading the same error with no way to
  // act on it short of abandoning this screen to edit the name elsewhere.
  useEffect(() => {
    if (error.includes("ya está en uso")) {
      setNameDraft(playerName);
      setEditingName(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    onChangeName?.(trimmed);
    setEditingName(false);
    setError("");
  };

  const isHost = !!(me && room && room.hostId === me.playerId);
  const isGroupHost = !!(me && group && group.hostId === me.playerId);
  const myPlayer = room?.players?.find(p => p.id === me?.playerId);
  const selectedGame = (gameId ? getGame(gameId) : undefined) as GameDef | undefined;
  const activeGame = (room ? getGame(room.gameType) : selectedGame) as GameDef | undefined;
  const inGroup = entryKind === "group";

  const createRoom = () => {
    // A room is created with one tap, no form: always an auto-generated
    // code and a default name (the game's own name — good enough, since a
    // room only lives for one match). Groups also always get an
    // auto-generated code — letting the host pick their own invited
    // collisions/weak codes like "1234" for no real benefit.
    connect(ws => {
      if (inGroup) {
        ws.send(JSON.stringify({ type: "create_group", playerName, groupName: roomName.trim() || undefined }));
      } else {
        ws.send(
          JSON.stringify({
            type: "create_room",
            playerName,
            roomName: selectedGame?.label ?? "Mi sala",
            gameType: gameId,
          }),
        );
      }
    });
  };

  const joinRoom = () => {
    if (inGroup && !joinGroupName.trim()) return setError("Ingresá el nombre del grupo");
    if (!joinCode.trim()) return setError("Ingresá el código");
    const code = joinCode.toUpperCase().trim();
    connect(ws =>
      ws.send(
        JSON.stringify({
          type: inGroup ? "join_group" : "join_room",
          code,
          playerName,
          ...(inGroup ? { groupName: joinGroupName.trim() } : {}),
        }),
      ),
    );
  };

  const updateConfig = (patch: Record<string, unknown>) => {
    if (!room) return;
    send({ type: "update_config", config: { ...room.config, ...patch } });
  };

  const leaveInstance = () => send({ type: "leave_instance" });

  // Whether a session belongs to a room or a group is decided the same way
  // the socket itself decides which rejoin message to send on reconnect
  // (see useMultiplayerSocket's onopen: groupMe takes priority) — so the
  // banner's wording always matches what's actually being rejoined.
  const reconnectContext = groupMe ? "grupo" : "sala";

  // Shown across every phase — a dropped connection doesn't lose your spot
  // (see useMultiplayerSocket's session persistence), but the retry loop
  // needs to be visible or it just looks frozen. Three states: mid-retry,
  // a brief confirmation right after recovering, or — once the automatic
  // retries are exhausted — a manual choice instead of failing silently.
  const reconnectBanner = (reconnecting || justReconnected || reconnectFailed) && (
    <div
      style={{
        background: reconnectFailed ? "rgba(226,75,74,0.1)" : justReconnected ? "rgba(74,226,138,0.1)" : "rgba(226,196,74,0.1)",
        border: `1px solid ${reconnectFailed ? "rgba(226,75,74,0.3)" : justReconnected ? "rgba(74,226,138,0.3)" : "rgba(226,196,74,0.3)"}`,
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 16,
        color: reconnectFailed ? "#F09595" : justReconnected ? "#7EE2A8" : "#E2C44A",
        fontSize: 13,
        textAlign: "center",
      }}
    >
      {reconnectFailed
        ? `No pudimos reconectarte a la ${reconnectContext}.`
        : justReconnected
          ? "Reconectado ✓"
          : `Reconectando a la ${reconnectContext}... (intento ${reconnectAttempt} de ${maxReconnectAttempts})`}
      {reconnectFailed && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "center" }}>
          <Btn variant="success" onClick={retryConnection} style={{ padding: "6px 14px", fontSize: 13 }}>
            Reintentar
          </Btn>
          <Btn variant="ghost" onClick={leave} style={{ padding: "6px 14px", fontSize: 13 }}>
            Volver al menú
          </Btn>
        </div>
      )}
    </div>
  );

  // ── AUTO-CREATING A STANDALONE ROOM ── (see the auto-create effect above —
  // no form for this case, just a brief loading state while the room spins up)
  // ── MENU ──
  if (connectionPhase === "menu" || connectionPhase === "create" || connectionPhase === "join")
    return (
      <div>
        {reconnectBanner}
        {error && (
          <div
            style={{
              background: "rgba(226,75,74,0.1)",
              border: "1px solid rgba(226,75,74,0.3)",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 16,
              color: "#F09595",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          {editingName ? (
            <div style={{ ...S.namePill, cursor: "default", paddingLeft: 12 }}>
              <input
                style={{
                  background: "none",
                  border: "none",
                  outline: "none",
                  color: "#e8e4f0",
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  width: 110,
                }}
                placeholder="Tu nombre"
                autoFocus
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setNameDraft(playerName);
                    setEditingName(false);
                  }
                }}
              />
              <button
                onClick={saveName}
                disabled={!nameDraft.trim()}
                aria-label="Guardar nombre"
                style={{
                  background: "rgba(93,202,165,0.18)",
                  border: "none",
                  borderRadius: 999,
                  color: "#5DCAA5",
                  cursor: nameDraft.trim() ? "pointer" : "default",
                  opacity: nameDraft.trim() ? 1 : 0.4,
                  fontSize: 14,
                  fontFamily: "inherit",
                  fontWeight: 700,
                  padding: "5px 10px",
                }}
              >
                ✓
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setNameDraft(playerName);
                setEditingName(true);
              }}
              style={S.namePill}
            >
              <Avatar name={playerName} size={22} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#e8e4f0" }}>{playerName}</span>
              <span style={{ color: "#7F77DD", fontSize: 13 }}>✎</span>
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <Btn
            variant={connectionPhase === "create" ? "primary" : "ghost"}
            onClick={() => setConnectionPhase("create")}
            style={{ flex: 1 }}
          >
            {inGroup ? "Crear grupo" : "Crear partida"}
          </Btn>
          <Btn variant={connectionPhase === "join" ? "primary" : "ghost"} onClick={() => setConnectionPhase("join")} style={{ flex: 1 }}>
            Unirse
          </Btn>
        </div>
        {inGroup && connectionPhase === "create" && (
          <div style={S.card}>
            <span style={S.label}>Nombre del grupo</span>
            <input style={S.input} placeholder="Ej: Los pibes" value={roomName} onChange={e => setRoomName(e.target.value)} />
            <p style={{ ...S.muted, marginTop: 10 }}>Elegís qué jugar una vez adentro, con todo el grupo</p>
          </div>
        )}
        {connectionPhase === "create" && (
          <div style={S.card}>
            <span style={S.label}>Código de acceso</span>
            <p style={{ ...S.muted, margin: 0 }}>
              El servidor genera un código random de 5 caracteres (ej. XJ7K2), listo cuando toques "Crear".
            </p>
            <Btn onClick={createRoom} style={{ marginTop: 14 }}>
              {inGroup ? "Crear grupo" : "Crear partida"}
            </Btn>
          </div>
        )}
        {connectionPhase === "join" && inGroup && (
          <div style={S.card}>
            <span style={S.label}>Nombre del grupo</span>
            <input style={S.input} placeholder="Ej: Los pibes" value={joinGroupName} onChange={e => setJoinGroupName(e.target.value)} />
          </div>
        )}
        {connectionPhase === "join" && (
          <div style={S.card}>
            <span style={S.label}>{inGroup ? "Código del grupo" : "Código de sala"}</span>
            <input
              style={{ ...S.input, letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 20, fontWeight: 700, textAlign: "center" }}
              placeholder="XXXXX"
              maxLength={5}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
            />
            {!inGroup &&
              roomPreview &&
              roomPreview.code === joinCode.trim().toUpperCase() &&
              (roomPreview.found ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(93,202,165,0.1)",
                    border: "1px solid rgba(93,202,165,0.3)",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, color: "#5DCAA5" }}>
                    {getGame(roomPreview.gameType ?? "")?.icon} Vas a unirte a: <b>{roomPreview.name}</b>
                  </p>
                  {selectedGame && roomPreview.gameType !== selectedGame.id && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#EF9F27" }}>
                      Ojo: esa sala es de {getGame(roomPreview.gameType ?? "")?.label ?? roomPreview.gameType}, no de {selectedGame.label}
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ ...S.muted, marginTop: 10, fontSize: 12 }}>No encontramos ninguna sala con ese código</p>
              ))}
            <Btn onClick={joinRoom} style={{ marginTop: 12 }}>
              Unirse →
            </Btn>
          </div>
        )}
      </div>
    );

  // ── GROUP (attached to a group, no active instance) ──
  if (connectionPhase === "group" && group)
    return (
      <div>
        {reconnectBanner}
        <p style={{ textAlign: "center", fontSize: 18, fontWeight: 800, color: "#AFA9EC", margin: "0 0 12px" }}>{group.name}</p>
        <CodeDisplay code={group.code} />
        <button
          onClick={() => setShowQR(true)}
          style={{
            display: "block",
            margin: "10px auto 0",
            background: "none",
            border: "none",
            color: "#7F77DD",
            cursor: "pointer",
            fontSize: 13,
            fontFamily: "inherit",
            fontWeight: 700,
          }}
        >
          Invitar
        </button>
        {showQR && (
          <QRDialog
            title="Escaneá para unirte"
            subtitle={`${group.name} · Grupo ${group.code}`}
            value={buildGroupJoinUrl(group.code)}
            onClose={() => setShowQR(false)}
          />
        )}

        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={S.label}>
              {group.members.length}/{group.maxMembers} en el grupo
            </span>
          </div>
          {group.members.map(m => (
            <div
              key={m.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid rgba(127,119,221,0.08)",
              }}
            >
              <Avatar name={m.name} size={32} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: m.id === me?.playerId ? 800 : 600,
                  color: m.id === me?.playerId ? "#fff" : undefined,
                }}
              >
                {m.name}
                {m.id === me?.playerId && " (vos)"}
              </span>
              {m.id === group.hostId && <span style={S.pill(false)}>Anfitrión</span>}
              {!m.online && <span style={S.pill(false)}>Desconectado</span>}
              {isGroupHost && m.id !== me?.playerId && m.online && (
                <button
                  onClick={() => send({ type: "transfer_host", targetId: m.id })}
                  style={{ ...S.btn("ghost"), width: "auto", padding: "4px 10px", fontSize: 12, borderRadius: 6 }}
                >
                  Hacer anfitrión
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <span style={S.label}>Partidas abiertas</span>
          {group.instances.length === 0 && <p style={{ ...S.muted, margin: "8px 0 0" }}>Nadie abrió una partida todavía.</p>}
          {group.instances.map(inst => {
            const g = getGame(inst.gameType) as GameDef | undefined;
            const joinable = inst.phase === "lobby" && inst.playerCount < inst.maxPlayers;
            return (
              <div
                key={inst.roomCode}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(127,119,221,0.08)",
                }}
              >
                <span style={{ fontSize: 22 }}>{g?.icon ?? "🎮"}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, margin: 0 }}>{g?.label ?? inst.gameType}</p>
                  <p style={{ ...S.muted, margin: 0, fontSize: 12 }}>
                    {inst.hostName} · {inst.playerCount}/{inst.maxPlayers} {!joinable && inst.phase !== "lobby" && "· en curso"}
                    {!joinable && inst.phase === "lobby" && "· llena"}
                  </p>
                </div>
                <button
                  disabled={!joinable}
                  onClick={() => send({ type: "join_instance", roomCode: inst.roomCode })}
                  style={{
                    ...S.btn(joinable ? "primary" : "ghost"),
                    width: "auto",
                    padding: "6px 14px",
                    fontSize: 13,
                    borderRadius: 8,
                    opacity: joinable ? 1 : 0.5,
                    cursor: joinable ? "pointer" : "not-allowed",
                  }}
                >
                  {joinable ? "Unirse" : "—"}
                </button>
              </div>
            );
          })}
        </div>

        <Btn variant="ghost" onClick={() => setShowCreateInstance(v => !v)} style={{ marginTop: 10 }}>
          {showCreateInstance ? "Cancelar" : "➕ Crear partida"}
        </Btn>
        {showCreateInstance && (
          <div style={{ ...S.card, marginTop: 10 }}>
            <span style={S.label}>Elegí un juego</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {playableGames().map(g => (
                <button
                  key={g.id}
                  onClick={() => {
                    send({ type: "create_instance", gameType: g.id });
                    setShowCreateInstance(false);
                  }}
                  style={{
                    ...S.btn("ghost"),
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    justifyContent: "flex-start",
                    padding: "10px 14px",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{g.icon}</span>
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Btn variant="ghost" onClick={() => setConfirmLeaveGroup(true)} style={{ marginTop: 14, opacity: 0.8 }}>
          Salir del grupo
        </Btn>
        {confirmLeaveGroup && (
          <ConfirmDialog
            title="¿Salir del grupo?"
            message="Dejás de formar parte de este grupo. Para volver vas a necesitar el código de nuevo."
            confirmLabel="Sí, salir"
            onConfirm={() => {
              send({ type: "leave_group" });
              setConfirmLeaveGroup(false);
            }}
            onCancel={() => setConfirmLeaveGroup(false)}
          />
        )}

        {error && <p style={{ color: "#F09595", fontSize: 13, textAlign: "center", marginTop: 10 }}>{error}</p>}
      </div>
    );

  // ── LOBBY ── (either a standalone room or a group instance's lobby)
  if (connectionPhase === "lobby" && room) {
    const showLobbyTabs = isHost && !!activeGame?.tabbedLobby;
    return (
      <div style={isHost ? { paddingBottom: 88 } : undefined}>
        {reconnectBanner}
        {/* A group instance isn't meant to be joined by raw code — group
            membership (join_instance from the group screen) is how people
            find it. A standalone room still shares its code here, since
            that's its only invite mechanism. */}
        {room.groupCode === null && (
          <>
            <CodeDisplay code={room.code} />
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 10 }}>
              <button
                onClick={() => setShowQR(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#7F77DD",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "inherit",
                  fontWeight: 700,
                }}
              >
                Invitar
              </button>
            </div>
            {showQR && (
              <QRDialog
                title="Escaneá para unirte"
                subtitle={`${room.name ? room.name + " · " : ""}Sala ${room.code} · ${activeGame?.label ?? ""}`}
                value={buildRoomJoinUrl(room.gameType, room.code)}
                onClose={() => setShowQR(false)}
              />
            )}
          </>
        )}
        {showLobbyTabs && (
          <TabRow
            tabs={[
              { key: "players", label: "Jugadores" },
              { key: "config", label: "Configuración" },
            ]}
            active={lobbyTab}
            onChange={setLobbyTab}
            style={{ marginTop: 14, marginBottom: 14 }}
          />
        )}

        {(!showLobbyTabs || lobbyTab === "players") && (
          <div style={{ ...S.card, marginTop: showLobbyTabs ? 0 : 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={S.label}>
                {room.players.length}/{room.maxPlayers} jugadores
              </span>
              {room.players.length >= room.maxPlayers && <span style={S.pill(false)}>Sala llena</span>}
            </div>
            {room.players.map(p => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(127,119,221,0.08)",
                }}
              >
                <Avatar name={p.name} size={32} />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: p.id === me?.playerId ? 800 : 600,
                    color: p.id === me?.playerId ? "#fff" : undefined,
                  }}
                >
                  {p.name}
                  {p.id === me?.playerId && " (vos)"}
                </span>
                {p.id === room.hostId && <span style={S.pill(false)}>Anfitrión</span>}
                {!p.online && <span style={S.pill(false)}>Desconectado</span>}
                {isHost && p.id !== me?.playerId && (
                  <div ref={openPlayerMenu === p.id ? playerMenuRef : undefined} style={{ position: "relative" }}>
                    <button
                      onClick={() => setOpenPlayerMenu(v => (v === p.id ? null : p.id))}
                      aria-label={`Opciones para ${p.name}`}
                      style={{
                        ...S.btn("ghost"),
                        width: 30,
                        height: 30,
                        padding: 0,
                        borderRadius: 8,
                        fontSize: 16,
                        lineHeight: 1,
                        fontWeight: 800,
                      }}
                    >
                      ⋮
                    </button>
                    {openPlayerMenu === p.id && (
                      <div style={{ ...S.dropdownMenu, width: 170 }}>
                        {p.online && (
                          <button
                            onClick={() => {
                              send({ type: "transfer_host", targetId: p.id });
                              setOpenPlayerMenu(null);
                            }}
                            style={S.dropdownMenuItem}
                          >
                            👑 Hacer anfitrión
                          </button>
                        )}
                        <button
                          onClick={() => {
                            send({ type: "kick_player", targetId: p.id });
                            setOpenPlayerMenu(null);
                          }}
                          style={{ ...S.dropdownMenuItem, color: "#F09595" }}
                        >
                          🚫 Expulsar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {isHost && (
          <>
            {activeGame?.ConfigPanel && (!showLobbyTabs || lobbyTab === "config") && (
              <Suspense fallback={null}>
                <activeGame.ConfigPanel room={room} updateConfig={updateConfig} />
              </Suspense>
            )}
            <StickyActionBar>
              {(() => {
                const notEnoughPlayers = room.players.length < (activeGame?.minPlayers ?? 3);
                const notReadyReason = notEnoughPlayers ? null : (activeGame?.canStart?.(room) ?? null);
                return (
                  <>
                    <Btn
                      variant="success"
                      disabled={notEnoughPlayers || !!notReadyReason}
                      onClick={() => send({ type: "start_round" })}
                    >
                      {activeGame?.startLabel ?? "Iniciar ronda"}
                    </Btn>
                    {notEnoughPlayers ? (
                      <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Necesitás mínimo {activeGame?.minPlayers ?? 3} jugadores</p>
                    ) : (
                      notReadyReason && <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginTop: 8 }}>{notReadyReason}</p>
                    )}
                  </>
                );
              })()}
            </StickyActionBar>
          </>
        )}

        {!isHost && (
          <>
            {activeGame?.LobbyInfo && (
              <Suspense fallback={null}>
                <activeGame.LobbyInfo room={room} />
              </Suspense>
            )}
            <div style={{ ...S.card, textAlign: "center" }}>
              <p style={{ fontSize: 15, color: "#9089c0" }}>Esperando que el anfitrión inicie la partida</p>
            </div>
          </>
        )}

        {room.groupCode !== null && (
          <Btn variant="ghost" onClick={leaveInstance} style={{ marginTop: 10 }}>
            👥 Volver al grupo
          </Btn>
        )}

        {error && <p style={{ color: "#F09595", fontSize: 13, textAlign: "center" }}>{error}</p>}
      </div>
    );
  }

  // ── EN PARTIDA: cualquier fase que no sea menú/lobby/group es propia del
  // juego, así que se delega entera — este shell no necesita conocer sus
  // nombres. El banner de error se muestra acá (no dentro de cada RoundView)
  // porque una acción rechazada por el servidor (turno equivocado, jugada
  // inválida, etc.) es un caso genérico común a cualquier juego.
  if (!["menu", "create", "join", "lobby", "group"].includes(connectionPhase) && room && activeGame) {
    return (
      <div>
        {reconnectBanner}
        {error && (
          <div
            style={{
              background: "rgba(226,75,74,0.1)",
              border: "1px solid rgba(226,75,74,0.3)",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 16,
              color: "#F09595",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {room.groupCode !== null && (
          <button
            onClick={() => setConfirmLeaveInstance(true)}
            style={{
              display: "block",
              margin: "0 auto 14px",
              background: "none",
              border: "none",
              color: "#6b6490",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
              fontWeight: 700,
            }}
          >
            👥 Volver al grupo
          </button>
        )}

        <Suspense fallback={<p style={{ textAlign: "center", color: "#6b6490", padding: 40 }}>Cargando juego...</p>}>
          {activeGame.RoundView && (
            <activeGame.RoundView
              room={room}
              me={me}
              myPlayer={myPlayer}
              myRole={myRole}
              wordReveal={wordReveal}
              isHost={isHost}
              send={send}
            />
          )}
        </Suspense>

        {confirmLeaveInstance && (
          <ConfirmDialog
            title="¿Volver al grupo?"
            message="Vas a salir de esta partida en curso y perder tu progreso. El resto puede seguir jugando sin vos."
            confirmLabel="Sí, volver"
            onConfirm={() => {
              leaveInstance();
              setConfirmLeaveInstance(false);
            }}
            onCancel={() => setConfirmLeaveInstance(false)}
          />
        )}
      </div>
    );
  }

  return <div style={{ textAlign: "center", padding: 40, color: "#6b6490" }}>Conectando...</div>;
}
