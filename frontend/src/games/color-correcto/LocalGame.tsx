import { useEffect, useRef, useState } from "react";
import { S } from "../../theme/styles";
import { StartButton } from "../../components/StartButton";
import { ConfirmBackButton } from "../../components/ConfirmBackButton";
import { Timer } from "../../components/Timer";
import { RevealCountdown, useRevealCountdown } from "../../components/RevealCountdown";
import { SetupTabs, type SetupTab } from "../../components/SetupTabs";
import { StickyActionBar } from "../../components/StickyActionBar";
import { randomTargetColor, scoreGuess, SHOW_SECONDS } from "@juntada/color-correcto-scoring";
import { ColorPicker, NEUTRAL_HSL, hexFromHsl } from "./components/ColorPicker";
import { ColorCompareRow } from "./components/ColorCompareRow";
import { PlayersConfig } from "./components/PlayersConfig";
import { GuessTimerConfig } from "./components/GuessTimerConfig";
import { Leaderboard } from "./components/Leaderboard";
import { TargetSwatch } from "./components/TargetSwatch";

// ═══════════════════════════════════════════════════════════════════════════════
// ENCUENTRA EL COLOR CORRECTO — un solo dispositivo, pasándoselo por turnos.
// Cada ronda tiene un único color objetivo: a cada jugador, en su turno, se
// le muestra ese mismo color, desaparece, y elige el más parecido posible.
// Recién cuando todos jugaron esa ronda se revelan los puntajes de todos
// juntos — así nadie ve el intento del anterior antes de jugar el propio.
// ═══════════════════════════════════════════════════════════════════════════════

const SHOW_DURATION_MS = SHOW_SECONDS * 1000;
const ROUND_OPTIONS = [3, 5, 7];

type Phase = "setup" | "handoff" | "show" | "guess" | "roundResult" | "final";

export function LocalGame() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [setupTab, setSetupTab] = useState<SetupTab>("players");
  const [names, setNames] = useState(["Jugador 1"]);
  const [rounds, setRounds] = useState(5);
  const [guessSeconds, setGuessSeconds] = useState(0);

  const [roundNumber, setRoundNumber] = useState(1);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [target, setTarget] = useState("#808080");
  const [guess, setGuess] = useState(NEUTRAL_HSL);
  const [roundGuesses, setRoundGuesses] = useState<string[]>([]);
  const [totals, setTotals] = useState<number[][]>([]);
  const [showEndsAt, setShowEndsAt] = useState(0);
  const [guessEndsAt, setGuessEndsAt] = useState(0);
  // Bumped right when the last player of a round confirms their guess —
  // feeds useRevealCountdown below so a short "Revelando resultados..." beat
  // plays before the round's comparison rows show up, instead of dumping
  // them the instant the last guess comes in. Same suspense beat the online
  // RoundView already gets from its own roundHistory-driven countdown.
  const [revealNonce, setRevealNonce] = useState(0);
  const revealCount = useRevealCountdown(revealNonce, 2);

  useEffect(() => {
    if (phase !== "show") return;
    const id = setTimeout(() => setPhase("guess"), SHOW_DURATION_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // Always points at the latest confirmGuess (fresh guess/playerIndex
  // closed over) so the countdown below can call it via a stable
  // ref instead of re-arming itself — and therefore restarting the timer —
  // every time the player nudges a slider.
  const confirmGuessRef = useRef<() => void>(() => {});

  // Entering "guess" with a configured limit starts its own countdown that
  // auto-confirms whatever's selected — cleared as soon as the phase moves
  // on for any reason (manual "Confirmar" included), so it can never fire twice.
  useEffect(() => {
    if (phase !== "guess" || guessSeconds <= 0) {
      setGuessEndsAt(0);
      return;
    }
    setGuessEndsAt(Date.now() + guessSeconds * 1000);
    const id = setTimeout(() => confirmGuessRef.current(), guessSeconds * 1000);
    return () => clearTimeout(id);
  }, [phase, guessSeconds]);

  const startNewRound = (r: number) => {
    setRoundNumber(r);
    setPlayerIndex(0);
    setTarget(randomTargetColor());
    setGuess(NEUTRAL_HSL);
    setRoundGuesses([]);
    setShowEndsAt(Date.now() + SHOW_DURATION_MS);
    setPhase("handoff");
  };

  const startGame = () => {
    setTotals(names.map(() => []));
    startNewRound(1);
  };

  const beginTurn = () => {
    setShowEndsAt(Date.now() + SHOW_DURATION_MS);
    setPhase("show");
  };

  const confirmGuess = () => {
    setRoundGuesses(g => {
      const next = [...g];
      next[playerIndex] = hexFromHsl(guess);
      return next;
    });
    if (playerIndex + 1 < names.length) {
      setPlayerIndex(playerIndex + 1);
      setGuess(NEUTRAL_HSL);
      setPhase("handoff");
    } else {
      setRevealNonce(n => n + 1);
      setPhase("roundResult");
    }
  };
  confirmGuessRef.current = confirmGuess;

  const roundScores = roundGuesses.map(g => scoreGuess(target, g));

  const applyRoundScores = () => {
    setTotals(t => t.map((row, i) => [...row, roundScores[i]]));
  };

  const nextAfterRoundResult = () => {
    applyRoundScores();
    if (roundNumber >= rounds) {
      setPhase("final");
    } else {
      startNewRound(roundNumber + 1);
    }
  };

  const playAgain = () => {
    setTotals(names.map(() => []));
    startNewRound(1);
  };

  if (phase === "setup")
    return (
      <div style={{ paddingBottom: 88 }}>
        <SetupTabs tab={setupTab} onChange={setSetupTab} />

        {setupTab === "players" && <PlayersConfig names={names} onChange={setNames} />}

        {setupTab === "config" && (
          <>
            <div style={S.card}>
              <span style={S.label}>Rondas</span>
              <div style={S.segmentedControl}>
                {ROUND_OPTIONS.map(r => (
                  <button key={r} style={r === rounds ? S.segmentedOptionActive : S.segmentedOption} onClick={() => setRounds(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <GuessTimerConfig guessSeconds={guessSeconds} onChange={setGuessSeconds} />
          </>
        )}

        <StickyActionBar>
          <StartButton onClick={startGame}>Empezar a jugar</StartButton>
        </StickyActionBar>
      </div>
    );

  if (phase === "handoff")
    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ ...S.label, marginBottom: 4 }}>
            Ronda {roundNumber} / {rounds}
          </p>
          <p style={S.bigReveal}>{names[playerIndex]}</p>
          <p style={S.muted}>Pasále el dispositivo. Tocá cuando estés listo para ver el color.</p>
        </div>
        <StartButton onClick={beginTurn}>Ver el color</StartButton>
      </div>
    );

  if (phase === "show") return <TargetSwatch target={target} timerEnd={showEndsAt > 0 ? showEndsAt : null} />;

  if (phase === "guess")
    return (
      <div>
        {guessEndsAt > 0 && <Timer timerEnd={guessEndsAt} total={guessSeconds} label="Tiempo para adivinar" />}
        <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>¿Cuál era el color? Elegí el más parecido.</p>
        <ColorPicker value={guess} onChange={setGuess} />
        <div style={{ marginTop: 14 }}>
          <StartButton onClick={confirmGuess}>Confirmar</StartButton>
        </div>
      </div>
    );

  if (phase === "roundResult") {
    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando resultados..." />;

    const isLastRound = roundNumber >= rounds;
    const roundBestScore = names.length > 1 ? Math.max(...roundScores) : -1;
    return (
      <div>
        <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>Ronda {roundNumber} — así quedó cada uno</p>
        {names.map((name, i) => (
          <ColorCompareRow
            key={name}
            name={name}
            target={target}
            guess={roundGuesses[i]}
            score={roundScores[i]}
            isRoundWinner={roundScores[i] === roundBestScore}
          />
        ))}
        <StartButton onClick={nextAfterRoundResult}>{isLastRound ? "Ver resultados" : "Siguiente ronda"}</StartButton>
      </div>
    );
  }

  // phase === "final"
  const standings = names
    .map((name, i) => {
      const playerScores = totals[i] ?? [];
      const total = playerScores.reduce((a, b) => a + b, 0);
      const avg = playerScores.length ? Math.round((total / playerScores.length) * 100) / 100 : 0;
      return { id: name, name, score: avg };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <div>
      <Leaderboard standings={standings} finished />
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
