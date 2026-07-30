import { useEffect, useRef, useState } from "react";
import { RevealCountdown, useRevealCountdown } from "../../components/RevealCountdown";
import { type Tool } from "./components/Canvas";
import { ChoosingPhaseScreen } from "./components/ChoosingPhaseScreen";
import { DrawingPhaseScreen } from "./components/DrawingPhaseScreen";
import { RevealPhaseScreen } from "./components/RevealPhaseScreen";
import { ResultPhaseScreen } from "./components/ResultPhaseScreen";
import type { RoundViewProps } from "../gameTypes";
import type { RayadoLibreRoundState } from "./types/roundView";

// Owns the state and effects shared across phases (drawing tool, the guess
// input, the "+N puntos" toast, whether my own word is hidden) and picks
// which phase screen to render — the phase screens themselves (see
// components/*PhaseScreen.tsx) are pure presentation, same split as
// impostor's RoundView.
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
    return <RevealPhaseScreen room={room} round={round} me={me} myPlayer={myPlayer} send={send} />;
  }

  if (room.phase === "result") {
    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando la tabla final..." />;
    return <ResultPhaseScreen room={room} me={me} isHost={isHost} send={send} />;
  }

  return null;
}
