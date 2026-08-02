import { useEffect, useRef, useState } from "react";
import { RevealCountdown, useRevealCountdown } from "../../components/game-kit/RevealCountdown";
import type { SetupTab } from "../../components/setup/SetupTabs";
import { useFlashError } from "../../hooks/useFlashError";
import { shuffle } from "@juntada/core-utils";
import { nextPlayerName } from "../../utils/nextPlayerName";
import { CATEGORIES, activeWordPool, pickThreeWords as pickThreeWordsFromPool } from "@juntada/rayado-libre-data";
import { scoreForGuess, DRAWER_POINTS_PER_GUESS, TURN_SECONDS, buildHintOrder, computeWordHint } from "@juntada/rayado-libre-scoring";
import { type DrawAction, type Tool } from "./components/Canvas";
import type { LocalPlayer, LocalGamePhase } from "./types/localGame";
import { SetupScreen } from "./components/SetupScreen";
import { WordRevealScreen } from "./components/WordRevealScreen";
import { LocalDrawingScreen } from "./components/LocalDrawingScreen";
import { LocalRevealScreen } from "./components/LocalRevealScreen";
import { LocalResultScreen } from "./components/LocalResultScreen";

// ═══════════════════════════════════════════════════════════════════════════════
// RAYADO LIBRE — modo local: pantalla compartida + juez manual. Un solo
// dispositivo (tablet/notebook) queda con el tablero a la vista de todos.
// Quien dibuja lo hace directo en pantalla; el resto grita la respuesta en
// voz alta y quien maneja el dispositivo toca el nombre de quien acertó — el
// puntaje se calcula solo, con la misma fórmula que el modo online.
//
// Este archivo solo maneja estado/reglas de turno; la presentación de cada
// fase vive en su propio componente bajo components/ (SetupScreen,
// WordRevealScreen, LocalDrawingScreen, LocalRevealScreen,
// LocalResultScreen) — mismo criterio que el modo online (ver RoundView.tsx
// y components/*PhaseScreen.tsx).
// ═══════════════════════════════════════════════════════════════════════════════

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
  const [phase, setPhase] = useState<LocalGamePhase>("setup");
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

  if (phase === "setup") {
    return (
      <SetupScreen
        players={players}
        renamePlayer={renamePlayer}
        removePlayer={id => setPlayers(prev => prev.filter(x => x.id !== id))}
        newName={newName}
        setNewName={setNewName}
        addPlayer={addPlayer}
        nameError={nameError}
        nameErrorKey={nameErrorKey}
        setupTab={setupTab}
        setSetupTab={setSetupTab}
        enabledCategories={enabledCategories}
        setEnabledCategories={setEnabledCategories}
        totalRounds={totalRounds}
        setTotalRounds={setTotalRounds}
        activeCatKeys={activeCatKeys}
        startGame={startGame}
      />
    );
  }

  if (phase === "wordReveal") {
    return (
      <WordRevealScreen
        turnNumber={turnNumber}
        totalTurns={totalTurns}
        drawer={drawer}
        choicesRevealed={choicesRevealed}
        revealChoices={() => setChoicesRevealed(true)}
        wordChoices={wordChoices}
        chooseWord={chooseWord}
      />
    );
  }

  if (phase === "drawing") {
    const wordHint = word && drawingStartedAt ? computeWordHint(word, hintOrderRef.current, (Date.now() - drawingStartedAt) / 1000) : null;
    return (
      <LocalDrawingScreen
        turnNumber={turnNumber}
        totalTurns={totalTurns}
        drawer={drawer}
        timerEnd={timerEnd}
        wordHint={wordHint}
        strokes={strokes}
        setStrokes={setStrokes}
        tool={tool}
        setTool={setTool}
        players={players}
        drawerId={drawerId}
        correctGuessers={correctGuessers}
        lastTurnPoints={lastTurnPoints}
        markCorrect={markCorrect}
      />
    );
  }

  if (phase === "reveal") {
    const roundPoints: Record<number, number> = { ...lastTurnPoints };
    if (drawerId != null && Object.keys(lastTurnPoints).length > 0) {
      roundPoints[drawerId] = Object.keys(lastTurnPoints).length * DRAWER_POINTS_PER_GUESS;
    }
    return (
      <LocalRevealScreen
        word={word}
        players={players}
        scores={scores}
        roundPoints={roundPoints}
        isLastTurn={turnNumber === totalTurns}
        goToNextTurn={goToNextTurn}
      />
    );
  }

  // ── RESULT ──
  if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando la tabla final..." />;
  return <LocalResultScreen players={players} scores={scores} backToSetup={backToSetup} />;
}
