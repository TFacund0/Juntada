import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BigTextFlash } from "../../components/game-kit/BigTextFlash";
import { type Tool } from "./components/Canvas";
import { DEFAULT_TOOL } from "./utils/palette";
import { ChoosingPhaseScreen } from "./components/ChoosingPhaseScreen";
import { DrawingPhaseScreen } from "./components/DrawingPhaseScreen";
import { RevealPhaseScreen } from "./components/RevealPhaseScreen";
import { ResultPhaseScreen } from "./components/ResultPhaseScreen";
import { ScreenSwap } from "./components/ScreenSwap";
import { useRayadoSfx } from "./hooks/useRayadoSfx";
import { useTurnEndSound } from "./hooks/useTurnEndSound";
import { useMyGuessCelebration, type LastGuess } from "./hooks/useMyGuessCelebration";
import type { RoundViewProps } from "../gameTypes";
import type { PrivateChatView, RayadoLibreRoundState } from "./types/roundView";

const NO_IDS: readonly number[] = [];

// Owns the state and effects shared across phases (drawing tool, the guess
// input, whether my own word is hidden, the game's sound — mounted here so
// any tap in any phase unlocks audio) and picks which phase screen to
// render, swapping them with ScreenSwap — the phase screens themselves (see
// components/*PhaseScreen.tsx) are pure presentation, same split as
// impostor's RoundView.
export function RoundView({ room, me, myPlayer, myRole, isHost, send, justEnteredRound }: RoundViewProps) {
  const round = room.round as RayadoLibreRoundState | null;
  const [tool, setTool] = useState<Tool>(DEFAULT_TOOL);
  const [guessText, setGuessText] = useState("");
  const [wordVisible, setWordVisible] = useState(true);
  const sfx = useRayadoSfx();

  const isDrawer = !!myRole?.isDrawer;
  const wordChoices = (myRole?.wordChoices as string[] | null) ?? null;
  const myWord = myRole?.word as string | undefined;
  const closeEntryIds = (myRole?.closeEntryIds as number[] | undefined) ?? NO_IDS;
  const guessedWord = myRole?.guessedWord as string | undefined;
  const privateChat = useMemo<PrivateChatView>(() => ({ closeEntryIds, guessedWord }), [closeEntryIds, guessedWord]);

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

  useTurnEndSound(room.phase, sfx);
  useMyGuessCelebration(myRole?.lastGuess as LastGuess | undefined, sfx);

  if (!round) return null;
  const drawerPlayer = room.players.find(p => p.id === round.drawerId);
  // A disconnected drawer doesn't skip their turn (see skipTurnIfDrawerGone
  // in the engine — only actually leaving the room does that); the turn
  // just runs out its normal timer with nothing happening on the board.
  // Surfacing this explicitly saves everyone else from wondering why.
  const drawerOffline = !isDrawer && !!drawerPlayer && !drawerPlayer.online;

  const { key: screenKey, node: screen } = phaseScreen();
  return <ScreenSwap screenKey={screenKey}>{screen}</ScreenSwap>;

  function phaseScreen(): { key: string; node: ReactNode } {
    if (!round) return { key: "none", node: null };
    if (room.phase === "choosing") {
      if (turnFlashName) {
        return {
          key: "turn-flash",
          node: <BigTextFlash eyebrow={`Turno ${round.turnNumber}`} text={`Le toca dibujar a ${turnFlashName}`} />,
        };
      }
      return {
        key: "choosing",
        node: (
          <ChoosingPhaseScreen
            round={round}
            isDrawer={isDrawer}
            wordChoices={wordChoices}
            drawerPlayer={drawerPlayer}
            drawerOffline={drawerOffline}
            sfx={sfx}
            send={send}
          />
        ),
      };
    }
    if (room.phase === "drawing") {
      return {
        key: "drawing",
        node: (
          <DrawingPhaseScreen
            room={room}
            round={round}
            me={me}
            isDrawer={isDrawer}
            myWord={myWord}
            privateChat={privateChat}
            drawerPlayer={drawerPlayer}
            drawerOffline={drawerOffline}
            tool={tool}
            setTool={setTool}
            guessText={guessText}
            setGuessText={setGuessText}
            wordVisible={wordVisible}
            setWordVisible={setWordVisible}
            sfx={sfx}
            send={send}
          />
        ),
      };
    }
    if (room.phase === "reveal") {
      return {
        key: "reveal",
        node: (
          <RevealPhaseScreen room={room} round={round} me={me} myPlayer={myPlayer} closeEntryIds={closeEntryIds} sfx={sfx} send={send} />
        ),
      };
    }
    if (room.phase === "result")
      return { key: "result", node: <ResultPhaseScreen room={room} me={me} isHost={isHost} sfx={sfx} send={send} /> };
    return { key: "none", node: null };
  }
}
