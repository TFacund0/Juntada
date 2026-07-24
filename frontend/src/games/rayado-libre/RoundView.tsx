import { useEffect, useRef, useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { Avatar } from "../../components/Avatar";
import { Timer } from "../../components/Timer";
import { RevealCountdown, useRevealCountdown } from "../../components/RevealCountdown";
import { LeaveToLobbyButton } from "../../components/LeaveToLobbyButton";
import { TURN_SECONDS } from "@juntada/rayado-libre-scoring";
import { Canvas, type DrawAction, type Tool } from "./Canvas";
import { Toolbar } from "./Toolbar";
import { PhaseTransition } from "../../components/PhaseTransition";
import { EyeToggle } from "./EyeToggle";
import { Scoreboard } from "./Scoreboard";
import type { RoundViewProps } from "../gameTypes";

const CHOOSE_SECONDS = 15;

interface ChatEntry {
  type: "chat" | "correct";
  playerId: string;
  text?: string;
}

// Shared by the drawer's read-only view during "drawing" and everyone's view
// during "reveal" — same rendering, just with or without an input below it.
function ChatMessages({ chatLog, players }: { chatLog: ChatEntry[]; players: RoundViewProps["room"]["players"] }) {
  if (chatLog.length === 0) return <p style={{ ...S.muted, margin: "0 0 12px" }}>Todavía no escribió nadie.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, minHeight: 20 }}>
      {chatLog.map((entry, i) => {
        const p = players.find(x => x.id === entry.playerId);
        if (!p) return null;
        return entry.type === "correct" ? (
          <p key={i} style={{ fontSize: 13, color: "#5DCAA5", margin: 0, fontWeight: 700 }}>
            ✓ {p.name} adivinó
          </p>
        ) : (
          <p key={i} style={{ fontSize: 13, color: "#b8b0d4", margin: 0 }}>
            <strong style={{ color: "#AFA9EC" }}>{p.name}:</strong> {entry.text}
          </p>
        );
      })}
    </div>
  );
}

function roomScore(room: RoundViewProps["room"]): Record<string, number> {
  return ((room.config as { score?: Record<string, number> })?.score ?? {}) as Record<string, number>;
}

interface RayadoLibreRoundState {
  turnNumber: number;
  totalTurns: number;
  drawerId: string;
  chooseTimerEnd?: number | null;
  timerEnd?: number | null;
  strokes?: DrawAction[];
  chatLog?: ChatEntry[];
  correctGuessers?: string[];
  roundPoints?: Record<string, number>;
  wordHint?: string;
  word?: string;
}

export function RoundView({ room, me, myPlayer, myRole, isHost, send }: RoundViewProps) {
  const round = room.round as RayadoLibreRoundState | null;
  const [tool, setTool] = useState<Tool>({ mode: "draw", color: "#1a1a1a", size: 10 });
  const [guessText, setGuessText] = useState("");
  const [pointsToast, setPointsToast] = useState<number | null>(null);
  const [wordVisible, setWordVisible] = useState(true);
  const lastGuessId = useRef<number | null>(null);

  const isDrawer = !!myRole?.isDrawer;
  const wordChoices = (myRole?.wordChoices as string[] | null) ?? null;
  const myWord = myRole?.word as string | undefined;
  const lastGuess = myRole?.lastGuess as { playerId: string; points: number; guessId: number } | undefined;

  // Shows a brief "+N puntos" toast exactly once per correct guess, diffing
  // guessId the same way impostor diffs rerollCount — private_role can arrive
  // again for unrelated reasons and shouldn't replay the toast each time.
  useEffect(() => {
    if (lastGuess && lastGuess.guessId !== lastGuessId.current) {
      lastGuessId.current = lastGuess.guessId;
      setPointsToast(lastGuess.points);
      const t = setTimeout(() => setPointsToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [lastGuess]);

  useEffect(() => {
    setGuessText("");
    setWordVisible(true);
  }, [round?.drawerId, room.phase]);

  // A brief "revelando..." beat before the final scoreboard, same pattern as
  // Impostor/Sintonía's own result screens — this game only ever reaches
  // "result" once per game (no repeated rounds), so a stable 0/1 key is
  // enough to trigger it exactly once.
  const revealCount = useRevealCountdown(room.phase === "result" ? 1 : 0);

  if (!round) return null;
  const drawerPlayer = room.players.find(p => p.id === round.drawerId);
  // A disconnected drawer doesn't skip their turn (see skipTurnIfDrawerGone
  // in the engine — only actually leaving the room does that); the turn
  // just runs out its normal timer with nothing happening on the board.
  // Surfacing this explicitly saves everyone else from wondering why.
  const drawerOffline = !isDrawer && !!drawerPlayer && !drawerPlayer.online;

  if (room.phase === "choosing") {
    return (
      <PhaseTransition phaseKey="choosing">
        <p style={{ textAlign: "center", fontSize: 13, color: "#9089c0", marginBottom: 8 }}>
          Turno {round.turnNumber}/{round.totalTurns}
        </p>
        {round.chooseTimerEnd && <Timer timerEnd={round.chooseTimerEnd} total={CHOOSE_SECONDS} label="Tiempo para elegir palabra" />}
        {drawerOffline && (
          <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginBottom: 8 }}>
            ⚠️ {drawerPlayer?.name} se desconectó — se elige una palabra sola si no vuelve a tiempo
          </p>
        )}

        {isDrawer ? (
          <div style={S.card}>
            <span style={S.label}>Elegí qué vas a dibujar</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              {(wordChoices ?? []).map(w => (
                <Btn key={w} variant="success" onClick={() => send({ type: "choose_word", word: w })}>
                  {w}
                </Btn>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ ...S.cardHighlight, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <Avatar name={drawerPlayer?.name ?? "?"} size={40} />
            <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{drawerPlayer?.name} está eligiendo la palabra...</p>
          </div>
        )}
      </PhaseTransition>
    );
  }

  if (room.phase === "drawing") {
    const strokes = round.strokes ?? [];
    const chatLog = round.chatLog ?? [];
    const correctGuessers = round.correctGuessers ?? [];
    const alreadyGuessed = !!me?.playerId && correctGuessers.includes(me.playerId);

    const submitGuess = () => {
      if (!guessText.trim()) return;
      send({ type: "guess", text: guessText.trim() });
      setGuessText("");
    };

    return (
      <PhaseTransition phaseKey="drawing">
        <p style={{ textAlign: "center", fontSize: 13, color: "#9089c0", marginBottom: 4 }}>
          Turno {round.turnNumber}/{round.totalTurns} — dibuja {drawerPlayer?.name}
        </p>
        {round.timerEnd && <Timer timerEnd={round.timerEnd} total={TURN_SECONDS} label="Tiempo para dibujar" />}
        {drawerOffline && (
          <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginBottom: 8 }}>
            ⚠️ {drawerPlayer?.name} se desconectó — el turno sigue corriendo hasta que se acabe el tiempo
          </p>
        )}

        {pointsToast != null && (
          <div style={{ ...S.cardHighlight, textAlign: "center", background: "rgba(93,202,165,0.15)" }}>
            <p style={{ fontWeight: 800, color: "#5DCAA5", margin: 0 }}>¡Adivinaste! +{pointsToast} puntos</p>
          </div>
        )}

        {isDrawer && myWord && (
          <div style={{ ...S.cardHighlight, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <p style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#AFA9EC", visibility: wordVisible ? "visible" : "hidden" }}>
              {myWord}
            </p>
            <EyeToggle visible={wordVisible} onClick={() => setWordVisible(v => !v)} />
          </div>
        )}

        {!isDrawer && round.wordHint && (
          <div style={{ ...S.cardHighlight, textAlign: "center" }}>
            <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.35em", margin: 0, fontFamily: "monospace" }}>{round.wordHint}</p>
          </div>
        )}

        <Canvas
          strokes={strokes}
          interactive={isDrawer}
          tool={isDrawer ? tool : undefined}
          onStrokeChunk={(points, color, size, strokeId) => send({ type: "draw_stroke", points, color, size, strokeId })}
          onFillAt={(x, y, color) => send({ type: "draw_fill", x, y, color })}
        />
        {isDrawer && (
          <Toolbar tool={tool} onChange={setTool} onClear={() => send({ type: "draw_clear" })} onUndo={() => send({ type: "draw_undo" })} />
        )}

        <div style={{ ...S.card, marginTop: 16 }}>
          <span style={S.label}>{isDrawer ? "Chat — lo que van escribiendo" : "Chat — escribí tu respuesta"}</span>
          {/* Only the last 5 while live — the full recent history (up to
              CHAT_LOG_LIMIT server-side) shows in the reveal-phase recap
              instead, so a busy turn's older guesses aren't lost entirely. */}
          <ChatMessages chatLog={chatLog.slice(-5)} players={room.players} />
          {!isDrawer &&
            (alreadyGuessed ? (
              <p style={{ ...S.muted, textAlign: "center" }}>Ya adivinaste esta ronda — esperá a que termine el turno.</p>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{ ...S.input, flex: 1 }}
                  placeholder="Tu respuesta..."
                  value={guessText}
                  onChange={e => setGuessText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") submitGuess();
                  }}
                />
                <Btn onClick={submitGuess} style={{ width: "auto", padding: "11px 18px" }}>
                  Enviar
                </Btn>
              </div>
            ))}
        </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "reveal") {
    const chatLog = round.chatLog ?? [];
    const roundPoints = round.roundPoints ?? {};
    const onlinePlayers = room.players.filter(p => p.online);
    const readyCount = onlinePlayers.filter(p => p.ready).length;
    const iAmReady = !!myPlayer?.ready;
    const isLastTurn = round.turnNumber === round.totalTurns;

    return (
      <PhaseTransition phaseKey="reveal">
        <p style={{ textAlign: "center", fontSize: 13, color: "#9089c0", marginBottom: 8 }}>
          Turno {round.turnNumber}/{round.totalTurns}
        </p>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#9089c0" }}>La palabra era</p>
          <p style={S.bigReveal}>{round.word}</p>
        </div>

        <div style={S.card}>
          <span style={S.label}>Cómo veníamos escribiendo</span>
          <ChatMessages chatLog={chatLog} players={room.players} />
        </div>

        <Scoreboard
          entries={room.players.map(p => ({
            id: p.id,
            name: p.name,
            score: roomScore(room)[p.id] || 0,
            roundPoints: roundPoints[p.id],
            isMe: p.id === me?.playerId,
          }))}
          title={isLastTurn ? "Tabla final" : "Tabla de puntos"}
        />

        <div style={{ ...S.card, marginTop: 16 }}>
          <span style={S.label}>Estado de jugadores</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {room.players.map(p => (
              <div key={p.id} style={{ ...S.pill(p.ready), opacity: p.online ? 1 : 0.55 }}>
                {p.name}
                {!p.online ? " · desconectado" : p.ready ? " · listo" : ""}
              </div>
            ))}
          </div>
        </div>

        {!iAmReady ? (
          <Btn variant="success" onClick={() => send({ type: "player_ready" })} style={{ marginTop: 8 }}>
            Listo para el siguiente turno
          </Btn>
        ) : (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#5DCAA5" }}>
              Listo — esperando a los demás ({readyCount}/{onlinePlayers.length})
            </p>
          </div>
        )}
      </PhaseTransition>
    );
  }

  if (room.phase === "result") {
    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando la tabla final..." />;
    return (
      <PhaseTransition phaseKey="result">
        <p style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#AFA9EC", margin: "8px 0 16px" }}>Fin del juego</p>
        <Scoreboard
          entries={room.players.map(p => ({ id: p.id, name: p.name, score: roomScore(room)[p.id] || 0, isMe: p.id === me?.playerId }))}
          title="Tabla final"
        />
        {isHost ? (
          <StartButton onClick={() => send({ type: "new_game" })}>Nueva partida</StartButton>
        ) : (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión inicie otra partida</p>
          </div>
        )}
        <LeaveToLobbyButton groupCode={room.groupCode} send={send} />
      </PhaseTransition>
    );
  }

  return null;
}
