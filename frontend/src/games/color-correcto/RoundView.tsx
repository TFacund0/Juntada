import { useState, useEffect } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { LeaveToLobbyButton } from "../../components/LeaveToLobbyButton";
import { PhaseTransition } from "../../components/PhaseTransition";
import { RevealCountdown, useRevealCountdown } from "../../components/RevealCountdown";
import { Timer } from "../../components/Timer";
import { ColorPicker, NEUTRAL_HSL, hexFromHsl } from "./components/ColorPicker";
import { ColorCompareRow } from "./components/ColorCompareRow";
import { Leaderboard } from "./components/Leaderboard";
import { TargetSwatch } from "./components/TargetSwatch";
import { type ColorCorrectoPrivateRole, type ColorCorrectoReveal, type ColorCorrectoRoundView } from "@juntada/color-correcto-scoring";
import type { RoundViewProps } from "../gameTypes";

function RoundBadge({ round }: { round: ColorCorrectoRoundView | null }) {
  if (!round || round.playMode !== "rounds") return null;
  return (
    <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>
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
      <div style={{ ...S.card, textAlign: "center", border: "1px solid rgba(226,196,74,0.35)", background: "rgba(226,196,74,0.08)" }}>
        <p style={{ fontSize: 13, color: "#E2C44A", fontWeight: 700, margin: 0 }}>
          Esperando a que se reconecte{offlinePlayers.length === 1 ? "" : "n"}: {offlinePlayers.map(p => p.name).join(", ")}
        </p>
        {isHost && (
          <Btn variant="ghost" onClick={() => send({ type: "force_finish_round" })} style={{ marginTop: 10 }}>
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
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>¿Cuál era el color? Elegí el más parecido.</p>
          {!guessSubmitted ? (
            <>
              <ColorPicker value={guessValue} onChange={setGuessValue} />
              <Btn variant="success" onClick={submitGuess} style={{ marginTop: 14 }}>
                Confirmar
              </Btn>
            </>
          ) : (
            <div style={{ ...S.card, textAlign: "center" }}>
              <div
                style={{
                  width: "100%",
                  aspectRatio: "3 / 1",
                  borderRadius: 14,
                  background: role?.myGuess ?? hexFromHsl(guessValue),
                  marginBottom: 10,
                }}
              />
              <p style={{ color: "#5DCAA5" }}>Elección enviada</p>
              <p style={{ ...S.muted, marginTop: 6 }}>
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
          <p style={{ ...S.muted, textAlign: "center", margin: "14px 0 10px" }}>Así quedó cada uno</p>
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
            <div style={{ ...S.card, marginTop: 14, textAlign: "center" }}>
              <p style={{ color: "#9089c0", fontSize: 14, margin: 0 }}>Esperando que el anfitrión inicie otra ronda</p>
            </div>
          )}
        </div>
      </PhaseTransition>
    );
  }

  return null;
}
