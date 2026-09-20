import { useState, useEffect } from "react";
import clsx from "clsx";
import { T } from "../../theme/styles/classes";
import { Btn } from "../../components/ui/Btn";
import { StartButton } from "../../components/setup/StartButton";
import { LeaveToLobbyButton } from "../../components/game-kit/LeaveToLobbyButton";
import { PhaseTransition } from "../../components/game-kit/PhaseTransition";
import { RevealCountdown, useRevealCountdown } from "../../components/game-kit/RevealCountdown";
import { Timer } from "../../components/game-kit/Timer";
import { ColorPicker, NEUTRAL_HSL, hexFromHsl } from "./components/ColorPicker";
import { ColorCompareRow } from "./components/ColorCompareRow";
import { Leaderboard } from "./components/Leaderboard";
import { TargetSwatch } from "./components/TargetSwatch";
import { type ColorCorrectoPrivateRole, type ColorCorrectoReveal, type ColorCorrectoRoundView } from "@juntada/color-correcto-scoring";
import type { RoundViewProps } from "../gameTypes";

function RoundBadge({ round }: { round: ColorCorrectoRoundView | null }) {
  if (!round || round.playMode !== "rounds") return null;
  return (
    <p className={clsx(T.muted, "text-center mb-2.5")}>
      Ronda {(round.roundsPlayed ?? 0) + 1}/{round.roundLimit}
    </p>
  );
}

// Covers this game's in-progress phases (show/guess/result) inside a
// multiplayer room. Props per the registry contract in games/gameTypes.ts.
export function RoundView({ room, me, myRole, wordReveal, isHost, send }: RoundViewProps) {
  const [guessValue, setGuessValue] = useState(NEUTRAL_HSL);
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const revealCount = useRevealCountdown(room.roundHistory?.length ?? 0);

  const round = room.round as ColorCorrectoRoundView | null;
  const role = myRole as ColorCorrectoPrivateRole | null;
  const reveal = wordReveal as ColorCorrectoReveal | null;

  // A fresh private_role arrives every round — reset the picker. If a
  // refresh/reconnect lands mid-"guess" with a guess already on file
  // server-side (engine.ts's getPrivateView), skip straight to the
  // "submitted" view instead of showing the picker again, since resubmitting
  // would just be rejected — the locked-in swatch reads role.myGuess (hex)
  // directly rather than round-tripping it back through the HSL picker.
  useEffect(() => {
    const myGuess = role?.myGuess;
    setGuessValue(NEUTRAL_HSL);
    setGuessSubmitted(myGuess != null);
  }, [myRole]);

  if (!round) return null;

  if (room.phase === "show") {
    return (
      <PhaseTransition phaseKey="show">
        <div>
          <RoundBadge round={round} />
          <TargetSwatch target={round.target ?? "#808080"} timerEnd={round.showEndsAt ?? null} />
        </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "guess") {
    const offlinePlayers = room.players.filter(p => !p.online);
    const forceFinishBanner = offlinePlayers.length > 0 && (
      <div className={T.warnCard}>
        <p className="m-0 text-[13px] font-bold text-[#E2C44A]">
          Esperando a que se reconecte{offlinePlayers.length === 1 ? "" : "n"}: {offlinePlayers.map(p => p.name).join(", ")}
        </p>
        {isHost && (
          <Btn variant="ghost" onClick={() => send({ type: "force_finish_round" })} className="mt-2.5">
            Terminar la ronda con los intentos ya enviados
          </Btn>
        )}
      </div>
    );

    const submitGuess = () => {
      send({ type: "submit_guess", value: hexFromHsl(guessValue) });
      setGuessSubmitted(true);
    };

    return (
      <PhaseTransition phaseKey="guess">
        <div>
          <RoundBadge round={round} />
          {!guessSubmitted && round.guessEndsAt != null && <Timer timerEnd={round.guessEndsAt} label="Tiempo para adivinar" />}
          <p className={clsx(T.muted, "text-center mb-2.5")}>¿Cuál era el color? Elegí el más parecido.</p>
          {!guessSubmitted ? (
            <>
              <ColorPicker value={guessValue} onChange={setGuessValue} />
              <Btn variant="success" onClick={submitGuess} className="mt-3.5">
                Confirmar
              </Btn>
            </>
          ) : (
            <div className={clsx(T.card, "text-center")}>
              <div className="mb-2.5 w-full aspect-[3/1] rounded-[14px]" style={{ background: role?.myGuess ?? hexFromHsl(guessValue) }} />
              <p className="text-[#5DCAA5]">Elección enviada</p>
              <p className={clsx(T.muted, "mt-1.5")}>
                {round.submittedCount}/{round.guessersOnline} confirmaron
              </p>
            </div>
          )}
          {forceFinishBanner}
        </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "result") {
    const target = reveal?.target ?? round.target ?? "#808080";
    const scores = round.scores || {};
    const guesses = round.guesses || {};
    const myId = me?.playerId;
    const roundScores = Object.values(scores);
    const roundBestScore = roundScores.length > 0 ? Math.max(...roundScores) : -1;
    const gameOver = round.playMode === "rounds" && (round.roundsPlayed ?? 0) >= (round.roundLimit ?? Infinity);

    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando el color..." />;

    const score = room.config.score as Record<string, number>;
    const standings = room.players
      .map(p => ({ id: p.id, name: p.name, score: score?.[p.id] || 0, online: p.online }))
      .sort((a, b) => b.score - a.score);

    return (
      <PhaseTransition phaseKey="result">
        <div>
          <Leaderboard standings={standings} finished={gameOver} />
          <p className={clsx(T.muted, "mx-0 mt-3.5 mb-2.5 text-center")}>Así quedó cada uno</p>
          {room.players.map(p => (
            <ColorCompareRow
              key={p.id}
              name={p.name}
              target={target}
              guess={guesses[p.id]}
              score={scores[p.id]}
              highlight={p.id === myId}
              isRoundWinner={scores[p.id] === roundBestScore}
            />
          ))}
          {isHost &&
            (gameOver ? (
              <StartButton onClick={() => send({ type: "new_game" })}>Nueva partida</StartButton>
            ) : (
              <StartButton onClick={() => send({ type: "start_round" })}>Nueva ronda</StartButton>
            ))}
          <LeaveToLobbyButton groupCode={room.groupCode} send={send} />
          {!isHost && (
            <div className={clsx(T.card, "mt-3.5 text-center")}>
              <p className="m-0 text-sm text-[#9089c0]">Esperando que el anfitrión inicie otra ronda</p>
            </div>
          )}
        </div>
      </PhaseTransition>
    );
  }

  return null;
}
