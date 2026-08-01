import { useEffect, useRef, useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/ui/Btn";
import { StartButton } from "../../components/setup/StartButton";
import { Collapsible } from "../../components/game-kit/Collapsible";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import { LeaveToLobbyButton } from "../../components/game-kit/LeaveToLobbyButton";
import { PhaseTransition } from "../../components/game-kit/PhaseTransition";
import { TurnCircle } from "../../components/game-kit/TurnCircle";
import { Standings, buildStandingEntries } from "./components/Standings";
import { OthersWordsList } from "./components/OthersWordsList";
import {
  MAX_WRONG_GUESSES,
  type QAEntry,
  type QuienSoyPrivateRole,
  type QuienSoyReveal,
  type QuienSoyRoundView,
} from "@juntada/quien-soy-data";
import type { RoundViewProps } from "../gameTypes";

const MAX_RESOLVED_QA_CARDS = 3;

function nameOf(room: RoundViewProps["room"], id: string | null | undefined): string {
  return room.players.find(p => p.id === id)?.name ?? "…";
}

function QAResponses({ room, qa }: { room: RoundViewProps["room"]; qa: QAEntry }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {Object.entries(qa.responses).map(([playerId, resp]) =>
        resp.answer === "skip" ? (
          <p key={playerId} style={{ margin: 0, color: "#9089c0" }}>
            {nameOf(room, playerId)} prefirió no responder{resp.comment ? ` — "${resp.comment}"` : ""}
          </p>
        ) : (
          <p key={playerId} style={{ margin: 0, color: resp.answer === "si" ? "#5DCAA5" : "#F09595" }}>
            {nameOf(room, playerId)} respondió: {resp.answer === "si" ? "Sí" : "No"}
            {resp.comment ? ` — "${resp.comment}"` : ""}
          </p>
        ),
      )}
    </div>
  );
}

// A brief, centered, self-dismissing flash for the guesser's own attempt at
// *their own* word — separate from Toast (which drops in from the top for
// connection/room-wide notices) since this needs to grab attention right in
// the middle of the screen for the guesser specifically, the same beat
// rayado-libre's own points toast gives a correct guess. Same shape/timing
// for a hit as for a miss — only the icon/color/copy change — so neither
// outcome reads as an afterthought next to the other.
function GuessFlash({ correct }: { correct: boolean }) {
  const color = correct ? "#5DCAA5" : "#F09595";
  return (
    <>
      <style>{`
        @keyframes guess-flash-pop {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          15% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
          25% { transform: translate(-50%, -50%) scale(1); }
          80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          zIndex: 2000,
          pointerEvents: "none",
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 50%, transparent)`,
          borderRadius: 16,
          padding: "22px 32px",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "guess-flash-pop 1.4s ease-out forwards",
        }}
      >
        <p style={{ fontSize: 32, margin: 0 }}>{correct ? "🎉" : "❌"}</p>
        <p style={{ fontSize: 18, fontWeight: 800, color, margin: "6px 0 0" }}>{correct ? "¡Acertaste!" : "Intento fallido"}</p>
      </div>
    </>
  );
}

// Covers every in-progress phase (suggest/vote/playing/result) inside a
// multiplayer room. Props per the registry contract in games/gameTypes.ts.
export function RoundView({ room, me, myRole, wordReveal, isHost, send }: RoundViewProps) {
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string>>({});
  const [actionMode, setActionMode] = useState<"idle" | "asking" | "guessing">("idle");
  const [questionText, setQuestionText] = useState("");
  const [guessText, setGuessText] = useState("");
  const [answerComment, setAnswerComment] = useState("");
  const [confirmingConcede, setConfirmingConcede] = useState(false);
  const [notes, setNotes] = useState("");
  const [openQuestions, setOpenQuestions] = useState<Set<number>>(new Set());
  const [resolvedQACards, setResolvedQACards] = useState<{ id: number; qa: QAEntry }[]>([]);
  const lastQaLogLength = useRef<number | null>(null);
  // null = hidden; true/false = showing the hit/miss flash for that outcome
  // (see GuessFlash above) — one flag for both since they're the same shape,
  // just a different color/icon/copy.
  const [guessFlash, setGuessFlash] = useState<boolean | null>(null);
  const lastMyWrongGuesses = useRef<number | null>(null);
  const [lastGuessAttempt, setLastGuessAttempt] = useState<{ playerId: string; text: string; correct: boolean } | null>(null);
  const lastGuessLogLength = useRef<number | null>(null);

  const round = room.round as QuienSoyRoundView | null;
  const role = myRole as QuienSoyPrivateRole | null;
  const reveal = wordReveal as QuienSoyReveal | null;
  const myId = me?.playerId;

  // A miss bumps myWrongGuesses (private, resent on every guess now that
  // submitGuess always marks itself rerolled — see engine.ts) — diff it the
  // same way rayado-libre diffs guessId, so this only fires once per actual
  // wrong guess instead of replaying on every unrelated private_role refresh.
  useEffect(() => {
    const count = role?.myWrongGuesses ?? 0;
    if (lastMyWrongGuesses.current != null && count > lastMyWrongGuesses.current) {
      setGuessFlash(false);
      const t = setTimeout(() => setGuessFlash(null), 1400);
      lastMyWrongGuesses.current = count;
      return () => clearTimeout(t);
    }
    lastMyWrongGuesses.current = count;
  }, [role?.myWrongGuesses]);

  // Surfaces every question's full set of answers to everyone (not just the
  // asker's own "Mis preguntas" collapsible) right as it resolves — qaLog is
  // public round data, so every client sees the same new entry land at the
  // same time. Cards stack (newest on top) instead of auto-dismissing, so
  // each player closes them with the × whenever they're done reading; only
  // the oldest gets dropped once a new one pushes the stack past the limit.
  useEffect(() => {
    const log = round?.qaLog ?? [];
    if (lastQaLogLength.current != null && log.length > lastQaLogLength.current) {
      const latest = log[log.length - 1];
      setResolvedQACards(prev => [{ id: log.length - 1, qa: latest }, ...prev].slice(0, MAX_RESOLVED_QA_CARDS));
      lastQaLogLength.current = log.length;
      return;
    }
    lastQaLogLength.current = log.length;
  }, [round?.qaLog]);

  // Same idea for guesses — guessLog is public too, so everyone (not just
  // the guesser) sees what was attempted and whether it landed, right as it
  // happens, instead of only the guesser's own private outcome. A correct
  // guess of *my own* word additionally gets the same GuessFlash treatment
  // as a miss (see that component's comment) — the miss case learns of its
  // own outcome via the private myWrongGuesses counter above since a public
  // guessLog entry alone can't distinguish "the guesser" from "everyone
  // else", but a hit needs no such privacy: it's already this guessLog
  // entry's own playerId.
  useEffect(() => {
    const log = round?.guessLog ?? [];
    if (lastGuessLogLength.current != null && log.length > lastGuessLogLength.current) {
      const latest = log[log.length - 1];
      setLastGuessAttempt(latest);
      const timeouts = [setTimeout(() => setLastGuessAttempt(null), 5000)];
      if (latest.correct && latest.playerId === myId) {
        setGuessFlash(true);
        timeouts.push(setTimeout(() => setGuessFlash(null), 1400));
      }
      lastGuessLogLength.current = log.length;
      return () => timeouts.forEach(clearTimeout);
    }
    lastGuessLogLength.current = log.length;
  }, [round?.guessLog, myId]);

  if (!round) return null;

  if (room.phase === "suggest") {
    const others = room.players.filter(p => p.id !== myId);
    // Writing a word for any given player is optional — not everyone has to
    // have an idea for everyone else. The only real requirement is
    // collective (every target ends up with at least one suggestion once
    // everybody's submitted — see engine.ts's fallback for anyone nobody
    // wrote anything for), so this only blocks submitting literally nothing.
    const anyFilled = others.some(p => (suggestionDrafts[p.id] ?? "").trim());
    const submitAll = () => {
      if (!anyFilled) return;
      const suggestions = Object.fromEntries(others.map(p => [p.id, (suggestionDrafts[p.id] ?? "").trim()]).filter(([, text]) => text));
      send({ type: "submit_suggestion", suggestions });
    };
    return (
      <PhaseTransition phaseKey="suggest">
        <div>
          {role?.mySuggestionSubmitted ? (
            <div style={{ ...S.card, textAlign: "center" }}>
              <p style={{ color: "#5DCAA5" }}>Enviaste tus sugerencias</p>
              <p style={S.muted}>
                Esperando a los demás: {round.submittedCount}/{room.players.length}
              </p>
            </div>
          ) : (
            <div style={S.card}>
              <span style={S.label}>Escribile una palabra a quien quieras</span>
              <p style={{ ...S.muted, margin: "0 0 10px" }}>
                No hace falta pensar una para cada uno — van a ser las opciones que el grupo vote para decidir la palabra secreta de cada
                uno.
              </p>
              {others.map(p => (
                <div key={p.id} style={{ marginBottom: 10 }}>
                  <span style={{ ...S.label, marginBottom: 4 }}>{p.name}</span>
                  <input
                    style={S.input}
                    placeholder="Ej: Messi, Bombero, Batman... (opcional)"
                    value={suggestionDrafts[p.id] ?? ""}
                    onChange={e => setSuggestionDrafts(prev => ({ ...prev, [p.id]: e.target.value }))}
                  />
                </div>
              ))}
              <Btn variant="success" disabled={!anyFilled} onClick={submitAll} style={{ marginTop: 4 }}>
                Enviar
              </Btn>
            </div>
          )}
        </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "vote") {
    const isMyWord = round.currentVoteTarget === myId;
    return (
      <PhaseTransition phaseKey="vote">
        <div>
          <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 10 }}>
            <p style={{ ...S.muted, margin: 0 }}>Votando la palabra de</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#AFA9EC", margin: "4px 0 0" }}>{nameOf(room, round.currentVoteTarget)}</p>
          </div>
          {isMyWord ? (
            <div style={{ ...S.card, textAlign: "center" }}>
              <p style={{ color: "#9089c0" }}>Es tu palabra — no podés ver las opciones ni votar.</p>
            </div>
          ) : role?.myVote != null ? (
            <div style={{ ...S.card, textAlign: "center" }}>
              <p style={{ color: "#5DCAA5" }}>Voto enviado</p>
              <p style={S.muted}>
                {round.voteSubmittedCount}/{round.voteEligibleCount} votaron
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(role?.voteSuggestions ?? []).map((text, i) => (
                <button
                  key={i}
                  onClick={() => send({ type: "vote_suggestion", suggestionIndex: i })}
                  style={{ ...S.btn("ghost"), textAlign: "left" }}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
        </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "assign") {
    return (
      <PhaseTransition phaseKey="assign">
        <div>
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>¡Ya se decidieron todas las palabras!</p>
          <Collapsible title="Palabras de los demás" defaultOpen>
            <OthersWordsList
              entries={room.players.filter(p => p.id !== myId).map(p => ({ id: p.id, name: p.name, word: role?.wordsVisibleToMe[p.id] }))}
            />
          </Collapsible>
          {isHost ? (
            <StartButton onClick={() => send({ type: "confirm_words_ready" })}>Empezar a preguntar</StartButton>
          ) : (
            <div style={{ ...S.card, textAlign: "center" }}>
              <p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión arranque la ronda</p>
            </div>
          )}
        </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "playing") {
    const myOutcome = round.results?.find(r => r.playerId === myId)?.outcome ?? null;
    const isMyTurn = round.currentTurnPlayerId === myId;
    const pending = round.pendingQuestion;
    const myResponse = pending && myId ? pending.responses[myId] : undefined;
    const canAnswer = pending && pending.by !== myId && !myResponse;
    const pendingRespondedCount = pending ? Object.keys(pending.responses).length : 0;
    const pendingOwedCount = pending ? room.players.filter(p => p.online && p.id !== pending.by).length : 0;
    const wrongGuesses = round.wrongGuesses || {};
    // Every player's questions are about a different secret word, so mixing
    // them all into one shared log reads as noise — each player only cares
    // about their own trail of questions/answers while they work theirs out.
    const myQuestions = (round.qaLog ?? [])
      .map((qa, index) => ({ qa, index }))
      .filter(({ qa }) => qa.turnPlayerId === myId)
      .reverse();
    // Players who dropped out (solved/eliminated/conceded) stay in the turn
    // circle instead of disappearing from it — see TurnCircle's `outcomes`.
    const outcomeByPlayer = Object.fromEntries((round.results ?? []).map(r => [r.playerId, r.outcome]));

    const submitQuestion = () => {
      if (!questionText.trim()) return;
      send({ type: "ask_question", text: questionText.trim() });
      setQuestionText("");
      setActionMode("idle");
    };
    const submitGuess = () => {
      if (!guessText.trim()) return;
      send({ type: "guess", text: guessText.trim() });
      setGuessText("");
      setActionMode("idle");
    };
    const answer = (value: "si" | "no" | "skip") => {
      send({ type: "answer_question", answer: value, comment: answerComment.trim() || undefined });
      setAnswerComment("");
    };

    return (
      <PhaseTransition phaseKey="playing">
        <div>
          {guessFlash != null && <GuessFlash correct={guessFlash} />}
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>Ronda {round.lapNumber}</p>

          {lastGuessAttempt && (
            <div
              style={{
                ...S.cardHighlight,
                textAlign: "center",
                background: lastGuessAttempt.correct ? "rgba(93,202,165,0.12)" : "rgba(240,149,149,0.1)",
              }}
            >
              <p style={{ margin: 0, fontSize: 14 }}>
                <strong style={{ color: "#AFA9EC" }}>{nameOf(room, lastGuessAttempt.playerId)}</strong> intentó: "{lastGuessAttempt.text}"
              </p>
              <p style={{ margin: "6px 0 0", fontWeight: 700, color: lastGuessAttempt.correct ? "#5DCAA5" : "#F09595" }}>
                {lastGuessAttempt.correct ? "¡Acertó! 🎉" : "No era"}
              </p>
            </div>
          )}

          {resolvedQACards.map(({ id, qa }) => (
            <div key={id} style={{ ...S.cardHighlight, background: "rgba(127,119,221,0.1)", position: "relative" }}>
              <button
                onClick={() => setResolvedQACards(prev => prev.filter(c => c.id !== id))}
                aria-label="Cerrar"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "none",
                  border: "none",
                  color: "#9089c0",
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                ✕
              </button>
              <span style={{ ...S.label, paddingRight: 20, display: "block" }}>
                Pregunta de {nameOf(room, qa.turnPlayerId)}: "{qa.question}"
              </span>
              <div style={{ marginTop: 6 }}>
                <QAResponses room={room} qa={qa} />
              </div>
            </div>
          ))}

          {myOutcome && (
            <div
              style={{
                ...S.cardHighlight,
                textAlign: "center",
                border: `1px solid ${myOutcome === "solved" ? "rgba(93,202,165,0.5)" : "rgba(240,149,149,0.5)"}`,
                boxShadow: `0 0 16px ${myOutcome === "solved" ? "rgba(93,202,165,0.2)" : "rgba(240,149,149,0.2)"}`,
              }}
            >
              <p style={{ fontSize: 18, fontWeight: 800, color: myOutcome === "solved" ? "#5DCAA5" : "#F09595", margin: 0 }}>
                {myOutcome === "solved"
                  ? "¡Ya adivinaste tu palabra!"
                  : myOutcome === "eliminated"
                    ? "Te quedaste sin intentos"
                    : "Te rendiste"}
              </p>
              {role?.myWord && (
                <p style={{ margin: "8px 0 0", fontSize: 14 }}>
                  Tu palabra era: <strong style={{ color: "#AFA9EC" }}>{role.myWord}</strong>
                </p>
              )}
              <p style={{ ...S.muted, margin: "8px 0 0" }}>Esperando a que termine el resto...</p>
            </div>
          )}

          <Collapsible title="Palabras de los demás">
            <OthersWordsList
              entries={room.players.filter(p => p.id !== myId).map(p => ({ id: p.id, name: p.name, word: role?.wordsVisibleToMe[p.id] }))}
            />
          </Collapsible>

          {(round.turnOrder?.length ?? 0) > 0 && (
            <div style={S.card}>
              <TurnCircle
                turnOrder={round.turnOrder!}
                turnIndex={Math.max(0, round.turnOrder!.indexOf(round.currentTurnPlayerId ?? ""))}
                players={room.players}
                meId={myId}
                outcomes={outcomeByPlayer}
              />
            </div>
          )}

          {!myOutcome && myId && wrongGuesses[myId] > 0 && (
            <p style={{ ...S.muted, textAlign: "center", marginBottom: 14 }}>
              Tus intentos fallidos: {wrongGuesses[myId]}/{MAX_WRONG_GUESSES}
            </p>
          )}

          {/* Keyed by whichever sub-state is showing (pending question / idle
              buttons / asking / guessing / none) so switching between them —
              e.g. right after asking a question, when the buttons vanish and
              "Mis preguntas" jumps up to fill the gap — fades the new state
              in instead of just snapping, which read as jarring. */}
          <PhaseTransition phaseKey={pending ? "pending" : isMyTurn && !myOutcome ? actionMode : "none"}>
            {pending && (
              <div style={S.card}>
                <span style={S.label}>Pregunta de {nameOf(room, pending.by)}</span>
                <p style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 10px" }}>"{pending.text}"</p>
                {canAnswer ? (
                  <>
                    <input
                      style={{ ...S.input, marginBottom: 8 }}
                      placeholder="Comentario opcional..."
                      value={answerComment}
                      onChange={e => setAnswerComment(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn variant="success" onClick={() => answer("si")} style={{ flex: 1 }}>
                        Sí
                      </Btn>
                      <Btn variant="danger" onClick={() => answer("no")} style={{ flex: 1 }}>
                        No
                      </Btn>
                      <Btn variant="ghost" onClick={() => answer("skip")} style={{ width: "auto", padding: "13px 14px" }}>
                        Paso
                      </Btn>
                    </div>
                  </>
                ) : pending.by === myId ? (
                  <p style={S.muted}>
                    Esperando respuestas... {pendingRespondedCount}/{pendingOwedCount}
                  </p>
                ) : (
                  <p style={{ color: "#5DCAA5" }}>
                    Ya respondiste — esperando al resto ({pendingRespondedCount}/{pendingOwedCount})
                  </p>
                )}
              </div>
            )}

            {isMyTurn && !myOutcome && !pending && actionMode === "idle" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <Btn onClick={() => setActionMode("asking")} style={{ flex: 1 }}>
                  Preguntar
                </Btn>
                <Btn variant="success" onClick={() => setActionMode("guessing")} style={{ flex: 1 }}>
                  Adivinar
                </Btn>
                <Btn variant="danger" onClick={() => setConfirmingConcede(true)} style={{ width: "auto", padding: "13px 16px" }}>
                  🏳️
                </Btn>
              </div>
            )}

            {isMyTurn && actionMode === "asking" && (
              <div style={S.card}>
                <span style={S.label}>Tu pregunta</span>
                <input
                  style={S.input}
                  placeholder="¿Soy famoso? ¿Existo hoy en día?..."
                  value={questionText}
                  onChange={e => setQuestionText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") submitQuestion();
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Btn variant="ghost" onClick={() => setActionMode("idle")} style={{ flex: 1 }}>
                    Cancelar
                  </Btn>
                  <Btn variant="success" disabled={!questionText.trim()} onClick={submitQuestion} style={{ flex: 1 }}>
                    Enviar
                  </Btn>
                </div>
              </div>
            )}

            {isMyTurn && actionMode === "guessing" && (
              <div style={S.card}>
                <span style={S.label}>¿Quién sos?</span>
                <input
                  style={S.input}
                  placeholder="Escribí tu respuesta..."
                  value={guessText}
                  onChange={e => setGuessText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") submitGuess();
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Btn variant="ghost" onClick={() => setActionMode("idle")} style={{ flex: 1 }}>
                    Cancelar
                  </Btn>
                  <Btn variant="success" disabled={!guessText.trim()} onClick={submitGuess} style={{ flex: 1 }}>
                    Confirmar
                  </Btn>
                </div>
              </div>
            )}
          </PhaseTransition>

          <Collapsible title="Mis preguntas">
            {myQuestions.length === 0 && <p style={S.muted}>Todavía no preguntaste nada</p>}
            {myQuestions.map(({ qa, index }) => {
              const isOpen = openQuestions.has(index);
              return (
                <div key={index} style={{ padding: "6px 0", borderBottom: "1px solid rgba(127,119,221,0.08)", fontSize: 13 }}>
                  <button
                    onClick={() =>
                      setOpenQuestions(prev => {
                        const next = new Set(prev);
                        if (next.has(index)) next.delete(index);
                        else next.add(index);
                        return next;
                      })
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      background: "none",
                      border: "none",
                      padding: 0,
                      margin: 0,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      color: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <span>"{qa.question}"</span>
                    <span
                      style={{
                        color: "#7F77DD",
                        fontSize: 11,
                        transform: isOpen ? "rotate(180deg)" : "none",
                        flexShrink: 0,
                        marginLeft: 8,
                      }}
                    >
                      ▼
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ margin: "6px 0 0" }}>
                      <QAResponses room={room} qa={qa} />
                    </div>
                  )}
                </div>
              );
            })}
          </Collapsible>

          <div style={S.card}>
            <span style={S.label}>Mis anotaciones</span>
            <textarea
              style={{ ...S.input, minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
              placeholder="Notas privadas solo para vos, para pensar mejor..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {confirmingConcede && (
            <ConfirmDialog
              title="¿Rendirte?"
              message="Quedás afuera de la ronda sin sumar puntos."
              confirmLabel="Rendirme"
              onConfirm={() => {
                setConfirmingConcede(false);
                send({ type: "concede" });
              }}
              onCancel={() => setConfirmingConcede(false)}
            />
          )}
        </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "result") {
    const words = reveal?.words ?? round.words ?? {};
    const totalScores = room.config.score as Record<string, number>;
    const entries = buildStandingEntries(room.players, round.results ?? [], words, totalScores);

    return (
      <PhaseTransition phaseKey="result">
        <div>
          <Standings entries={entries} />
          {isHost ? (
            <StartButton onClick={() => send({ type: "new_game" })}>Nueva partida</StartButton>
          ) : (
            <div style={{ ...S.card, textAlign: "center" }}>
              <p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión inicie otra partida</p>
            </div>
          )}
          <LeaveToLobbyButton groupCode={room.groupCode} send={send} />
        </div>
      </PhaseTransition>
    );
  }

  return null;
}
