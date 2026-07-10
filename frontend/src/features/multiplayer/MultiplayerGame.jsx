import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import { CodeDisplay } from "../../components/CodeDisplay";
import { getGame } from "../../games/registry";
import { useMultiplayerSocket } from "./useMultiplayerSocket";

// ═══════════════════════════════════════════════════════════════════════════════
// MULTIPLAYER SHELL (WebSocket) — sala, lobby y jugadores son genéricos acá.
// El juego a jugar ya viene elegido desde App.jsx (gameId); todo lo específico
// de ese juego (reglas, ronda, votación, resultado) se delega al motor
// registrado en games/registry.js vía room.gameType.
// ═══════════════════════════════════════════════════════════════════════════════

export function MultiplayerGame({ gameId }) {
  const {
    connectionPhase, setConnectionPhase,
    me, room, myRole, wordReveal, error, setError,
    connect, send,
  } = useMultiplayerSocket();

  const [playerName, setPlayerName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const isHost = me && room && room.hostId === me.playerId;
  const myPlayer = room?.players?.find(p => p.id === me?.playerId);
  const selectedGame = getGame(gameId);
  const activeGame = room ? getGame(room.gameType) : selectedGame;

  const createRoom = () => {
    if (!playerName.trim()) return setError("Ingresá tu nombre");
    connect((ws) => ws.send(JSON.stringify({
      type: "create_room",
      playerName: playerName.trim(),
      roomName: roomName.trim() || "Mi sala",
      gameType: gameId,
    })));
  };

  const joinRoom = () => {
    if (!playerName.trim()) return setError("Ingresá tu nombre");
    if (!joinCode.trim()) return setError("Ingresá el código");
    connect((ws) => ws.send(JSON.stringify({ type: "join_room", code: joinCode.toUpperCase().trim(), playerName: playerName.trim() })));
  };

  const updateConfig = (patch) => {
    send({ type: "update_config", config: { ...room.config, ...patch } });
  };

  // ── MENU ──
  if (connectionPhase === "menu" || connectionPhase === "create" || connectionPhase === "join") return (
    <div>
      {error && <div style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#F09595", fontSize: 13 }}>{error}</div>}
      <div style={S.card}>
        <span style={S.label}>Tu nombre</span>
        <input style={S.input} placeholder="¿Cómo te llamás?" value={playerName} onChange={e => setPlayerName(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Btn variant={connectionPhase === "create" ? "primary" : "secondary"} onClick={() => setConnectionPhase("create")} style={{ flex: 1 }}>Crear sala</Btn>
        <Btn variant={connectionPhase === "join" ? "primary" : "secondary"} onClick={() => setConnectionPhase("join")} style={{ flex: 1 }}>Unirse</Btn>
      </div>
      {connectionPhase === "create" && <div style={S.card}>
        <span style={S.label}>Nombre de la sala</span>
        <input style={S.input} placeholder="Ej: Noche de juegos" value={roomName} onChange={e => setRoomName(e.target.value)} />
        {selectedGame && <p style={{ ...S.muted, marginTop: 10 }}>{selectedGame.icon} Vas a jugar {selectedGame.label}</p>}
        <Btn onClick={createRoom} style={{ marginTop: 12 }}>🚀 Crear sala</Btn>
      </div>}
      {connectionPhase === "join" && <div style={S.card}>
        <span style={S.label}>Código de sala</span>
        <input style={{ ...S.input, letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 20, fontWeight: 700, textAlign: "center" }} placeholder="XXXXX" maxLength={5} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} />
        <Btn onClick={joinRoom} style={{ marginTop: 12 }}>Unirse →</Btn>
      </div>}
    </div>
  );

  // ── LOBBY ──
  if (connectionPhase === "lobby" && room) return (
    <div>
      <CodeDisplay code={room.code} />
      {activeGame && <p style={{ ...S.muted, textAlign: "center", margin: "10px 0 0" }}>{activeGame.label}</p>}
      <div style={{ ...S.card, marginTop: 14 }}>
        <span style={S.label}>{room.players.length} jugadores</span>
        {room.players.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(127,119,221,0.08)" }}>
            <Avatar name={p.name} size={32} />
            <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
            {p.id === room.hostId && <span style={S.pill(false)}>Anfitrión</span>}
            {!p.online && <span style={S.pill(false)}>Desconectado</span>}
            {isHost && p.id !== me.playerId && <button onClick={() => send({ type: "kick_player", targetId: p.id })} style={{ ...S.btn("danger"), width: "auto", padding: "4px 10px", fontSize: 12, borderRadius: 6 }}>Expulsar</button>}
          </div>
        ))}
      </div>

      {isHost && <>
        {activeGame && <activeGame.ConfigPanel room={room} updateConfig={updateConfig} />}
        <Btn variant="success" disabled={room.players.length < (activeGame?.minPlayers ?? 3)} onClick={() => send({ type: "start_round" })}>Iniciar ronda</Btn>
        {room.players.length < (activeGame?.minPlayers ?? 3) && <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Necesitás mínimo {activeGame?.minPlayers ?? 3} jugadores</p>}
      </>}

      {!isHost && <div style={{ ...S.card, textAlign: "center" }}>
        <p style={{ fontSize: 15, color: "#9089c0" }}>Esperando que el anfitrión inicie la partida</p>
      </div>}

      {error && <p style={{ color: "#F09595", fontSize: 13, textAlign: "center" }}>{error}</p>}
    </div>
  );

  // ── EN PARTIDA: cualquier fase que no sea menú/lobby es propia del juego,
  // así que se delega entera — este shell no necesita conocer sus nombres.
  // El banner de error se muestra acá (no dentro de cada RoundView) porque
  // una acción rechazada por el servidor (turno equivocado, jugada inválida,
  // etc.) es un caso genérico común a cualquier juego, no algo que cada
  // RoundView tenga que acordarse de manejar por su cuenta.
  if (!["menu", "create", "join", "lobby"].includes(connectionPhase) && room && activeGame) {
    return (
      <div>
        {error && <div style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#F09595", fontSize: 13 }}>{error}</div>}
        <activeGame.RoundView room={room} me={me} myPlayer={myPlayer} myRole={myRole} wordReveal={wordReveal} isHost={isHost} send={send} />
      </div>
    );
  }

  return <div style={{ textAlign: "center", padding: 40, color: "#6b6490" }}>Conectando...</div>;
}
