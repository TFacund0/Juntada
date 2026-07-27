import { useState, useEffect, useMemo, useRef } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { LeaveToLobbyButton } from "../../components/LeaveToLobbyButton";
import { Avatar } from "../../components/Avatar";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PhaseTransition } from "../../components/PhaseTransition";
import { shuffle } from "@juntada/core-utils";
import { startsWithLetter } from "@juntada/tutifruti-words";
import type { RoundViewProps } from "../gameTypes";
import type { RoomPublicState } from "@juntada/shared-types";

interface TutifrutiCategory {
  id: string;
  label: string;
  icon?: string;
}

interface TutifrutiAnswerBreakdown {
  word: string;
  valid: boolean;
  wrongLetter: boolean;
  duplicate: boolean;
  points: number;
  ticks: number;
  crosses: number;
}

// Mirrors backend/src/games/tutifruti/engine.ts's getPublicRoundView — fields
// accumulate as the round moves through phases (setup adds the base fields,
// writing adds doneCount/bastaBy, review/result add answers/marks/etc.), so
// most of the phase-specific fields stay optional here.
interface TutifrutiRoundState {
  letter: string;
  rerollsUsed: number;
  categories: TutifrutiCategory[];
  endMode: "timer" | "basta";
  timerEnd: number | null;
  isFinalRound: boolean;
  roundNumber: number;
  totalRounds: number;
  doneCount?: number;
  bastaBy?: string | null;
  answers?: Record<string, Record<string, string>>;
  marks?: Record<string, Record<string, Record<string, boolean>>>;
  reviewConfirmed?: Record<string, boolean>;
  reviewEnd?: number | null;
  pointsByPlayer?: Record<string, number> | null;
  breakdown?: Record<string, Record<string, TutifrutiAnswerBreakdown>> | null;
}

// ── Ronda X/Y indicator, shown at the top of every phase ──
function RoundBadge({ round }: { round: TutifrutiRoundState }) {
  if (!round.totalRounds) return null;
  return (
    <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>
      Ronda {round.roundNumber}/{round.totalRounds}
    </p>
  );
}

function useCountdown(timerEnd: number | null): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!timerEnd) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [timerEnd]);
  if (!timerEnd) return null;
  return Math.max(0, Math.ceil((timerEnd - now) / 1000));
}

// ── SETUP: letter draw, host can reroll ──
function SetupPhase({ room, isHost, send }: Pick<RoundViewProps, "room" | "isHost" | "send">) {
  const round = room.round as TutifrutiRoundState;
  return (
    <div>
      <RoundBadge round={round} />
      <div style={{ ...S.cardHighlight, textAlign: "center", padding: "36px 20px" }}>
        <p style={{ fontSize: 13, color: "#9089c0", marginBottom: 8 }}>La letra es...</p>
        <p style={{ fontSize: 64, fontWeight: 800, color: "#AFA9EC", margin: 0, lineHeight: 1 }}>{round.letter}</p>
        {round.rerollsUsed > 0 && (
          <p style={{ ...S.muted, marginTop: 10 }}>
            Letra cambiada {round.rerollsUsed} {round.rerollsUsed === 1 ? "vez" : "veces"}
          </p>
        )}
      </div>
      {isHost ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn onClick={() => send({ type: "confirm_letter" })}>Confirmar y empezar</Btn>
          <Btn variant="ghost" onClick={() => send({ type: "confirm_letter", reroll: true })}>
            🔀 Cambiar letra
          </Btn>
        </div>
      ) : (
        <p style={{ ...S.muted, textAlign: "center" }}>Esperando que el anfitrión confirme la letra...</p>
      )}
    </div>
  );
}

// ── WRITING: fill in categories against the clock or until "basta" ──
interface TutifrutiPrivateRole {
  myAnswers: Record<string, string>;
}

function WritingPhase({ room, myPlayer, myRole, send }: Pick<RoundViewProps, "room" | "me" | "myPlayer" | "myRole" | "isHost" | "send">) {
  const round = room.round as TutifrutiRoundState;
  const role = myRole as TutifrutiPrivateRole | null;
  const timeLeft = useCountdown(round.endMode === "timer" ? round.timerEnd : null);
  // Only "Ya terminé" (timer mode) locks answers — basta mode has no
  // individual confirm step, everyone keeps typing until someone calls
  // "¡BASTA!" for the whole table.
  const locked = !!myPlayer?.ready;
  const [values, setValues] = useState<Record<string, string>>(() => role?.myAnswers || {});
  // Keyed per category — a single shared timer/pending-value would let
  // typing in category B cancel category A's still-pending debounce (via
  // the old clearTimeout) without ever resending it, silently dropping A's
  // answer the moment you moved on to fill in something else, well before
  // ever touching "Ya terminé".
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Tracks whatever hasn't been sent yet per category, so "Ya terminé" can
  // flush it immediately instead of leaving the last word(s) typed
  // unsubmitted — the backend rejects any submit_answers once ready is set
  // (see engine.ts), so without this the last category typed right before
  // confirming would silently score 0 with no feedback that it never saved.
  const pendingRef = useRef<Record<string, string>>({});
  const letterRef = useRef(round.letter);
  const onlinePlayers = room.players.filter(p => p.online);
  const readyCount = onlinePlayers.filter(p => p.ready).length;
  const [confirmBasta, setConfirmBasta] = useState(false);

  useEffect(() => {
    if (letterRef.current !== round.letter) {
      letterRef.current = round.letter;
      setValues(role?.myAnswers || {});
      // A new round means whatever was still pending from the previous
      // letter is moot — its categories don't even exist anymore.
      Object.values(debounceRefs.current).forEach(clearTimeout);
      debounceRefs.current = {};
      pendingRef.current = {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.letter]);

  const onChange = (catId: string, word: string) => {
    const next = { ...values, [catId]: word };
    setValues(next);
    pendingRef.current[catId] = word;
    if (debounceRefs.current[catId]) clearTimeout(debounceRefs.current[catId]);
    debounceRefs.current[catId] = setTimeout(() => {
      send({ type: "submit_answers", answers: { [catId]: word } });
      delete pendingRef.current[catId];
      delete debounceRefs.current[catId];
    }, 400);
  };

  // Skips the debounce and sends whatever's still pending right now (every
  // category with an in-flight edit, not just the last one touched),
  // instead of letting "Ya terminé" race it (see player_ready's onClick).
  const flushPending = () => {
    Object.values(debounceRefs.current).forEach(clearTimeout);
    debounceRefs.current = {};
    if (Object.keys(pendingRef.current).length > 0) {
      send({ type: "submit_answers", answers: { ...pendingRef.current } });
      pendingRef.current = {};
    }
  };

  useEffect(() => () => flushPending(), []);

  return (
    <div>
      <RoundBadge round={round} />
      <div style={{ ...S.cardHighlight, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#9089c0", marginBottom: 4 }}>Letra</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: "#AFA9EC", margin: 0 }}>{round.letter}</p>
      </div>
      {round.endMode === "timer" && timeLeft != null && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#9089c0" }}>Tiempo restante</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: timeLeft < 15 ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5" }}>
              {timeLeft}s
            </span>
          </div>
        </div>
      )}
      <div style={S.card}>
        <span style={S.label}>Completá con la letra "{round.letter}"</span>
        {round.categories.map(cat => (
          <div key={cat.id} style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "#9089c0", marginBottom: 4, display: "block" }}>
              {cat.icon ? `${cat.icon} ` : ""}
              {cat.label}
            </span>
            <input
              style={{ ...S.input, opacity: locked ? 0.5 : 1 }}
              value={values[cat.id] || ""}
              onChange={e => onChange(cat.id, e.target.value)}
              placeholder={`${round.letter}...`}
              disabled={locked}
            />
          </div>
        ))}
      </div>
      {round.endMode === "basta" && (
        <Btn variant="danger" onClick={() => setConfirmBasta(true)}>
          ¡BASTA!
        </Btn>
      )}
      {confirmBasta && (
        <ConfirmDialog
          title="¿Gritar BASTA?"
          message={`Corta la ronda para todos ahora mismo — ${round.doneCount ?? 0} de ${room.players.length} ya enviaron alguna respuesta. Nadie más va a poder seguir escribiendo.`}
          confirmLabel="¡BASTA!"
          onConfirm={() => {
            setConfirmBasta(false);
            flushPending();
            send({ type: "call_basta" });
          }}
          onCancel={() => setConfirmBasta(false)}
        />
      )}
      {round.endMode === "timer" &&
        (myPlayer?.ready ? (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#5DCAA5", margin: 0 }}>Marcaste que ya terminaste — esperando a los demás</p>
          </div>
        ) : (
          <Btn
            variant="success"
            onClick={() => {
              flushPending();
              send({ type: "player_ready" });
            }}
          >
            Ya terminé
          </Btn>
        ))}
      {/* Timer mode already reports progress via readyCount right below "Ya
          terminé" — showing doneCount too said almost the same thing twice
          ("enviaron alguna respuesta" vs "ya terminaron"). Basta mode has no
          ready concept, so doneCount is its only progress indicator. */}
      {round.endMode === "timer" ? (
        <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>
          {readyCount} de {onlinePlayers.length} jugadores ya terminaron
        </p>
      ) : (
        <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>
          {round.doneCount} de {room.players.length} jugadores enviaron alguna respuesta
        </p>
      )}
    </div>
  );
}

// ── REVIEW: mark everyone's answers valid/invalid, grouped by category and
// without showing who wrote each word — just the word and the votes on it.
// Everyone (including the word's own author) can vote on any word, and every
// player has to confirm before the round's scores get tallied.
function ReviewPhase({ room, me, send }: Pick<RoundViewProps, "room" | "me" | "send">) {
  const round = room.round as TutifrutiRoundState;
  const answers = round.answers!;
  const marks = round.marks!;
  const online = room.players.filter(p => p.online);
  const confirmedCount = online.filter(p => round.reviewConfirmed?.[p.id]).length;
  const iConfirmed = !!me && !!round.reviewConfirmed?.[me.playerId];
  const timeLeft = useCountdown(round.reviewEnd ?? null);

  // Always listing answers in room.players order would let anyone learn,
  // round after round, "position 2 is always Fulano" — recomputed only when
  // a new round actually starts (roundNumber changes), not on every
  // re-render from an incoming vote, so it stays stable for the whole review.
  const shuffledPlayerIds = useMemo(() => shuffle(room.players.map(p => p.id)), [round.roundNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // A word nobody votes on defaults to valid (see engine.ts's finishRound) —
  // a group that reviews quickly without touching every row would otherwise
  // never realize some clearly-wrong answers are about to auto-score,
  // unaware anything was skipped.
  let unvotedCount = 0;
  round.categories.forEach(cat => {
    room.players.forEach(p => {
      const word = (answers[p.id] || {})[cat.id];
      if (!word || !word.trim()) return;
      const marksForWord = (marks[p.id] || {})[cat.id] || {};
      if (Object.keys(marksForWord).length === 0) unvotedCount++;
    });
  });

  return (
    <div>
      <RoundBadge round={round} />
      <div style={{ ...S.cardHighlight, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#9089c0", marginBottom: 4 }}>Letra</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: "#AFA9EC", margin: 0 }}>{round.letter}</p>
      </div>
      {timeLeft != null && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#9089c0" }}>Tiempo para revisar</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: timeLeft < 15 ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5" }}>
              {timeLeft}s
            </span>
          </div>
        </div>
      )}
      {round.categories.map(cat => {
        const entries = shuffledPlayerIds
          .map(playerId => ({ playerId, word: (answers[playerId] || {})[cat.id] }))
          // A whitespace-only "answer" (e.g. a stray space bar tap) is
          // truthy as a string but scores as blank once trimmed at result
          // time — filtering it out here too avoids showing reviewers a
          // vote-able row for something that was never really an answer.
          .filter(e => e.word && e.word.trim());
        if (entries.length === 0) return null;
        return (
          <div key={cat.id} style={S.card}>
            <span style={S.label}>
              {cat.icon ? `${cat.icon} ` : ""}
              {cat.label}
            </span>
            {entries.map(({ playerId, word }) => {
              const marksForWord = (marks[playerId] || {})[cat.id] || {};
              const voteValues = Object.values(marksForWord);
              const ticks = voteValues.filter(v => v === true).length;
              const crosses = voteValues.filter(v => v === false).length;
              const wrongLetter = !startsWithLetter(word, round.letter);
              // Half or more of the votes marking it invalid rejects the word live,
              // same rule the backend applies once the round is tallied.
              const rejectedByVotes = ticks + crosses > 0 && crosses >= ticks;
              const struckOut = wrongLetter || rejectedByVotes;
              return (
                <div
                  key={playerId}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid rgba(127,119,221,0.08)",
                  }}
                >
                  {/* The word always takes the full row on its own — on a
                      narrow phone, a long word plus a tally column plus two
                      36px buttons all fighting for one row left almost no
                      breathing room, so the tally+buttons group wraps to its
                      own line below instead. */}
                  <div style={{ flex: "1 1 100%", minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                        color: struckOut ? "#F09595" : undefined,
                        textDecoration: struckOut ? "line-through" : undefined,
                      }}
                    >
                      {word}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flex: "1 1 auto" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "flex-end" }}>
                      {Object.values(marksForWord).map((valid, i) => (
                        <span key={i} style={{ fontSize: 11, color: valid ? "#5DCAA5" : "#F09595" }}>
                          {valid ? "✓" : "✗"}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => send({ type: "mark_word", targetPlayerId: playerId, categoryId: cat.id, valid: true })}
                        disabled={iConfirmed}
                        style={{
                          ...S.btn(me && marksForWord[me.playerId] === true ? "success" : "ghost", iConfirmed),
                          width: 36,
                          height: 36,
                          padding: 0,
                          borderRadius: 8,
                          fontSize: 16,
                        }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => send({ type: "mark_word", targetPlayerId: playerId, categoryId: cat.id, valid: false })}
                        disabled={iConfirmed}
                        style={{
                          ...S.btn(me && marksForWord[me.playerId] === false ? "danger" : "ghost", iConfirmed),
                          width: 36,
                          height: 36,
                          padding: 0,
                          borderRadius: 8,
                          fontSize: 16,
                        }}
                      >
                        ✗
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {!iConfirmed && unvotedCount > 0 && (
        <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginBottom: 8 }}>
          {unvotedCount} respuesta{unvotedCount === 1 ? "" : "s"} sin ningún voto todavía — sin votos cuentan como válidas.
        </p>
      )}
      {iConfirmed ? (
        <div style={{ ...S.card, textAlign: "center" }}>
          <p style={{ color: "#5DCAA5", margin: 0 }}>
            Confirmaste los puntajes — esperando a los demás ({confirmedCount}/{online.length})
          </p>
        </div>
      ) : (
        <Btn variant="success" onClick={() => send({ type: "confirm_review" })}>
          Confirmar puntajes ({confirmedCount}/{online.length})
        </Btn>
      )}
    </div>
  );
}

// ── RESULT: round breakdown + running standings ──
function RoundResult({
  room,
  round,
  isHost,
  onShowFinal,
  send,
}: {
  room: RoomPublicState;
  round: TutifrutiRoundState;
  isHost: boolean;
  onShowFinal: () => void;
  send: RoundViewProps["send"];
}) {
  const score = room.config.score as Record<string, number>;
  const pointsByPlayer = round.pointsByPlayer!;
  const breakdown = round.breakdown!;
  const standings = [...room.players]
    .map(p => ({ ...p, score: score[p.id] || 0, roundPts: pointsByPlayer[p.id] || 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <div>
      <RoundBadge round={round} />
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <p style={{ ...S.title, fontSize: 26, display: "block" }}>Puntos de la ronda</p>
      </div>
      <div style={S.card}>
        <span style={S.label}>Clasificación</span>
        {standings.map((p, i) => (
          <div
            key={p.id}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(127,119,221,0.08)" }}
          >
            <span style={{ fontWeight: 800, color: i === 0 ? "#E2C44A" : "#6b6490", width: 20 }}>{i + 1}</span>
            <Avatar name={p.name} size={30} />
            <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
            <span style={{ fontSize: 12, color: "#5DCAA5", marginRight: 8 }}>+{p.roundPts}</span>
            <span style={{ fontWeight: 800, color: "#5DCAA5" }}>{p.score} pts</span>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <span style={S.label}>Desglose ({round.letter})</span>
        {round.categories.map(cat => {
          const entries = room.players
            .map(p => (breakdown[p.id] || {})[cat.id])
            .filter((b): b is TutifrutiAnswerBreakdown => !!b && !!b.word);
          if (entries.length === 0) return null;
          return (
            <div key={cat.id} style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "#7F77DD", fontWeight: 700 }}>
                {cat.icon ? `${cat.icon} ` : ""}
                {cat.label}
              </span>
              {entries.map((b, i) => (
                <div
                  key={i}
                  style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "4px 0", color: "#b8b0d4" }}
                >
                  <span
                    style={{
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                      minWidth: 0,
                      color: !b.valid ? "#F09595" : undefined,
                      textDecoration: !b.valid ? "line-through" : undefined,
                    }}
                  >
                    {b.word}
                  </span>
                  <span style={{ flexShrink: 0, color: !b.valid ? "#F09595" : b.duplicate ? "#EF9F27" : "#5DCAA5" }}>
                    {b.wrongLetter
                      ? `No empieza con "${round.letter}"`
                      : !b.valid
                        ? "Inválida"
                        : b.duplicate
                          ? `Repetida (+${b.points})`
                          : `+${b.points}`}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {isHost &&
        (round.isFinalRound ? (
          <StartButton onClick={onShowFinal}>Ver resultados finales</StartButton>
        ) : (
          <StartButton onClick={() => send({ type: "start_round" })}>Nueva ronda</StartButton>
        ))}
      {round.isFinalRound && !isHost && (
        <p style={{ ...S.muted, textAlign: "center" }}>Se jugaron todas las rondas configuradas — esperando al anfitrión.</p>
      )}
      {/* Group instances use the shell's persistent "Volver al grupo" link instead.
          Available to any player, not just the host. */}
      <LeaveToLobbyButton
        groupCode={room.groupCode}
        send={send}
        confirm={{
          message: "Se interrumpe la partida para todos y se pierde la tabla de puntuación.",
        }}
      />
    </div>
  );
}

// ── Brief pause shown between the last round's own result and the final
// standings reveal, so "Fin del juego" doesn't feel like an abrupt jump cut.
function FinalResultsLoading() {
  return (
    <div style={{ ...S.cardHighlight, textAlign: "center", padding: "48px 20px" }}>
      <p style={{ fontSize: 15, color: "#9089c0", margin: 0 }}>Cargando resultados finales...</p>
    </div>
  );
}

function FinalStandings({
  room,
  isHost,
  send,
}: {
  room: RoomPublicState;
  round: TutifrutiRoundState;
  isHost: boolean;
  send: RoundViewProps["send"];
}) {
  const score = room.config.score as Record<string, number>;
  const standings = [...room.players].map(p => ({ ...p, score: score[p.id] || 0 })).sort((a, b) => b.score - a.score);

  return (
    <div>
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <p style={{ ...S.title, fontSize: 26, display: "block" }}>Fin del juego</p>
      </div>
      <div style={S.card}>
        <span style={S.label}>Clasificación final</span>
        {standings.map((p, i) => (
          <div
            key={p.id}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(127,119,221,0.08)" }}
          >
            <span style={{ fontWeight: 800, color: i === 0 ? "#E2C44A" : "#6b6490", width: 20 }}>{i + 1}</span>
            <Avatar name={p.name} size={30} />
            <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
            <span style={{ fontWeight: 800, color: "#5DCAA5" }}>{p.score} pts</span>
          </div>
        ))}
      </div>
      {isHost && <StartButton onClick={() => send({ type: "new_game" })}>Nueva partida</StartButton>}
      {!isHost && <p style={{ ...S.muted, textAlign: "center" }}>Esperando a que el anfitrión arranque una partida nueva.</p>}
      {/* Group instances use the shell's persistent "Volver al grupo" link instead.
          Available to any player, not just the host. */}
      <LeaveToLobbyButton
        groupCode={room.groupCode}
        send={send}
        confirm={{
          message: "Se interrumpe la partida para todos y se pierde la tabla de puntuación.",
        }}
      />
    </div>
  );
}

function ResultPhase({ room, isHost, send }: Pick<RoundViewProps, "room" | "isHost" | "send">) {
  const round = room.round as TutifrutiRoundState;
  const [finalStage, setFinalStage] = useState<"round" | "loading" | "final">("round");

  useEffect(() => {
    if (finalStage !== "loading") return;
    const id = setTimeout(() => setFinalStage("final"), 1100);
    return () => clearTimeout(id);
  }, [finalStage]);

  if (round.isFinalRound && finalStage === "loading") {
    return (
      <PhaseTransition phaseKey="loading">
        <FinalResultsLoading />
      </PhaseTransition>
    );
  }
  if (round.isFinalRound && finalStage === "final") {
    return (
      <PhaseTransition phaseKey="final">
        <FinalStandings room={room} round={round} isHost={isHost} send={send} />
      </PhaseTransition>
    );
  }
  return (
    <PhaseTransition phaseKey={`round-${round.roundNumber}`}>
      <RoundResult room={room} round={round} isHost={isHost} onShowFinal={() => setFinalStage("loading")} send={send} />
    </PhaseTransition>
  );
}

export function RoundView({ room, me, myPlayer, myRole, isHost, send }: RoundViewProps) {
  if (!room.round) return null;
  if (room.phase === "setup") {
    return (
      <PhaseTransition phaseKey="setup">
        <SetupPhase room={room} isHost={isHost} send={send} />
      </PhaseTransition>
    );
  }
  if (room.phase === "writing") {
    return (
      <PhaseTransition phaseKey="writing">
        <WritingPhase room={room} me={me} myPlayer={myPlayer} myRole={myRole} isHost={isHost} send={send} />
      </PhaseTransition>
    );
  }
  if (room.phase === "review") {
    return (
      <PhaseTransition phaseKey="review">
        <ReviewPhase room={room} me={me} send={send} />
      </PhaseTransition>
    );
  }
  if (room.phase === "result") return <ResultPhase room={room} isHost={isHost} send={send} />;
  return null;
}
