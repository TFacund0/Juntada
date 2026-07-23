import { useState, useEffect, useRef } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { LeaveToLobbyButton } from "../../components/LeaveToLobbyButton";
import { Avatar } from "../../components/Avatar";
import { Timer } from "../../components/Timer";
import { RevealCountdown, useRevealCountdown } from "../../components/RevealCountdown";
import { PhaseTransition } from "../../components/PhaseTransition";
import { EliminatedPlayerCard } from "./EliminatedPlayerCard";
import type { RoundViewProps } from "../gameTypes";
import type { PublicPlayer } from "@juntada/shared-types";

// Mirrors backend/src/games/impostor/engine.ts's getPublicRoundView.
interface ImpostorRoundState {
  categoryLabel: string;
  categoryIcon: string;
  impostorCount: number;
  timerEnd: number | null;
  discussionEnd: number | null;
  turnOrder: string[];
  turnIndex: number;
  clues: Record<string, string>;
  votes: Record<string, string>;
  matchEliminated: string[];
  eliminated: string | null;
  wasImpostor?: boolean;
  tally?: Record<string, number>;
  impostors?: string[];
  matchOver: boolean;
  winner: "innocents" | "impostors" | null;
  abortedReason?: "impostor_disconnected";
  votesDiscarded?: boolean;
  tieBrokenRandomly?: boolean;
  restartedReason?: "word_pool_exhausted";
  skipVotes: number;
  skipVoterIds: string[];
  skipVotesNeeded: number;
  rerollCount: number;
  revoteCandidates: string[] | null;
  revoteCount: number;
}

// Snapshot pushed onto room.roundHistory once a vote resolves (see engine.ts's
// tallyVotes/abortMatchImpostorLeft) — a different, smaller shape than the
// live public round view above since the round itself is gone by then.
interface ImpostorHistoryEntry {
  word: string;
  categoryLabel: string;
  categoryIcon: string;
  impostors: string[];
  eliminated: string | null;
  wasImpostor?: boolean;
  tally: Record<string, number>;
  matchOver: boolean;
  winner: "innocents" | "impostors" | null;
  abortedReason?: "impostor_disconnected";
  votesDiscarded?: boolean;
  tieBrokenRandomly?: boolean;
}

// Only the fields this view actually reads, out of the full ImpostorConfig
// backend/src/games/impostor/engine.ts defines.
interface ImpostorConfigState {
  writtenClues: boolean;
  hintsEnabled: boolean;
  clueTime: number;
  discussionTime: number;
}

function PlayerReadyPills({ players }: { players: PublicPlayer[] }) {
  return (
    <div style={{ ...S.card, marginTop: 16 }}>
      <span style={S.label}>Estado de jugadores</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {players.map(p => (
          <div key={p.id} style={{ ...S.pill(p.ready), opacity: p.online ? 1 : 0.55 }}>
            {p.name}
            {!p.online ? " · desconectado" : p.ready ? " · listo" : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function CluesReview({ clues, players }: { clues: Record<string, string> | undefined; players: PublicPlayer[] }) {
  const entries = Object.entries(clues || {}).filter(([, clue]) => clue);
  if (entries.length === 0) return null;
  return (
    <div style={S.card}>
      <span style={S.label}>Palabras</span>
      {entries.map(([playerId, clue]) => {
        const p = players.find(x => x.id === playerId);
        if (!p) return null;
        return (
          <p key={playerId} style={{ fontSize: 14, margin: "4px 0", color: "#b8b0d4" }}>
            <strong style={{ color: "#AFA9EC" }}>{p.name}:</strong> {clue}
          </p>
        );
      })}
    </div>
  );
}

// The round phase's turn order laid out as a circle: whoever's turn it is
// glows, players who already went are dimmed with a checkmark, and everyone
// else waits their turn — so it's visually obvious who's up without reading
// a list of names.
function TurnCircle({
  turnOrder,
  turnIndex,
  players,
  clues,
  meId,
}: {
  turnOrder: string[];
  turnIndex: number;
  players: PublicPlayer[];
  clues: Record<string, string> | undefined;
  meId: string | undefined;
}) {
  const size = 260;
  const radius = 96;
  const center = size / 2;
  const ordered = turnOrder.map(id => players.find(p => p.id === id)).filter((p): p is PublicPlayer => Boolean(p));
  const n = ordered.length;
  const current = ordered[turnIndex];

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto 12px" }}>
      {ordered.map((p, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        const isCurrent = i === turnIndex;
        const hasGone = i < turnIndex;
        const isMe = p.id === meId;
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              width: 68,
            }}
          >
            <div
              style={{
                position: "relative",
                borderRadius: "50%",
                padding: 3,
                border: isCurrent ? "2px solid #5DCAA5" : hasGone ? "2px solid rgba(127,119,221,0.45)" : "2px solid transparent",
                boxShadow: isCurrent ? "0 0 14px rgba(93,202,165,0.55)" : "none",
                opacity: !p.online ? 0.4 : hasGone && !isCurrent ? 0.55 : 1,
                transition: "all 0.2s",
              }}
            >
              <Avatar name={p.name} size={44} />
              {!p.online ? (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    background: "#6b6490",
                    color: "#fff",
                    borderRadius: "50%",
                    width: 16,
                    height: 16,
                    fontSize: 9,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ⏸
                </span>
              ) : (
                hasGone && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      background: "#5DCAA5",
                      color: "#0f0c1d",
                      borderRadius: "50%",
                      width: 16,
                      height: 16,
                      fontSize: 10,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✓
                  </span>
                )
              )}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: isCurrent ? 800 : 600,
                color: !p.online ? "#6b6490" : isCurrent ? "#5DCAA5" : isMe ? "#fff" : "#9089c0",
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 68,
              }}
            >
              {isMe ? "Vos" : p.name}
              {!p.online ? " (desc.)" : ""}
            </span>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: center, top: center, transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "#9089c0", margin: 0 }}>Turno de</p>
        <p style={{ fontSize: 15, fontWeight: 800, color: "#AFA9EC", margin: 0, maxWidth: 100 }}>{current?.name ?? "—"}</p>
      </div>
    </div>
  );
}

// Covers this game's in-progress phases (round/discussion/voting/result)
// inside a multiplayer room. The generic shell (MultiplayerGame.jsx) only
// knows to render this while room.phase is one of those — everything about
// what those phases *mean* for Impostor lives here.
export function RoundView({ room, me, myPlayer, myRole, wordReveal, isHost, send }: RoundViewProps) {
  const [wordVisible, setWordVisible] = useState(false);
  const [clueText, setClueText] = useState("");
  const [clueSubmitted, setClueSubmitted] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);
  const [voteConfirmed, setVoteConfirmed] = useState(false);
  const [wordChangeCount, setWordChangeCount] = useState(0);
  const prevRerollCount = useRef<number | null>(null);
  const [restartBannerCount, setRestartBannerCount] = useState(0);
  // "unset" is a sentinel outside restartedReason's actual value space
  // ("word_pool_exhausted" | undefined) so the very first render (joining or
  // reconnecting into an already-restarted match) never counts as a change —
  // same first-render guard as prevRerollCount above, just spelled out
  // explicitly since undefined itself is one of the real values here.
  const prevRestartedReason = useRef<string | undefined | "unset">("unset");
  const revealCount = useRevealCountdown(room.roundHistory?.length ?? 0);

  const round = room.round as ImpostorRoundState | null;
  const config = room.config as unknown as ImpostorConfigState;

  // A fresh private_role arrives on round start AND on a word reroll — either
  // way it's a new word, so re-hide it and clear per-round local UI state.
  useEffect(() => {
    setWordVisible(false);
    setClueText("");
    setClueSubmitted(false);
    setSelectedSuspect(null);
    setVoteConfirmed(false);
  }, [myRole]);

  // round.rerollCount only bumps when skip_word actually swaps the word —
  // show a short "cambiando de palabra" transition instead of the new word
  // just appearing instantly. Skipped on the very first render (joining an
  // in-progress round shouldn't play the transition for old history).
  useEffect(() => {
    const current = round?.rerollCount ?? 0;
    if (prevRerollCount.current !== null && current !== prevRerollCount.current) {
      setWordChangeCount(2);
    }
    prevRerollCount.current = current;
  }, [round?.rerollCount]);

  useEffect(() => {
    if (wordChangeCount <= 0) return;
    const t = setTimeout(() => setWordChangeCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [wordChangeCount]);

  // Someone's "pedir otra palabra" can, rarely, run out of unused words in
  // the category entirely — rerollWord then falls back to a whole new match
  // (new category, new impostors, eliminations cleared). That's a much
  // bigger change than a normal reroll, so it gets its own explicit banner
  // instead of just quietly landing everyone back on "round" with a
  // different word and no explanation. Skipped on the very first render
  // (joining/reconnecting into an already-restarted match shouldn't replay
  // this for old history) — same guard as prevRerollCount above.
  useEffect(() => {
    const current = round?.restartedReason;
    if (prevRestartedReason.current !== "unset" && current === "word_pool_exhausted" && current !== prevRestartedReason.current) {
      setRestartBannerCount(3);
    }
    prevRestartedReason.current = current;
  }, [round?.restartedReason]);

  useEffect(() => {
    if (restartBannerCount <= 0) return;
    const t = setTimeout(() => setRestartBannerCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [restartBannerCount]);

  // A tie triggers a fresh vote among just the tied suspects — clear the
  // previous selection/confirmation so nobody's stuck showing a stale vote.
  useEffect(() => {
    setSelectedSuspect(null);
    setVoteConfirmed(false);
  }, [round?.revoteCount]);

  if (room.phase === "round") {
    if (wordChangeCount > 0) return <RevealCountdown count={wordChangeCount} label="Cambiando de palabra..." />;
    if (restartBannerCount > 0) {
      return <RevealCountdown count={restartBannerCount} label="No quedaban más palabras en esa categoría: arrancó una partida nueva" />;
    }

    const turnOrder: string[] = round?.turnOrder || [];
    const turnIndex: number = round?.turnIndex ?? 0;
    const currentTurnId = turnOrder[turnIndex];
    const isMyTurn = !!me?.playerId && currentTurnId === me.playerId;
    const currentTurnPlayer = room.players.find(p => p.id === currentTurnId);
    const requiresWrittenClue = config.writtenClues;

    const submitClue = () => {
      if (requiresWrittenClue && !clueText.trim()) return;
      send({ type: "submit_clue", clue: requiresWrittenClue ? clueText.trim() : "" });
      setClueSubmitted(true);
    };

    return (
      <PhaseTransition phaseKey={`round-${currentTurnId}`}>
      <div>
        {round?.timerEnd && <Timer timerEnd={round.timerEnd} total={config.clueTime} label="Tiempo para dar su palabra" />}

        <div
          style={{
            ...S.card,
            textAlign: "center",
            cursor: "pointer",
            minHeight: 140,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setWordVisible(v => !v)}
        >
          {!myRole ? (
            <p style={{ color: "#6b6490" }}>Cargando tu rol...</p>
          ) : !wordVisible ? (
            <p style={{ color: "#6b6490", fontSize: 14 }}>Tocá para ver tu palabra</p>
          ) : myRole.isImpostor ? (
            <>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#F09595", margin: "0 0 8px" }}>Sos el impostor</p>
              {myRole.hint ? <p style={{ fontSize: 13, color: "#9089c0" }}>{String(myRole.hint)}</p> : null}
              <p style={{ fontSize: 12, color: "#5a5280", marginTop: 8 }}>Tocá para ocultar</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#9089c0", marginBottom: 4 }}>Tu palabra secreta</p>
              <p style={S.bigReveal}>{String(myRole.word)}</p>
              <p style={{ fontSize: 12, color: "#5a5280", marginTop: 6 }}>Tocá para ocultar</p>
            </>
          )}
        </div>

        {round &&
          (() => {
            const skipVoterIds: string[] = round.skipVoterIds || [];
            const amSkipRequesting = !!me?.playerId && skipVoterIds.includes(me.playerId);
            return (
              <div style={{ ...S.card, textAlign: "center" }}>
                {!amSkipRequesting ? (
                  <Btn variant="ghost" onClick={() => send({ type: "skip_word" })}>
                    No conozco esta palabra, pedir otra
                  </Btn>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: "#9089c0" }}>
                      Pediste cambiarla — {round.skipVotes}/{round.skipVotesNeeded} necesarios para cambiarla
                    </p>
                    <Btn variant="ghost" onClick={() => send({ type: "cancel_skip_word" })} style={{ marginTop: 8 }}>
                      Cancelar pedido
                    </Btn>
                  </>
                )}
                {skipVoterIds.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 10 }}>
                    {skipVoterIds.map(id => {
                      const p = room.players.find(x => x.id === id);
                      if (!p) return null;
                      return (
                        <span key={id} style={S.pill(true)}>
                          {p.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

        <div style={S.card}>
          <span style={S.label}>Ronda de turnos</span>
          {turnOrder.length > 0 && (
            <p style={{ ...S.muted, textAlign: "center", marginBottom: 8 }}>
              Turno {turnIndex + 1}/{turnOrder.length}
            </p>
          )}
          <TurnCircle turnOrder={turnOrder} turnIndex={turnIndex} players={room.players} clues={round?.clues} meId={me?.playerId} />

          {isMyTurn && !clueSubmitted ? (
            requiresWrittenClue ? (
              <>
                <span style={S.label}>Tu palabra</span>
                <input style={S.input} placeholder="Escribí tu palabra..." value={clueText} onChange={e => setClueText(e.target.value)} />
                <Btn variant="success" disabled={!clueText.trim()} onClick={submitClue} style={{ marginTop: 8 }}>
                  Enviar palabra
                </Btn>
              </>
            ) : (
              <>
                <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>Es tu turno — decí tu palabra en voz alta y confirmá.</p>
                <Btn variant="success" onClick={submitClue}>
                  Ya dije mi palabra
                </Btn>
              </>
            )
          ) : isMyTurn && clueSubmitted ? (
            <p style={{ color: "#5DCAA5", fontSize: 14, textAlign: "center" }}>Palabra enviada — pasando el turno...</p>
          ) : (
            <p style={{ ...S.muted, textAlign: "center" }}>
              {currentTurnPlayer ? `Esperando a ${currentTurnPlayer.name}...` : "Esperando..."}
            </p>
          )}
        </div>

        <CluesReview clues={round?.clues} players={room.players} />
      </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "discussion") {
    const myReadyState = myPlayer?.ready;
    return (
      <PhaseTransition phaseKey="discussion">
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: "#9089c0" }}>Momento de pensar</p>
          <p style={{ fontSize: 12, color: "#7F77DD" }}>Analicen las palabras antes de votar</p>
        </div>

        {round?.discussionEnd ? (
          <Timer timerEnd={round.discussionEnd} total={config.discussionTime} label="Tiempo de discusión" />
        ) : (
          <p style={{ ...S.muted, textAlign: "center" }}>Sin límite de tiempo — avancen cuando estén listos</p>
        )}

        <CluesReview clues={round?.clues} players={room.players} />

        <PlayerReadyPills players={room.players} />

        {!myReadyState && (
          <Btn variant="success" onClick={() => send({ type: "player_ready" })} style={{ marginTop: 8 }}>
            Listo para votar
          </Btn>
        )}
        {myReadyState && (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#5DCAA5" }}>Listo — esperando a los demás para pasar a la votación</p>
          </div>
        )}
      </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "voting") {
    // Only online players are ever required to vote (see engine.ts's
    // maybeAdvance) — counting offline ones in the denominator would make
    // the tally look permanently stuck a vote short.
    const onlinePlayers = room.players.filter(p => p.online);
    const totalVoted = onlinePlayers.filter(p => p.hasVoted).length;
    const revoteCandidates: string[] | null | undefined = round?.revoteCandidates;
    const isRevote = !!revoteCandidates;
    // Players eliminated earlier in this same match are spectating, not
    // votable — the backend rejects a vote for one of them outright (see
    // engine.ts's `vote` handler checking `alive.includes(suspectId)`), so
    // offering them here would just silently eat the tap with no feedback,
    // and if everyone hits this the round can never reach the vote quorum.
    const matchEliminated: string[] = round?.matchEliminated ?? [];
    const suspects = room.players.filter(
      p => p.id !== me?.playerId && !matchEliminated.includes(p.id) && (!revoteCandidates || revoteCandidates.includes(p.id)),
    );
    // Still-alive players who happen to be offline right now aren't counted
    // in the vote quorum (see the comment above), but that also means the
    // vote is effectively paused waiting for them to come back — worth
    // saying so explicitly instead of just showing a tally that looks
    // "complete" while actually waiting on someone.
    const offlineAlive = room.players.filter(p => !matchEliminated.includes(p.id) && !p.online);

    const confirmVote = () => {
      if (!selectedSuspect) return;
      send({ type: "vote", suspectId: selectedSuspect });
      setVoteConfirmed(true);
    };

    return (
      <PhaseTransition phaseKey={`voting-${round?.revoteCount ?? 0}`}>
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: "#9089c0" }}>¿Quién es el impostor?</p>
          <p style={{ fontSize: 12, color: "#7F77DD" }}>
            {totalVoted}/{onlinePlayers.length} confirmaron su voto
          </p>
        </div>

        {isRevote && (
          <div style={{ ...S.card, textAlign: "center", border: "1px solid rgba(226,196,74,0.35)", background: "rgba(226,196,74,0.08)" }}>
            <p style={{ fontSize: 14, color: "#E2C44A", fontWeight: 700, margin: 0 }}>Hubo un empate</p>
            <p style={{ fontSize: 13, color: "#b8b0d4", marginTop: 4 }}>Se vota de nuevo solo entre los más votados</p>
          </div>
        )}

        {offlineAlive.length > 0 && (
          <div style={{ ...S.card, textAlign: "center", border: "1px solid rgba(226,196,74,0.35)", background: "rgba(226,196,74,0.08)" }}>
            <p style={{ fontSize: 13, color: "#E2C44A", fontWeight: 700, margin: 0 }}>
              Esperando a que se reconecte{offlineAlive.length === 1 ? "" : "n"}: {offlineAlive.map(p => p.name).join(", ")}
            </p>
            <p style={{ fontSize: 12, color: "#b8b0d4", marginTop: 4 }}>La votación sigue pausada hasta que vuelvan.</p>
          </div>
        )}

        <CluesReview clues={round?.clues} players={room.players} />

        {!voteConfirmed ? (
          <>
            <p style={{ fontSize: 14, color: "#9089c0", marginBottom: 12, textAlign: "center" }}>Elegí a quién sospechás y confirmá</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {suspects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedSuspect(p.id)}
                  style={{
                    ...S.btn(selectedSuspect === p.id ? "danger" : "ghost"),
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    textAlign: "left",
                    borderRadius: 12,
                  }}
                >
                  <Avatar name={p.name} size={36} />
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>
                    {p.name}
                    {!p.online && <span style={{ fontWeight: 600, fontSize: 12, color: "#9089c0" }}> · desconectado</span>}
                  </span>
                </button>
              ))}
            </div>
            <Btn variant="success" disabled={!selectedSuspect} onClick={confirmVote}>
              Confirmar voto
            </Btn>
          </>
        ) : (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ fontSize: 15, color: "#9089c0" }}>Voto confirmado. Esperando a los demás</p>
            <p style={{ fontSize: 13, color: "#5a5280", marginTop: 6 }}>
              {totalVoted}/{onlinePlayers.length} confirmaron su voto
            </p>
          </div>
        )}
      </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "result") {
    const lastH = room.roundHistory?.[room.roundHistory.length - 1] as ImpostorHistoryEntry | undefined;
    const word = wordReveal?.word || lastH?.word;
    const eliminated = room.players.find(p => p.id === (round?.eliminated ?? lastH?.eliminated));
    const wasImpostor: boolean | undefined = round?.wasImpostor ?? lastH?.wasImpostor;
    const matchOver: boolean = round?.matchOver ?? lastH?.matchOver ?? false;
    const winner: "innocents" | "impostors" | null = round?.winner ?? lastH?.winner ?? null;
    const abortedReason: string | undefined = round?.abortedReason ?? lastH?.abortedReason;
    const votesDiscarded: boolean | undefined = round?.votesDiscarded ?? lastH?.votesDiscarded;
    const tieBrokenRandomly: boolean | undefined = round?.tieBrokenRandomly ?? lastH?.tieBrokenRandomly;
    const matchEliminatedIds: string[] = round?.matchEliminated || [];
    const impostors = matchOver ? room.players.filter(p => (round?.impostors || lastH?.impostors || []).includes(p.id)) : [];
    // Who was actually eligible to vote/be voted this round — a stand-in for
    // "everyone still alive at the time", to keep the vote breakdown from
    // dragging in players eliminated in earlier rounds.
    const turnOrder: string[] | undefined = round?.turnOrder;
    const roundParticipants = turnOrder ? room.players.filter(p => turnOrder.includes(p.id)) : room.players;
    const votes: Record<string, string> = round?.votes || {};

    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando resultado..." />;

    const winnerColor = abortedReason ? "#E2C44A" : winner === "innocents" ? "#5DCAA5" : "#F09595";

    return (
      <PhaseTransition phaseKey="result">
      <div>
        {matchOver && (
          <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: winnerColor, marginTop: 8 }}>
              {abortedReason === "impostor_disconnected"
                ? "🔌 El impostor se desconectó"
                : winner === "innocents"
                  ? "Ganaron los inocentes"
                  : "Ganaron los impostores"}
            </p>
            {abortedReason === "impostor_disconnected" && (
              <p style={{ fontSize: 13, color: "#9089c0", marginTop: 4 }}>
                La partida se cerró sin definir un ganador porque el impostor abandonó.
                {votesDiscarded && " Los votos que ya se habían emitido en esta ronda no se cuentan."}
              </p>
            )}
          </div>
        )}

        {!abortedReason && tieBrokenRandomly && (
          <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", margin: "0 0 8px" }}>
            🎲 Empate persistente — se sorteó entre los más votados
          </p>
        )}

        {eliminated && <EliminatedPlayerCard name={eliminated.name} wasImpostor={wasImpostor} />}

        {matchOver && word && (
          <div style={{ ...S.cardHighlight, textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#9089c0" }}>La palabra era</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#AFA9EC", margin: "4px 0" }}>{String(word)}</p>
          </div>
        )}

        {matchOver && impostors.length > 0 && (
          <div style={S.card}>
            <span style={S.label}>{impostors.length === 1 ? "El impostor era" : "Los impostores eran"}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "8px 0 0" }}>
              {impostors.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={p.name} size={28} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    {p.name}
                    {!p.online && <span style={{ fontWeight: 600, fontSize: 12, color: "#9089c0" }}> · desconectado</span>}
                  </span>
                </div>
              ))}
            </div>
            {impostors.length > 1 && (
              <>
                <p style={{ ...S.muted, margin: "14px 0 6px" }}>Atrapados durante la partida</p>
                {impostors.filter(p => matchEliminatedIds.includes(p.id)).length > 0 ? (
                  impostors
                    .filter(p => matchEliminatedIds.includes(p.id))
                    .map(p => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <Avatar name={p.name} size={24} />
                        <span style={{ fontSize: 13 }}>{p.name}</span>
                      </div>
                    ))
                ) : (
                  <p style={{ ...S.muted, margin: 0 }}>Ninguno.</p>
                )}
              </>
            )}
          </div>
        )}

        <div style={S.card}>
          <span style={S.label}>Votos</span>
          {roundParticipants.map(p => {
            const count = Object.values(votes).filter(v => v === p.id).length;
            const total = Math.max(1, roundParticipants.length - 1);
            return (
              <div key={p.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  <span style={S.muted}>{count} votos</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 3,
                      width: `${Math.round((count / total) * 100)}%`,
                      background: p.id === (round?.eliminated ?? lastH?.eliminated) ? "#E24B4A" : "#534AB7",
                      transition: "width 0.6s",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {isHost && matchOver && <StartButton onClick={() => send({ type: "start_round" })}>Nueva partida</StartButton>}
        {isHost && !matchOver && (
          <StartButton onClick={() => send({ type: "continue_round" })}>Siguiente ronda</StartButton>
        )}
        {/* Group instances use the shell's persistent "Volver al grupo" link instead.
            Available to any player, not just the host — it only interrupts the
            current match for everyone, same as leaving an instance. */}
        <LeaveToLobbyButton groupCode={room.groupCode} send={send} />
        {!isHost && (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#9089c0", fontSize: 14 }}>
              {matchOver ? "Esperando que el anfitrión inicie otra partida" : "Esperando que el anfitrión continúe la ronda"}
            </p>
          </div>
        )}
      </div>
      </PhaseTransition>
    );
  }

  return null;
}
