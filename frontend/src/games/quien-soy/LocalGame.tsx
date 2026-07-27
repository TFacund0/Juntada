import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { ConfirmBackButton } from "../../components/ConfirmBackButton";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { AddPlayerForm } from "../../components/AddPlayerForm";
import { SetupTabs, type SetupTab } from "../../components/SetupTabs";
import { StickyActionBar } from "../../components/StickyActionBar";
import { TurnCircle } from "../../components/TurnCircle";
import { MinPlayersHint } from "../../components/MinPlayersHint";
import { useFlashError } from "../../hooks/useFlashError";
import { nextPlayerName } from "../../utils/playerNames";
import { shuffle } from "../../utils/shuffle";
import { isCorrectGuess, MAX_WRONG_GUESSES, computeMatchRanks, type QuienSoyResult } from "@juntada/quien-soy-data";
import { WordsEditor } from "./WordsEditor";
import { Standings, buildStandingEntries } from "./Standings";
import { OthersWordsList } from "./OthersWordsList";

// ═══════════════════════════════════════════════════════════════════════════════
// ¿QUIÉN SOY? — un solo dispositivo, pasándoselo por turnos. El grupo anota
// la palabra secreta de cada jugador a mano (nada de categorías ni votación
// — eso es solo para el modo online, donde no hay forma de acordar en voz
// alta). Por turnos: preguntar, adivinar o rendirse. Misma lógica de
// "vueltas" (laps) que el motor online — quien acierta en la misma vuelta
// que otro empata en el puesto.
// ═══════════════════════════════════════════════════════════════════════════════

interface LocalPlayer {
  id: string;
  name: string;
}

interface QAEntry {
  turnPlayerId: string;
  question: string;
  answer: "si" | "no";
}

type Phase = "setup" | "turnHandoff" | "turnAction" | "answerHandoff" | "answerInput" | "final";

export function LocalGame() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [setupTab, setSetupTab] = useState<SetupTab>("players");
  const [players, setPlayers] = useState<LocalPlayer[]>([
    { id: "p1", name: "Jugador 1" },
    { id: "p2", name: "Jugador 2" },
    { id: "p3", name: "Jugador 3" },
  ]);
  const [newName, setNewName] = useState("");
  const [nameError, nameErrorKey, setNameError] = useFlashError();
  const [words, setWords] = useState<Record<string, string>>({});
  const [score, setScore] = useState<Record<string, number>>({});

  const [turnQueue, setTurnQueue] = useState<string[]>([]);
  const [lapNumber, setLapNumber] = useState(1);
  const [turnsThisLap, setTurnsThisLap] = useState(0);
  const [lapSize, setLapSize] = useState(0);
  const [wrongGuesses, setWrongGuesses] = useState<Record<string, number>>({});
  const [results, setResults] = useState<QuienSoyResult[]>([]);
  const [qaLog, setQaLog] = useState<QAEntry[]>([]);
  const [actionMode, setActionMode] = useState<"idle" | "asking" | "guessing">("idle");
  const [questionText, setQuestionText] = useState("");
  const [guessText, setGuessText] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<{ by: string; text: string } | null>(null);
  const [confirmingConcede, setConfirmingConcede] = useState(false);

  const nameOf = (id: string | null | undefined) => players.find(p => p.id === id)?.name ?? "…";
  const allWordsFilled = players.every(p => (words[p.id] ?? "").trim());

  const addPlayer = () => {
    const trimmed = newName.trim() || nextPlayerName(players.map(p => p.name));
    if (players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    setPlayers(p => [...p, { id: `p${Date.now()}`, name: trimmed }]);
    setNewName("");
  };
  const removePlayer = (id: string) => setPlayers(p => p.filter(x => x.id !== id));

  const startGame = () => {
    setResults([]);
    const queue = shuffle(players.map(p => p.id));
    setTurnQueue(queue);
    setLapNumber(1);
    setTurnsThisLap(0);
    setLapSize(queue.length);
    setWrongGuesses({});
    setQaLog([]);
    setPhase("turnHandoff");
  };

  const finalizeResults = (finalResults: QuienSoyResult[]) => {
    const ranks = computeMatchRanks(finalResults, players.length);
    setScore(s => {
      const next = { ...s };
      Object.entries(ranks).forEach(([id, { points }]) => {
        next[id] = (next[id] || 0) + points;
      });
      return next;
    });
  };

  const finishTurn = (stillActive: boolean, updatedResults?: QuienSoyResult[]) => {
    // Persist any newly-recorded result (a solve/eliminate/concede) right
    // away, not just once the queue empties — otherwise a concede/elimination
    // that isn't the very last one to happen gets silently dropped the next
    // time finishTurn runs, since it'd overwrite state with the stale
    // `results` it captured before this one was ever saved.
    if (updatedResults) setResults(updatedResults);
    const currentResults = updatedResults ?? results;

    const queue = [...turnQueue];
    const id = queue.shift();
    if (stillActive && id) queue.push(id);
    const newTurnsThisLap = turnsThisLap + 1;

    if (queue.length === 0) {
      finalizeResults(currentResults);
      setTurnQueue([]);
      setPhase("final");
      return;
    }
    setTurnQueue(queue);
    if (newTurnsThisLap >= lapSize) {
      setLapNumber(l => l + 1);
      setTurnsThisLap(0);
      setLapSize(queue.length);
    } else {
      setTurnsThisLap(newTurnsThisLap);
    }
    setPhase("turnHandoff");
  };

  const askQuestion = () => {
    setPendingQuestion({ by: turnQueue[0], text: questionText.trim() });
    setQuestionText("");
    setActionMode("idle");
    setPhase("answerHandoff");
  };

  const submitGuess = () => {
    const playerId = turnQueue[0];
    const correct = isCorrectGuess(guessText, words[playerId]);
    setGuessText("");
    setActionMode("idle");
    if (correct) {
      const nextResults = [...results, { playerId, outcome: "solved" as const, lap: lapNumber }];
      finishTurn(false, nextResults);
      return;
    }
    const attempts = (wrongGuesses[playerId] || 0) + 1;
    setWrongGuesses(w => ({ ...w, [playerId]: attempts }));
    if (attempts >= MAX_WRONG_GUESSES) {
      const nextResults = [...results, { playerId, outcome: "eliminated" as const, lap: lapNumber }];
      finishTurn(false, nextResults);
    } else {
      finishTurn(true);
    }
  };

  const concede = () => {
    setConfirmingConcede(false);
    const playerId = turnQueue[0];
    const nextResults = [...results, { playerId, outcome: "conceded" as const, lap: lapNumber }];
    finishTurn(false, nextResults);
  };

  const answerQuestion = (value: "si" | "no") => {
    setQaLog(log => [...log, { turnPlayerId: pendingQuestion!.by, question: pendingQuestion!.text, answer: value }]);
    setPendingQuestion(null);
    finishTurn(true);
  };

  const playAgain = () => {
    setResults([]);
    setPhase("setup");
  };

  // ── SETUP ──
  if (phase === "setup")
    return (
      <div style={{ paddingBottom: 88 }}>
        <SetupTabs tab={setupTab} onChange={setSetupTab} />

        {setupTab === "players" && (
          <div style={S.card}>
            <span style={S.label}>Jugadores ({players.length})</span>
            {players.map(p => (
              <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input
                  style={{ ...S.input, flex: 1 }}
                  value={p.name}
                  onChange={e => setPlayers(prev => prev.map(x => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
                />
                {players.length > 2 && (
                  <button
                    onClick={() => removePlayer(p.id)}
                    style={{ ...S.btn("danger"), width: 36, height: 36, padding: 0, borderRadius: 8, flexShrink: 0 }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <AddPlayerForm name={newName} onNameChange={setNewName} onSubmit={addPlayer} error={nameError} errorKey={nameErrorKey} />
          </div>
        )}

        {setupTab === "config" && (
          <WordsEditor players={players} words={words} onChange={(id, value) => setWords(w => ({ ...w, [id]: value }))} />
        )}

        <StickyActionBar>
          <StartButton disabled={players.length < 2 || !allWordsFilled} onClick={startGame}>
            Empezar a jugar
          </StartButton>
          <MinPlayersHint count={players.length} min={2} />
          {players.length >= 2 && !allWordsFilled && (
            <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Faltan palabras — completalas en "Configuración"</p>
          )}
        </StickyActionBar>
      </div>
    );

  // ── TURNO ──
  if (phase === "turnHandoff") {
    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ ...S.label, marginBottom: 4 }}>Ronda {lapNumber}</p>
          <p style={S.bigReveal}>{nameOf(turnQueue[0])}</p>
          <p style={S.muted}>Pasále el dispositivo. Es tu turno.</p>
        </div>
        <StartButton onClick={() => setPhase("turnAction")}>Empezar mi turno</StartButton>
      </div>
    );
  }

  if (phase === "turnAction") {
    const playerId = turnQueue[0];
    return (
      <div>
        <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>Ronda {lapNumber}</p>

        <TurnCircle turnOrder={turnQueue} turnIndex={0} players={players} meId={playerId} />

        <div style={S.card}>
          <span style={S.label}>Palabras del resto</span>
          <OthersWordsList entries={players.filter(p => p.id !== playerId).map(p => ({ id: p.id, name: p.name, word: words[p.id] }))} />
        </div>

        {wrongGuesses[playerId] > 0 && (
          <p style={{ ...S.muted, textAlign: "center" }}>
            Intentos fallidos: {wrongGuesses[playerId]}/{MAX_WRONG_GUESSES}
          </p>
        )}

        {actionMode === "idle" && (
          <div style={{ display: "flex", gap: 8 }}>
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

        {actionMode === "asking" && (
          <div style={S.card}>
            <span style={S.label}>Tu pregunta (decila en voz alta)</span>
            <input style={S.input} value={questionText} onChange={e => setQuestionText(e.target.value)} placeholder="¿Soy famoso?..." />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Btn variant="ghost" onClick={() => setActionMode("idle")} style={{ flex: 1 }}>
                Cancelar
              </Btn>
              <Btn variant="success" disabled={!questionText.trim()} onClick={askQuestion} style={{ flex: 1 }}>
                Siguiente: que respondan
              </Btn>
            </div>
          </div>
        )}

        {actionMode === "guessing" && (
          <div style={S.card}>
            <span style={S.label}>¿Quién sos?</span>
            <input style={S.input} value={guessText} onChange={e => setGuessText(e.target.value)} placeholder="Escribí tu respuesta..." />
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

        {qaLog.length > 0 && (
          <div style={S.card}>
            <span style={S.label}>Historial</span>
            {qaLog
              .slice()
              .reverse()
              .slice(0, 5)
              .map((qa, i) => (
                <p key={i} style={{ fontSize: 13, margin: "4px 0" }}>
                  <strong>{nameOf(qa.turnPlayerId)}</strong>: "{qa.question}" →{" "}
                  <span style={{ color: qa.answer === "si" ? "#5DCAA5" : "#F09595" }}>{qa.answer === "si" ? "Sí" : "No"}</span>
                </p>
              ))}
          </div>
        )}

        {confirmingConcede && (
          <ConfirmDialog
            title="¿Rendirte?"
            message="Quedás afuera de la ronda sin sumar puntos."
            confirmLabel="Rendirme"
            onConfirm={concede}
            onCancel={() => setConfirmingConcede(false)}
          />
        )}
      </div>
    );
  }

  // ── RESPONDER PREGUNTA (el resto del grupo, sin el que pregunta) ──
  if (phase === "answerHandoff" || phase === "answerInput") {
    if (phase === "answerHandoff")
      return (
        <div>
          <div style={{ ...S.cardHighlight, textAlign: "center" }}>
            <p style={S.muted}>Que agarre el dispositivo cualquiera menos {nameOf(pendingQuestion?.by)}.</p>
          </div>
          <StartButton onClick={() => setPhase("answerInput")}>Ver la pregunta</StartButton>
        </div>
      );
    return (
      <div>
        <div style={S.card}>
          <span style={S.label}>Pregunta de {nameOf(pendingQuestion?.by)}</span>
          <p style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 10px" }}>"{pendingQuestion?.text}"</p>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="success" onClick={() => answerQuestion("si")} style={{ flex: 1 }}>
              Sí
            </Btn>
            <Btn variant="danger" onClick={() => answerQuestion("no")} style={{ flex: 1 }}>
              No
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  // ── FINAL ──
  const entries = buildStandingEntries(players, results, words, score);

  return (
    <div>
      <Standings entries={entries} />
      <div style={{ marginTop: 14 }}>
        <StartButton onClick={playAgain}>Jugar de nuevo</StartButton>
      </div>
      <ConfirmBackButton
        title="¿Volver a jugadores?"
        message="Se pierde el resultado de esta partida."
        confirmLabel="Volver"
        onConfirm={() => setPhase("setup")}
      >
        Volver a jugadores
      </ConfirmBackButton>
    </div>
  );
}
