import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import { Toggle } from "../../components/Toggle";
import { shuffle } from "../../utils/shuffle";
import { SPECTRUMS } from "@juntada/sintonia-data";
import { scoreFor } from "@juntada/sintonia-scoring";
import { Dial } from "./Dial";

// ═══════════════════════════════════════════════════════════════════════════════
// SINTONÍA (estilo Wavelength) — un solo dispositivo, se pasa de mano en mano.
// Mismo modelo que el modo online: antes de cada ronda se elige quién es el
// psíquico (sugerido por turno, manual o al azar) y qué par de conceptos se
// usa (uno al azar de la base, o uno escrito a mano). El psíquico ve el
// objetivo secreto y, si "pistas escritas" está activo, la escribe; si no,
// la dice en voz alta. Después el dispositivo pasa de jugador en jugador para
// que cada uno adivine por su cuenta, y al final se revela el objetivo con la
// marca de cada uno y el puntaje de la ronda — igual que en el modo online.
// ═══════════════════════════════════════════════════════════════════════════════

interface LocalPlayer {
  id: number;
  name: string;
}

interface RoundData {
  left: string;
  right: string;
  target: number;
  psychicId: number;
  psychicName: string;
  clue: string | null;
  guesses: Record<number, number>;
  pointsByPlayer?: Record<number, number>;
}

interface HistoryEntry {
  left: string;
  right: string;
  target: number;
  psychicId: number;
  psychicName: string;
  guesses: Record<number, number>;
  pointsByPlayer: Record<number, number>;
}

const MIN_PLAYERS = 2;

function randomTarget(): number {
  return 8 + Math.floor(Math.random() * 85); // 8..92, evita los extremos
}

function Scoreboard({ players, history, totalScore }: { players: LocalPlayer[]; history: HistoryEntry[]; totalScore: number }) {
  const ranked = players
    .map(p => ({
      ...p,
      points: history.reduce((sum, h) => sum + (h.pointsByPlayer[p.id] || 0), 0),
      timesPsychic: history.filter(h => h.psychicId === p.id).length,
    }))
    .sort((a, b) => b.points - a.points);
  return (
    <div style={S.card}>
      <span style={S.label}>Tabla de puntuación (puntaje total: {totalScore})</span>
      {ranked.map((p, i) => (
        <div
          key={p.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 0",
            borderBottom: i < ranked.length - 1 ? "1px solid rgba(127,119,221,0.08)" : "none",
          }}
        >
          <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{i + 1}</span>
          <Avatar name={p.name} size={28} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}</span>
          <span style={{ ...S.muted, fontSize: 12 }}>psíquico x{p.timesPsychic}</span>
          <span style={{ fontWeight: 800, color: "#AFA9EC", minWidth: 28, textAlign: "right" }}>{p.points}</span>
        </div>
      ))}
    </div>
  );
}

export function LocalGame() {
  const [phase, setPhase] = useState<"setup" | "roundSetup" | "reveal" | "guessTurn" | "result">("setup");
  const [players, setPlayers] = useState<LocalPlayer[]>([
    { id: 1, name: "Jugador 1" },
    { id: 2, name: "Jugador 2" },
    { id: 3, name: "Jugador 3" },
  ]);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");
  const [config, setConfig] = useState({ writtenClues: false });

  const [pool, setPool] = useState<[string, string][]>([]); // pares de la base sin usar en esta partida
  const [turnIdx, setTurnIdx] = useState(0);
  const [round, setRound] = useState<RoundData | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [clueText, setClueText] = useState("");
  const [guessOrder, setGuessOrder] = useState<number[]>([]);
  const [guessIdx, setGuessIdx] = useState(0);
  const [guessValue, setGuessValue] = useState(50);
  const [totalScore, setTotalScore] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [setupPsychicId, setSetupPsychicId] = useState<number | "random" | null>(null); // null = sugerido, "random", o un id
  const [setupSpectrumMode, setSetupSpectrumMode] = useState<"random" | "manual">("random");
  const [setupManualLeft, setSetupManualLeft] = useState("");
  const [setupManualRight, setSetupManualRight] = useState("");

  const isDuplicateName = (name: string, excludeId: number | null) => {
    const norm = name.trim().toLowerCase();
    return players.some(p => p.id !== excludeId && p.name.trim().toLowerCase() === norm);
  };

  const renamePlayer = (id: number, name: string) => {
    if (name.trim() && isDuplicateName(name, id)) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    setPlayers(prev => prev.map(x => (x.id === id ? { ...x, name } : x)));
  };

  const addPlayer = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (isDuplicateName(trimmed, null)) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    setPlayers(p => [...p, { id: Date.now(), name: trimmed }]);
    setNewName("");
  };

  const goToRoundSetup = () => {
    setSetupPsychicId(null);
    setSetupSpectrumMode("random");
    setSetupManualLeft("");
    setSetupManualRight("");
    setPhase("roundSetup");
  };

  const startGame = () => {
    setTotalScore(0);
    setHistory([]);
    setTurnIdx(0);
    setRound(null);
    setPool([]);
    goToRoundSetup();
  };

  const confirmRoundSetup = () => {
    const suggestedId = players[turnIdx % players.length].id;
    let psychicId = setupPsychicId;
    if (!psychicId || psychicId === "random") {
      psychicId = setupPsychicId === "random" ? players[Math.floor(Math.random() * players.length)].id : suggestedId;
    }
    const psychic = players.find(p => p.id === psychicId)!;
    const psychicIdx = players.findIndex(p => p.id === psychicId);

    let left: string,
      right: string,
      nextPool = pool;
    if (setupSpectrumMode === "manual" && setupManualLeft.trim() && setupManualRight.trim()) {
      left = setupManualLeft.trim();
      right = setupManualRight.trim();
    } else {
      let source = pool;
      if (source.length === 0) source = shuffle(SPECTRUMS as [string, string][]);
      [left, right] = source[0];
      nextPool = source.slice(1);
    }

    setRound({ left, right, target: randomTarget(), psychicId: psychicId as number, psychicName: psychic.name, clue: null, guesses: {} });
    setPool(nextPool);
    setRevealed(false);
    setClueText("");
    setGuessOrder(players.filter(p => p.id !== psychicId).map(p => p.id));
    setGuessIdx(0);
    setGuessValue(50);
    setTurnIdx(psychicIdx + 1);
    setPhase("reveal");
  };

  const proceedToGuessing = () => {
    if (config.writtenClues) {
      if (!clueText.trim()) return;
      setRound(r => r && { ...r, clue: clueText.trim() });
    }
    setPhase("guessTurn");
  };

  const confirmCurrentGuess = () => {
    if (!round) return;
    const guesserId = guessOrder[guessIdx];
    const nextGuesses = { ...round.guesses, [guesserId]: guessValue };
    setRound(r => r && { ...r, guesses: nextGuesses });

    if (guessIdx + 1 < guessOrder.length) {
      setGuessIdx(i => i + 1);
      setGuessValue(50);
      return;
    }

    // Todos adivinaron: calcular puntos. El psíquico gana lo mismo que
    // sumaron entre todos los que adivinaron.
    const pointsByPlayer: Record<number, number> = {};
    let guesserPointsSum = 0;
    Object.entries(nextGuesses).forEach(([pid, value]) => {
      const pts = scoreFor(Math.abs(value - round.target));
      pointsByPlayer[Number(pid)] = pts;
      guesserPointsSum += pts;
    });
    pointsByPlayer[round.psychicId] = (pointsByPlayer[round.psychicId] || 0) + guesserPointsSum;

    setTotalScore(s => s + guesserPointsSum * 2);
    setHistory(h => [
      ...h,
      {
        left: round.left,
        right: round.right,
        target: round.target,
        psychicId: round.psychicId,
        psychicName: round.psychicName,
        guesses: nextGuesses,
        pointsByPlayer,
      },
    ]);
    setRound(r => r && { ...r, guesses: nextGuesses, pointsByPlayer });
    setPhase("result");
  };

  // ── SETUP (jugadores y configuración general) ──
  if (phase === "setup")
    return (
      <div>
        <div style={S.card}>
          <span style={S.label}>Jugadores ({players.length})</span>
          {players.map(p => (
            <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <Avatar name={p.name} size={32} />
              <input style={{ ...S.input, flex: 1 }} value={p.name} onChange={e => renamePlayer(p.id, e.target.value)} />
              <button
                onClick={() => setPlayers(prev => prev.filter(x => x.id !== p.id))}
                style={{ ...S.btn("danger"), width: 36, height: 36, padding: 0, borderRadius: 8, flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              style={{ ...S.input, flex: 1 }}
              placeholder="Nombre"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") addPlayer();
              }}
            />
            <Btn variant="ghost" onClick={addPlayer} style={{ width: "auto", padding: "11px 18px" }}>
              Agregar
            </Btn>
          </div>
          {nameError && <p style={{ fontSize: 12, color: "#F09595", marginTop: 8 }}>{nameError}</p>}
        </div>

        <div style={S.card}>
          <Toggle
            label={config.writtenClues ? "Pistas escritas (se escriben en el dispositivo)" : "Pistas dichas en voz alta"}
            value={config.writtenClues}
            onChange={v => setConfig(c => ({ ...c, writtenClues: v }))}
          />
        </div>

        <Btn onClick={startGame} disabled={players.length < MIN_PLAYERS}>
          Iniciar partida
        </Btn>
        {players.length < MIN_PLAYERS && (
          <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Necesitás mínimo {MIN_PLAYERS} jugadores</p>
        )}

        {history.length > 0 && <Scoreboard players={players} history={history} totalScore={totalScore} />}

        {history.length > 0 && (
          <div style={{ ...S.card, marginTop: 14 }}>
            <span style={S.label}>Historial de rondas</span>
            {history.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(127,119,221,0.08)",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#b8b0d4" }}>
                  {r.psychicName} · {r.left} / {r.right}
                </span>
                <span style={{ color: (r.pointsByPlayer[r.psychicId] || 0) > 0 ? "#5DCAA5" : "#F09595" }}>
                  psíquico +{r.pointsByPlayer[r.psychicId] || 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );

  // ── ROUND SETUP (elegir psíquico y par para esta ronda) ──
  if (phase === "roundSetup") {
    const suggestedId = players[turnIdx % players.length].id;
    const chosenPsychicId = setupPsychicId === null ? suggestedId : setupPsychicId;
    const manualIncomplete = setupSpectrumMode === "manual" && (!setupManualLeft.trim() || !setupManualRight.trim());

    return (
      <div>
        <div style={S.card}>
          <span style={S.label}>¿Quién es el psíquico esta ronda?</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => setSetupPsychicId(p.id)}
                style={{
                  ...S.btn(chosenPsychicId === p.id && setupPsychicId !== "random" ? "primary" : "ghost"),
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  justifyContent: "flex-start",
                  padding: "10px 14px",
                }}
              >
                <Avatar name={p.name} size={28} />
                <span>{p.name}</span>
                {p.id === suggestedId && <span style={{ ...S.muted, marginLeft: "auto", fontSize: 11 }}>sugerido por turno</span>}
              </button>
            ))}
            <button onClick={() => setSetupPsychicId("random")} style={{ ...S.btn(setupPsychicId === "random" ? "primary" : "ghost") }}>
              🎲 Elegir al azar
            </button>
          </div>
        </div>

        <div style={S.card}>
          <span style={S.label}>¿Qué par de conceptos usamos?</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => setSetupSpectrumMode("random")}
              style={{ ...S.btn(setupSpectrumMode === "random" ? "primary" : "ghost"), textAlign: "left" }}
            >
              🎲 Uno al azar de la base
            </button>
            <button
              onClick={() => setSetupSpectrumMode("manual")}
              style={{ ...S.btn(setupSpectrumMode === "manual" ? "primary" : "ghost"), textAlign: "left" }}
            >
              ✍️ Elegirlo yo mismo
            </button>
          </div>
          {setupSpectrumMode === "manual" && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                style={{ ...S.input, flex: 1 }}
                placeholder="Extremo izquierdo"
                value={setupManualLeft}
                onChange={e => setSetupManualLeft(e.target.value)}
              />
              <input
                style={{ ...S.input, flex: 1 }}
                placeholder="Extremo derecho"
                value={setupManualRight}
                onChange={e => setSetupManualRight(e.target.value)}
              />
            </div>
          )}
        </div>

        <Btn variant="success" onClick={confirmRoundSetup} disabled={manualIncomplete}>
          Empezar ronda
        </Btn>
        <Btn variant="ghost" onClick={() => setPhase("setup")} style={{ marginTop: 10 }}>
          Volver a configuración
        </Btn>
      </div>
    );
  }

  // ── REVEAL (el "psíquico" ve el objetivo) ──
  if (phase === "reveal" && round) {
    const psychic = players.find(p => p.id === round.psychicId)!;
    const canProceed = revealed && (!config.writtenClues || clueText.trim());
    return (
      <div>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Avatar name={psychic.name} size={56} />
          <p style={{ fontWeight: 800, fontSize: 20, marginTop: 10 }}>{psychic.name}</p>
          <p style={S.muted}>Pasále el dispositivo solo a esta persona</p>
        </div>
        <div
          style={{
            ...S.card,
            textAlign: "center",
            cursor: "pointer",
            border: revealed ? "1px solid rgba(127,119,221,0.4)" : "1px solid rgba(255,255,255,0.08)",
            minHeight: 260,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
          }}
          onClick={() => setRevealed(v => !v)}
        >
          {!revealed ? (
            <p style={{ color: "#6b6490", fontSize: 15 }}>Tocá para revelar el objetivo</p>
          ) : (
            <>
              <Dial value={round.target} target={round.target} leftLabel={round.left} rightLabel={round.right} />
              <p style={{ fontSize: 12, color: "#5a5280", marginTop: 12 }}>Tocá para ocultar</p>
            </>
          )}
        </div>
        {revealed && !config.writtenClues && (
          <p style={{ ...S.muted, textAlign: "center", margin: "12px 0" }}>
            Pensá una pista (una palabra, una persona, lo que sea) que ubique ese punto entre "{round.left}" y "{round.right}" y decila en
            voz alta. No digas el objetivo directamente.
          </p>
        )}
        {revealed && config.writtenClues && (
          <div style={S.card}>
            <span style={S.label}>Tu pista</span>
            <input style={S.input} placeholder="Escribí tu pista..." value={clueText} onChange={e => setClueText(e.target.value)} />
          </div>
        )}
        <Btn onClick={proceedToGuessing} disabled={!canProceed}>
          {config.writtenClues ? "Enviar pista y pasar a adivinar" : "Ya dije mi pista, pasar a adivinar"}
        </Btn>
      </div>
    );
  }

  // ── GUESS TURN (cada jugador adivina por turno) ──
  if (phase === "guessTurn" && round) {
    const guesser = players.find(p => p.id === guessOrder[guessIdx])!;
    return (
      <div>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Avatar name={guesser.name} size={56} />
          <p style={{ fontWeight: 800, fontSize: 20, marginTop: 10 }}>{guesser.name}</p>
          <p style={S.muted}>
            Turno {guessIdx + 1} de {guessOrder.length} — pasále el dispositivo a esta persona
          </p>
        </div>
        {round.clue ? (
          <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#9089c0" }}>Pista de {round.psychicName}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#AFA9EC" }}>"{round.clue}"</p>
          </div>
        ) : (
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 16 }}>Guiate por la pista que dijo {round.psychicName} en voz alta</p>
        )}
        <div style={S.card}>
          <Dial value={guessValue} leftLabel={round.left} rightLabel={round.right} />
          <input
            type="range"
            min="0"
            max="100"
            value={guessValue}
            onChange={e => setGuessValue(+e.target.value)}
            style={{ width: "100%", marginTop: 16 }}
          />
        </div>
        <Btn variant="success" onClick={confirmCurrentGuess}>
          {guessIdx + 1 < guessOrder.length ? "Confirmar y pasar al siguiente" : "Confirmar y revelar resultado"}
        </Btn>
      </div>
    );
  }

  // ── RESULT ──
  if (phase === "result" && round) {
    const points = round.pointsByPlayer || {};
    const markers = players
      .filter(p => p.id !== round.psychicId && round.guesses[p.id] != null)
      .map(p => ({ value: round.guesses[p.id], label: p.name.trim()[0]?.toUpperCase() }));

    return (
      <div>
        <div style={S.cardHighlight}>
          <Dial value={round.target} target={round.target} leftLabel={round.left} rightLabel={round.right} markers={markers} />
        </div>
        <div style={S.card}>
          <span style={S.label}>Pista de {round.psychicName}</span>
          {round.clue ? (
            <p style={{ fontSize: 18, fontWeight: 700, margin: "4px 0 0" }}>"{round.clue}"</p>
          ) : (
            <p style={{ ...S.muted, margin: "4px 0 0" }}>(dicha en voz alta)</p>
          )}
          <p style={{ ...S.muted, marginTop: 6 }}>
            {round.psychicName} gana lo mismo que sumaron los que adivinaron: +{points[round.psychicId] || 0}
          </p>
        </div>
        <div style={S.card}>
          <span style={S.label}>Puntos de la ronda</span>
          {players.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
              <span style={{ color: "#b8b0d4" }}>
                {p.name}
                {p.id === round.psychicId ? " (psíquico)" : ""}
              </span>
              <span style={{ color: (points[p.id] || 0) > 0 ? "#5DCAA5" : "#F09595" }}>+{points[p.id] || 0}</span>
            </div>
          ))}
        </div>
        <Scoreboard players={players} history={history} totalScore={totalScore} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          <Btn variant="success" onClick={goToRoundSetup}>
            Siguiente ronda
          </Btn>
          <Btn variant="ghost" onClick={() => setPhase("setup")}>
            Terminar partida
          </Btn>
        </div>
      </div>
    );
  }

  return null;
}
