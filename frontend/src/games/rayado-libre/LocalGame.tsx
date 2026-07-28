import { useEffect, useRef, useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { Avatar } from "../../components/Avatar";
import { Timer } from "../../components/Timer";
import { RevealCountdown, useRevealCountdown } from "../../components/RevealCountdown";
import { ErrorBanner } from "../../components/ErrorBanner";
import { SetupTabs, type SetupTab } from "../../components/SetupTabs";
import { StickyActionBar } from "../../components/StickyActionBar";
import { MinPlayersHint } from "../../components/MinPlayersHint";
import { useFlashError } from "../../hooks/useFlashError";
import { shuffle } from "@juntada/core-utils";
import { nextPlayerName } from "../../utils/playerNames";
import { CATEGORIES, activeWordPool, pickThreeWords as pickThreeWordsFromPool } from "@juntada/rayado-libre-data";
import {
  scoreForGuess,
  DRAWER_POINTS_PER_GUESS,
  TURN_SECONDS,
  buildHintOrder,
  computeWordHint,
  popLastDrawUnit,
} from "@juntada/rayado-libre-scoring";
import { Canvas, type DrawAction, type Tool } from "./components/Canvas";
import { Toolbar } from "./components/Toolbar";
import { PhaseTransition } from "../../components/PhaseTransition";
import { Scoreboard } from "./components/Scoreboard";

// ═══════════════════════════════════════════════════════════════════════════════
// RAYADO LIBRE — modo local: pantalla compartida + juez manual. Un solo
// dispositivo (tablet/notebook) queda con el tablero a la vista de todos.
// Quien dibuja lo hace directo en pantalla; el resto grita la respuesta en
// voz alta y quien maneja el dispositivo toca el nombre de quien acertó — el
// puntaje se calcula solo, con la misma fórmula que el modo online.
// ═══════════════════════════════════════════════════════════════════════════════

interface LocalPlayer {
  id: number;
  name: string;
}

type Phase = "setup" | "wordReveal" | "drawing" | "reveal" | "result";

const MIN_PLAYERS = 3;

// Same pool/pick algorithm the backend engine uses (see
// @juntada/rayado-libre-data) — this just adapts it to LocalGame's plain
// ref-array bookkeeping instead of room.usedWords, so the two can't drift.
function pickThreeWords(activeCatKeys: string[], usedWordsRef: { current: string[] }): string[] {
  const pool = activeWordPool(CATEGORIES, activeCatKeys);
  const { words, resetUsed } = pickThreeWordsFromPool(pool, usedWordsRef.current);
  if (resetUsed) usedWordsRef.current = [];
  return words;
}

export function LocalGame() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [players, setPlayers] = useState<LocalPlayer[]>([
    { id: 1, name: "Jugador 1" },
    { id: 2, name: "Jugador 2" },
    { id: 3, name: "Jugador 3" },
  ]);
  const [newName, setNewName] = useState("");
  const [nameError, nameErrorKey, setNameError] = useFlashError();
  const [setupTab, setSetupTab] = useState<SetupTab>("players");
  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>(
    Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {} as Record<string, boolean>),
  );
  const [totalRounds, setTotalRounds] = useState(3);

  const [turnQueue, setTurnQueue] = useState<number[]>([]);
  const [totalTurns, setTotalTurns] = useState(0);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [word, setWord] = useState<string | null>(null);
  const [choicesRevealed, setChoicesRevealed] = useState(false);
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [correctGuessers, setCorrectGuessers] = useState<number[]>([]);
  const [lastTurnPoints, setLastTurnPoints] = useState<Record<number, number>>({});
  const [strokes, setStrokes] = useState<DrawAction[]>([]);
  const [tool, setTool] = useState<Tool>({ mode: "draw", color: "#1a1a1a", size: 10 });
  const [drawingStartedAt, setDrawingStartedAt] = useState<number | null>(null);
  const hintOrderRef = useRef<number[]>([]);
  // Forces a re-render every 300ms while drawing so the progressive hint
  // (computed from elapsed time, see computeWordHint) actually updates on
  // screen instead of only ever reflecting whatever it was on the last state
  // change — same tick already used to check the drawing timer, just also
  // bumping this.
  const [, forceTick] = useState(0);
  const usedWordsRef = useRef<string[]>([]);

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
    const trimmed = newName.trim() || nextPlayerName(players.map(p => p.name));
    if (isDuplicateName(trimmed, null)) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    setPlayers(p => [...p, { id: Date.now(), name: trimmed }]);
    setNewName("");
  };

  const activeCatKeys = Object.keys(enabledCategories).filter(k => enabledCategories[k]);

  const startTurn = (id: number) => {
    const choices = pickThreeWords(activeCatKeys, usedWordsRef);
    setDrawerId(id);
    setWordChoices(choices);
    setWord(null);
    setChoicesRevealed(false);
    setStrokes([]);
    setCorrectGuessers([]);
    setTimerEnd(null);
    setLastTurnPoints({});
    setPhase("wordReveal");
  };

  const startGame = () => {
    const order = shuffle(players.map(p => p.id));
    const queue: number[] = [];
    for (let i = 0; i < totalRounds; i++) queue.push(...order);
    setTurnQueue(queue);
    setTotalTurns(queue.length);
    setScores({});
    usedWordsRef.current = [];
    startTurn(queue[0]);
  };

  const chooseWord = (w: string) => {
    usedWordsRef.current = [...usedWordsRef.current, w];
    setWord(w);
    setStrokes([]);
    setTimerEnd(Date.now() + TURN_SECONDS * 1000);
    setDrawingStartedAt(Date.now());
    hintOrderRef.current = buildHintOrder(w);
    setPhase("drawing");
  };

  const finishTurn = () => {
    setPhase("reveal");
  };

  const goToNextTurn = () => {
    const remaining = turnQueue.slice(1);
    setTurnQueue(remaining);
    if (remaining.length === 0) {
      setPhase("result");
      return;
    }
    startTurn(remaining[0]);
  };

  // Auto-ends the turn once the (possibly jumped-down) timer runs out —
  // mirrors the online engine's forceReadyAndAdvance.
  useEffect(() => {
    if (phase !== "drawing" || !timerEnd) return;
    const id = setInterval(() => {
      if (Date.now() >= timerEnd) finishTurn();
      else forceTick(t => t + 1); // keeps the progressive hint below up to date
    }, 300);
    return () => clearInterval(id);
  }, [phase, timerEnd]);

  const markCorrect = (playerId: number) => {
    if (phase !== "drawing" || playerId === drawerId || correctGuessers.includes(playerId) || !timerEnd) return;
    // Math.floor to match the backend engine exactly (see its own comment) —
    // rounding up would always nudge a guess right at a zone boundary into
    // the more generous zone.
    const secondsRemaining = Math.max(0, Math.floor((timerEnd - Date.now()) / 1000));
    const { points, jumpToSeconds } = scoreForGuess(secondsRemaining);
    setScores(s => ({
      ...s,
      [playerId]: (s[playerId] || 0) + points,
      [drawerId as number]: (s[drawerId as number] || 0) + DRAWER_POINTS_PER_GUESS,
    }));
    setLastTurnPoints(p => ({ ...p, [playerId]: points }));
    const nextGuessers = [...correctGuessers, playerId];
    setCorrectGuessers(nextGuessers);
    if (jumpToSeconds != null) setTimerEnd(Date.now() + jumpToSeconds * 1000);

    const others = players.filter(p => p.id !== drawerId);
    if (others.every(p => nextGuessers.includes(p.id))) finishTurn();
  };

  const backToSetup = () => {
    setPhase("setup");
    setTurnQueue([]);
    setDrawerId(null);
    setScores({});
  };

  const drawer = players.find(p => p.id === drawerId);
  const turnNumber = totalTurns - turnQueue.length + 1;

  // Brief "revelando..." beat before the final scoreboard — same pattern as
  // the online mode. This game only ever reaches "result" once per game (no
  // repeated rounds), so a stable 0/1 key is enough to trigger it exactly once.
  const revealCount = useRevealCountdown(phase === "result" ? 1 : 0);

  // ── SETUP ──
  if (phase === "setup")
    return (
      <PhaseTransition phaseKey="setup">
        <div style={{ paddingBottom: 88 }}>
          <SetupTabs tab={setupTab} onChange={setSetupTab} />

          {setupTab === "players" && (
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
              <ErrorBanner message={nameError} flashKey={nameErrorKey} variant="inline" />
            </div>
          )}

          {setupTab === "config" && (
            <>
              <div style={S.card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={S.label}>Categorías</span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => setEnabledCategories(Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}))}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#7F77DD",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: "inherit",
                      }}
                    >
                      Todas
                    </button>
                    <button
                      onClick={() => setEnabledCategories(Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {}))}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#7F77DD",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: "inherit",
                      }}
                    >
                      Ninguna
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                  {Object.entries(CATEGORIES).map(([k, cat]) => {
                    const active = !!enabledCategories[k];
                    return (
                      <button
                        key={k}
                        onClick={() => setEnabledCategories(prev => ({ ...prev, [k]: !active }))}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "10px 16px",
                          borderRadius: 999,
                          border: active ? "1px solid rgba(127,119,221,0.6)" : "1px solid rgba(255,255,255,0.12)",
                          background: active ? "linear-gradient(135deg,#7F77DD,#534AB7)" : "rgba(255,255,255,0.04)",
                          color: active ? "#fff" : "#9089c0",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={S.card}>
                <span style={S.label}>
                  Vueltas: cada jugador dibuja {totalRounds} {totalRounds === 1 ? "vez" : "veces"}
                </span>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setTotalRounds(n)}
                      style={{ ...S.btn(totalRounds === n ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <StickyActionBar>
            <StartButton disabled={players.length < MIN_PLAYERS || activeCatKeys.length === 0} onClick={startGame}>
              Empezar a jugar
            </StartButton>
            <MinPlayersHint count={players.length} min={MIN_PLAYERS} />
            {activeCatKeys.length === 0 && <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Elegí al menos una categoría</p>}
          </StickyActionBar>
        </div>
      </PhaseTransition>
    );

  // ── ELEGIR PALABRA (el dispositivo recién pasó de mano) ──
  if (phase === "wordReveal")
    return (
      <PhaseTransition phaseKey="wordReveal">
        <div>
          <div style={{ ...S.cardHighlight, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#9089c0" }}>
              Turno {turnNumber}/{totalTurns}
            </p>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#AFA9EC", margin: "6px 0" }}>Le toca dibujar a {drawer?.name}</p>
            <p style={{ fontSize: 13, color: "#9089c0" }}>Pasale el dispositivo — el resto no tiene que ver la pantalla todavía</p>
          </div>

          {!choicesRevealed ? (
            <Btn variant="primary" onClick={() => setChoicesRevealed(true)}>
              Ya tengo el dispositivo — ver mis palabras
            </Btn>
          ) : (
            <div style={S.card}>
              <span style={S.label}>Elegí qué vas a dibujar</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                {wordChoices.map(w => (
                  <Btn key={w} variant="success" onClick={() => chooseWord(w)}>
                    {w}
                  </Btn>
                ))}
              </div>
            </div>
          )}
        </div>
      </PhaseTransition>
    );

  // ── DIBUJANDO ──
  if (phase === "drawing")
    return (
      <PhaseTransition phaseKey="drawing">
        <div>
          <p style={{ textAlign: "center", fontSize: 13, color: "#9089c0", marginBottom: 4 }}>
            Turno {turnNumber}/{totalTurns} — dibuja {drawer?.name}
          </p>
          {timerEnd && <Timer timerEnd={timerEnd} total={TURN_SECONDS} label="Tiempo para dibujar" />}

          {word && drawingStartedAt && (
            <div style={{ ...S.cardHighlight, textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.35em", margin: 0, fontFamily: "monospace" }}>
                {computeWordHint(word, hintOrderRef.current, (Date.now() - drawingStartedAt) / 1000)}
              </p>
            </div>
          )}

          <Canvas
            strokes={strokes}
            interactive
            tool={tool}
            onStrokeChunk={(points, color, size, strokeId) => setStrokes(s => [...s, { type: "stroke", points, color, size, strokeId }])}
            onFillAt={(x, y, color) => setStrokes(s => [...s, { type: "fill", x, y, color }])}
          />
          <Toolbar tool={tool} onChange={setTool} onClear={() => setStrokes([])} onUndo={() => setStrokes(s => popLastDrawUnit(s))} />

          <div style={{ ...S.card, marginTop: 16 }}>
            <span style={S.label}>¿Quién acertó?</span>
            <p style={{ ...S.muted, margin: "0 0 10px" }}>Tocá el nombre de quien haya adivinado en voz alta.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {players
                .filter(p => p.id !== drawerId)
                .map(p => {
                  const already = correctGuessers.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      disabled={already}
                      onClick={() => markCorrect(p.id)}
                      style={{
                        ...S.btn(already ? "ghost" : "success"),
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 14px",
                        opacity: already ? 0.6 : 1,
                      }}
                    >
                      <Avatar name={p.name} size={28} />
                      <span style={{ flex: 1, textAlign: "left", fontWeight: 700 }}>{p.name}</span>
                      {already && <span style={{ fontSize: 13 }}>+{lastTurnPoints[p.id]} pts ✓</span>}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </PhaseTransition>
    );

  // ── REVEAL ──
  if (phase === "reveal") {
    const roundPoints: Record<number, number> = { ...lastTurnPoints };
    if (drawerId != null && Object.keys(lastTurnPoints).length > 0) {
      roundPoints[drawerId] = Object.keys(lastTurnPoints).length * DRAWER_POINTS_PER_GUESS;
    }
    const isLastTurn = turnNumber === totalTurns;

    return (
      <PhaseTransition phaseKey="reveal">
        <div>
          <div style={{ ...S.cardHighlight, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#9089c0" }}>La palabra era</p>
            <p style={S.bigReveal}>{word}</p>
          </div>

          <Scoreboard
            entries={players.map(p => ({ id: p.id, name: p.name, score: scores[p.id] || 0, roundPoints: roundPoints[p.id] }))}
            title={isLastTurn ? "Tabla final" : "Tabla de puntos"}
          />

          <StartButton onClick={goToNextTurn}>{isLastTurn ? "Ver la tabla final" : "Siguiente turno"}</StartButton>
        </div>
      </PhaseTransition>
    );
  }

  // ── RESULT ──
  if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando la tabla final..." />;
  return (
    <PhaseTransition phaseKey="result">
      <p style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#AFA9EC", margin: "8px 0 16px" }}>Fin del juego</p>
      <Scoreboard entries={players.map(p => ({ id: p.id, name: p.name, score: scores[p.id] || 0 }))} title="Tabla final" />
      {/* Sends everyone back to the players/config screen instead of
          restarting instantly — lets the group adjust players or settings
          before the next match, same as the online mode's "Nueva partida". */}
      <StartButton onClick={backToSetup}>Jugar de nuevo</StartButton>
    </PhaseTransition>
  );
}
