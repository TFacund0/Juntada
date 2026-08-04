import { useEffect, useRef, useState } from "react";
import { useRevealCountdown } from "../../components/game-kit/RevealCountdown";
import { BigTextFlash } from "../../components/game-kit/BigTextFlash";
import { type Tool } from "./components/Canvas";
import { ChoosingPhaseScreen } from "./components/ChoosingPhaseScreen";
import { DrawingPhaseScreen } from "./components/DrawingPhaseScreen";
import { RevealPhaseScreen } from "./components/RevealPhaseScreen";
import { ResultPhaseScreen } from "./components/ResultPhaseScreen";
import { InkSweepReveal } from "./components/InkSweepReveal";
import { WordRevealSweep } from "./components/WordRevealSweep";
import type { RoundViewProps } from "../gameTypes";
import type { RayadoLibreRoundState } from "./types/roundView";

// Owns the state and effects shared across phases (drawing tool, the guess
// input, the "+N puntos" toast, whether my own word is hidden) and picks
// which phase screen to render — the phase screens themselves (see
// components/*PhaseScreen.tsx) are pure presentation, same split as
// impostor's RoundView.
export function RoundView({ room, me, myPlayer, myRole, isHost, send, justEnteredRound }: RoundViewProps) {
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

  // Anuncia el cambio de dibujante con un flash de pantalla completa en vez
  // de dejar que "fulano está eligiendo..." aparezca sin aviso — incluyendo
  // el turno 1, para que el primer "choosing" también se sienta como una
  // transición desde el lobby y no un salto directo. El sentinel "" (en vez
  // de null) cuando justEnteredRound es true logra justamente eso: nunca va
  // a matchear un drawerId real, así que el turno 1 también dispara el
  // flash. Sin justEnteredRound (reconectar a una partida ya en curso), el
  // ref arranca en null y el guard de abajo evita disparar en ese primer
  // render — mismo patrón que impostor/RoundView.tsx con prevRoomPhase.
  const prevDrawerId = useRef<string | null>(justEnteredRound ? "" : null);
  const [turnFlashName, setTurnFlashName] = useState<string | null>(null);
  useEffect(() => {
    if (room.phase !== "choosing" || !round?.drawerId) return;
    if (prevDrawerId.current !== null && round.drawerId !== prevDrawerId.current) {
      const name = room.players.find(p => p.id === round.drawerId)?.name ?? "";
      setTurnFlashName(name);
      const t = setTimeout(() => setTurnFlashName(null), 1500);
      prevDrawerId.current = round.drawerId;
      return () => clearTimeout(t);
    }
    prevDrawerId.current = round.drawerId;
  }, [room.phase, round?.drawerId, room.players]);

  // A short color-sweep beat when entering "reveal" straight from "drawing",
  // so the jump from the live board to the word+scoreboard doesn't feel
  // instant — same ref+timeout pattern as turnFlashName above, but keyed off
  // the phase transition itself rather than drawerId.
  const prevPhase = useRef<string | null>(null);
  const [wordSweepVisible, setWordSweepVisible] = useState(false);
  useEffect(() => {
    if (room.phase === "reveal" && prevPhase.current === "drawing") {
      setWordSweepVisible(true);
      const t = setTimeout(() => setWordSweepVisible(false), 700);
      prevPhase.current = room.phase;
      return () => clearTimeout(t);
    }
    prevPhase.current = room.phase;
  }, [room.phase]);

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
    if (turnFlashName) {
      return <BigTextFlash eyebrow={`Turno ${round.turnNumber}`} text={`Le toca dibujar a ${turnFlashName}`} />;
    }
    return (
      <ChoosingPhaseScreen
        round={round}
        isDrawer={isDrawer}
        wordChoices={wordChoices}
        drawerPlayer={drawerPlayer}
        drawerOffline={drawerOffline}
        send={send}
      />
    );
  }

  if (room.phase === "drawing") {
    return (
      <DrawingPhaseScreen
        room={room}
        round={round}
        me={me}
        isDrawer={isDrawer}
        myWord={myWord}
        drawerPlayer={drawerPlayer}
        drawerOffline={drawerOffline}
        tool={tool}
        setTool={setTool}
        guessText={guessText}
        setGuessText={setGuessText}
        pointsToast={pointsToast}
        wordVisible={wordVisible}
        setWordVisible={setWordVisible}
        send={send}
      />
    );
  }

  if (room.phase === "reveal") {
    if (wordSweepVisible) return <WordRevealSweep word={round.word ?? ""} />;
    return <RevealPhaseScreen room={room} round={round} me={me} myPlayer={myPlayer} send={send} />;
  }

  if (room.phase === "result") {
    if (revealCount > 0) return <InkSweepReveal count={revealCount} label="Revelando la tabla final..." />;
    return <ResultPhaseScreen room={room} me={me} isHost={isHost} send={send} />;
  }

  return null;
}
