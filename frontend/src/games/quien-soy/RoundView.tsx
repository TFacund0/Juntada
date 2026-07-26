import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { Collapsible } from "../../components/Collapsible";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { LeaveToLobbyButton } from "../../components/LeaveToLobbyButton";
import { PhaseTransition } from "../../components/PhaseTransition";
import { TurnCircle } from "../../components/TurnCircle";
import { Standings, computeMatchRanks, type StandingEntry } from "./Standings";
import type { RoundViewProps } from "../gameTypes";

interface QAResponse {
  answer: "si" | "no" | "skip";
  comment: string | null;
}

interface QAEntry {
  turnPlayerId: string;
  question: string;
  responses: Record<string, QAResponse>;
}

interface QuienSoyRoundState {
  wordSource?: "categories" | "suggested";
  submittedCount?: number | null;
  currentVoteTarget?: string | null;
  voteSubmittedCount?: number | null;
  voteEligibleCount?: number | null;
  currentTurnPlayerId?: string | null;
  turnOrder?: string[];
  lapNumber?: number;
  pendingQuestion?: { by: string; text: string; responses: Record<string, QAResponse> } | null;
  qaLog?: QAEntry[];
  guessLog?: { playerId: string; correct: boolean }[];
  wrongGuesses?: Record<string, number>;
  results?: { playerId: string; outcome: "solved" | "eliminated" | "conceded"; lap: number }[];
  words?: Record<string, string> | null;
}

interface QuienSoyPrivateRole {
  wordsVisibleToMe: Record<string, string>;
  myWrongGuesses: number;
  mySuggestionSubmitted: boolean;
  voteSuggestions: string[] | null;
  myVote: number | null;
  myWord: string | null;
}

interface QuienSoyReveal {
  words: Record<string, string>;
}

const MAX_WRONG_GUESSES = 3;

function nameOf(room: RoundViewProps["room"], id: string | null | undefined): string {
  return room.players.find(p => p.id === id)?.name ?? "…";
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

  const round = room.round as QuienSoyRoundState | null;
  const role = myRole as QuienSoyPrivateRole | null;
  const reveal = wordReveal as QuienSoyReveal | null;
  const myId = me?.playerId;

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
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>Votando la palabra de {nameOf(room, round.currentVoteTarget)}</p>
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
            {room.players
              .filter(p => p.id !== myId)
              .map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14 }}>
                  <span style={{ color: "#b8b0d4" }}>{p.name}</span>
                  <span style={{ fontWeight: 700 }}>{role?.wordsVisibleToMe[p.id] ?? "—"}</span>
                </div>
              ))}
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
      send({ type: "answer_question", answer: value, comment: value === "skip" ? undefined : answerComment.trim() || undefined });
      setAnswerComment("");
    };

    return (
      <PhaseTransition phaseKey="playing">
        <div>
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>Ronda {round.lapNumber}</p>

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
            {room.players
              .filter(p => p.id !== myId)
              .map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14 }}>
                  <span style={{ color: "#b8b0d4" }}>{p.name}</span>
                  <span style={{ fontWeight: 700 }}>{role?.wordsVisibleToMe[p.id] ?? "—"}</span>
                </div>
              ))}
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
                    <div style={{ margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
                      {Object.entries(qa.responses).map(([playerId, resp]) =>
                        resp.answer === "skip" ? (
                          <p key={playerId} style={{ margin: 0, color: "#9089c0" }}>
                            {nameOf(room, playerId)} prefirió no responder
                          </p>
                        ) : (
                          <p key={playerId} style={{ margin: 0, color: resp.answer === "si" ? "#5DCAA5" : "#F09595" }}>
                            {nameOf(room, playerId)} respondió: {resp.answer === "si" ? "Sí" : "No"}
                            {resp.comment ? ` — "${resp.comment}"` : ""}
                          </p>
                        ),
                      )}
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
    const ranks = computeMatchRanks(round.results ?? [], room.players.length);
    const entries: StandingEntry[] = room.players
      .map(p => {
        const result = round.results?.find(r => r.playerId === p.id);
        const rankInfo = ranks[p.id];
        return {
          id: p.id,
          name: p.name,
          outcome: (result?.outcome ?? "playing") as StandingEntry["outcome"],
          rank: rankInfo?.rank ?? null,
          word: words[p.id] ?? null,
          points: rankInfo?.points ?? 0,
        };
      })
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

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
          <LeaveToLobbyButton groupCode={room.groupCode} send={send} confirm={{ message: "Se interrumpe la partida para todos." }} />
        </div>
      </PhaseTransition>
    );
  }

  return null;
}
