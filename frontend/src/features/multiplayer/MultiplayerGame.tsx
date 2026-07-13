import { useState, useEffect, Suspense } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import { CodeDisplay } from "../../components/CodeDisplay";
import { QRDialog } from "../../components/QRDialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { getGame, GAME_LIST } from "../../games/registry";
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
  initialJoinCode?: string;
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
  return (GAME_LIST as GameDef[]).filter(g => !g.comingSoon && !g.localOnly);
}

export function MultiplayerGame({ entryKind, gameId, initialJoinCode, onGameTypeChange, onLeaveGroup }: MultiplayerGameProps) {
  const {
    connectionPhase,
    setConnectionPhase,
    me,
    room,
    group,
    myRole,
    wordReveal,
    error,
    setError,
    reconnecting,
    connect,
    send,
  } = useMultiplayerSocket({ onLeftGroup: onLeaveGroup });

  const [playerName, setPlayerName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? "");
  const [showQR, setShowQR] = useState(false);
  const [showCode, setShowCode] = useState(true);
  const [showCreateInstance, setShowCreateInstance] = useState(false);
  // Leaving mid-game silently forfeits whatever's in progress, so that path
  // gets a confirm — same pattern as the pre-existing "volver al lobby"
  // confirms elsewhere. Leaving from the lobby (nothing to lose) doesn't.
  const [confirmLeaveInstance, setConfirmLeaveInstance] = useState(false);
  const [confirmLeaveGroup, setConfirmLeaveGroup] = useState(false);

  // Scanned a "join this room/group" QR — skip straight to the join form
  // with the code already filled in, they just need to type their name.
  useEffect(() => {
    if (initialJoinCode && connectionPhase === "menu") setConnectionPhase("join");
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

  const isHost = !!(me && room && room.hostId === me.playerId);
  const myPlayer = room?.players?.find(p => p.id === me?.playerId);
  const selectedGame = (gameId ? getGame(gameId) : undefined) as GameDef | undefined;
  const activeGame = (room ? getGame(room.gameType) : selectedGame) as GameDef | undefined;
  const inGroup = entryKind === "group";

  const createRoom = () => {
    if (!playerName.trim()) return setError("Ingresá tu nombre");
    connect(ws => {
      if (inGroup) {
        ws.send(JSON.stringify({ type: "create_group", playerName: playerName.trim(), groupName: roomName.trim() || undefined }));
      } else {
        ws.send(
          JSON.stringify({
            type: "create_room",
            playerName: playerName.trim(),
            roomName: roomName.trim() || "Mi sala",
            gameType: gameId,
          }),
        );
      }
    });
  };

  const joinRoom = () => {
    if (!playerName.trim()) return setError("Ingresá tu nombre");
    if (!joinCode.trim()) return setError("Ingresá el código");
    const code = joinCode.toUpperCase().trim();
    connect(ws =>
      ws.send(JSON.stringify({ type: inGroup ? "join_group" : "join_room", code, playerName: playerName.trim() })),
    );
  };

  const updateConfig = (patch: Record<string, unknown>) => {
    if (!room) return;
    send({ type: "update_config", config: { ...room.config, ...patch } });
  };

  const leaveInstance = () => send({ type: "leave_instance" });

  // Shown across every phase — a dropped connection doesn't lose your spot
  // (see useMultiplayerSocket's session persistence), but on a flaky
  // connection the silent retry loop needs to be visible, or it just looks
  // frozen.
  const reconnectBanner = reconnecting && (
    <div
      style={{
        background: "rgba(226,196,74,0.1)",
        border: "1px solid rgba(226,196,74,0.3)",
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 16,
        color: "#E2C44A",
        fontSize: 13,
        textAlign: "center",
      }}
    >
      Reconectando...
    </div>
  );

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
            }}
          >
            {error}
          </div>
        )}
        <div style={S.card}>
          <span style={S.label}>Tu nombre</span>
          <input style={S.input} placeholder="¿Cómo te llamás?" value={playerName} onChange={e => setPlayerName(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <Btn
            variant={connectionPhase === "create" ? "primary" : "ghost"}
            onClick={() => setConnectionPhase("create")}
            style={{ flex: 1 }}
          >
            {inGroup ? "Crear grupo" : "Crear sala"}
          </Btn>
          <Btn variant={connectionPhase === "join" ? "primary" : "ghost"} onClick={() => setConnectionPhase("join")} style={{ flex: 1 }}>
            Unirse
          </Btn>
        </div>
        {connectionPhase === "create" && (
          <div style={S.card}>
            <span style={S.label}>{inGroup ? "Nombre del grupo" : "Nombre de la sala"}</span>
            <input
              style={S.input}
              placeholder={inGroup ? "Ej: Los pibes" : "Ej: Noche de juegos"}
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
            />
            {!inGroup && selectedGame && (
              <p style={{ ...S.muted, marginTop: 10 }}>
                {selectedGame.icon} Vas a jugar {selectedGame.label}
              </p>
            )}
            {inGroup && <p style={{ ...S.muted, marginTop: 10 }}>👥 Elegís qué jugar una vez adentro, con todo el grupo</p>}
            <Btn onClick={createRoom} style={{ marginTop: 12 }}>
              {inGroup ? "👥 Crear grupo" : "🚀 Crear sala"}
            </Btn>
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
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(127,119,221,0.08)" }}
            >
              <Avatar name={m.name} size={32} />
              <span style={{ flex: 1, fontWeight: 600 }}>{m.name}</span>
              {m.id === group.hostId && <span style={S.pill(false)}>Anfitrión</span>}
              {!m.online && <span style={S.pill(false)}>Desconectado</span>}
            </div>
          ))}
        </div>

        <div style={{ ...S.card, marginTop: 14 }}>
          <span style={S.label}>Partidas abiertas</span>
          {group.instances.length === 0 && (
            <p style={{ ...S.muted, margin: "8px 0 0" }}>Nadie abrió una partida todavía.</p>
          )}
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
  if (connectionPhase === "lobby" && room)
    return (
      <div>
        {reconnectBanner}
        {room.name && (
          <p style={{ textAlign: "center", fontSize: 18, fontWeight: 800, color: "#AFA9EC", margin: "0 0 12px" }}>{room.name}</p>
        )}
        {/* A group instance isn't meant to be joined by raw code — group
            membership (join_instance from the group screen) is how people
            find it. A standalone room still shares its code here, since
            that's its only invite mechanism. */}
        {room.groupCode === null && (
          <>
            {showCode ? (
              <CodeDisplay code={room.code} />
            ) : (
              <p style={{ textAlign: "center", color: "#6b6490", fontSize: 13 }}>Código oculto</p>
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 10 }}>
              <button
                onClick={() => setShowQR(true)}
                style={{ background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}
              >
                Invitar
              </button>
              <button
                onClick={() => setShowCode(v => !v)}
                style={{ background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}
              >
                {showCode ? "Ocultar código" : "Mostrar código"}
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
        {activeGame && <p style={{ ...S.muted, textAlign: "center", margin: "10px 0 0" }}>{activeGame.label}</p>}

        <div style={{ ...S.card, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={S.label}>
              {room.players.length}/{room.maxPlayers} jugadores
            </span>
            {room.players.length >= room.maxPlayers && <span style={S.pill(false)}>Sala llena</span>}
          </div>
          {room.players.map(p => (
            <div
              key={p.id}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(127,119,221,0.08)" }}
            >
              <Avatar name={p.name} size={32} />
              <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
              {p.id === room.hostId && <span style={S.pill(false)}>Anfitrión</span>}
              {!p.online && <span style={S.pill(false)}>Desconectado</span>}
              {isHost && p.id !== me?.playerId && (
                <button
                  onClick={() => send({ type: "kick_player", targetId: p.id })}
                  style={{ ...S.btn("danger"), width: "auto", padding: "4px 10px", fontSize: 12, borderRadius: 6 }}
                >
                  Expulsar
                </button>
              )}
            </div>
          ))}
        </div>

        {isHost && (
          <>
            {activeGame?.ConfigPanel && (
              <Suspense fallback={null}>
                <activeGame.ConfigPanel room={room} updateConfig={updateConfig} />
              </Suspense>
            )}
            <Btn
              variant="success"
              disabled={room.players.length < (activeGame?.minPlayers ?? 3)}
              onClick={() => send({ type: "start_round" })}
            >
              Iniciar ronda
            </Btn>
            {room.players.length < (activeGame?.minPlayers ?? 3) && (
              <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Necesitás mínimo {activeGame?.minPlayers ?? 3} jugadores</p>
            )}
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
