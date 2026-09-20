import { useState, useEffect } from "react";
import clsx from "clsx";
import { T } from "../../theme/styles/classes";
import { Btn } from "../../components/ui/Btn";
import { StartButton } from "../../components/setup/StartButton";
import { Avatar } from "../../components/ui/Avatar";
import { Dial, MARKER_COLORS, markerLabels } from "./components/Dial";
import { RevealCountdown, useRevealCountdown } from "../../components/game-kit/RevealCountdown";
import { Collapsible } from "../../components/game-kit/Collapsible";
import { LeaveToLobbyButton } from "../../components/game-kit/LeaveToLobbyButton";
import { PhaseTransition } from "../../components/game-kit/PhaseTransition";
import { SPECTRUMS } from "@juntada/sintonia-data";
import type { RoundViewProps } from "../gameTypes";
import type { PublicPlayer } from "@juntada/shared-types";

// Mirrors backend/src/games/sintonia/engine.ts's getPublicRoundView — one
// flat shape since fields accumulate as the round moves through phases
// (setup → spectrum → clue → guess → result) rather than a fresh object per
// phase, so most fields stay optional here even though a given phase's
// render branch can rely on the ones it actually reads.
interface SintoniaRoundState {
  setup?: boolean;
  suggestedPsychicId?: string;
  lastSpectrum?: { left: string; right: string } | null;
  usedSpectrums?: string[];
  psychicId?: string;
  left?: string;
  right?: string;
  clue?: string;
  submittedCount?: number;
  guessersOnline?: number;
  target?: number | null;
  guesses?: Record<string, number> | null;
  pointsByPlayer?: Record<string, number> | null;
  psychicBonus?: Record<string, number> | null;
  playMode?: "endless" | "rounds";
  roundLimit?: number;
  roundsPlayed?: number;
}

interface SintoniaPrivateRole {
  isPsychic: boolean;
  target: number | null;
  myGuess: number | null;
}

interface SintoniaWordReveal {
  target: number;
  left: string;
  right: string;
}

// Picks a random pair for the psychic to preview before committing to it —
// purely client-side, so it can be re-rolled instantly without a round trip.
// Confirming a "random" pick submits it as a manual left/right (see
// confirmSpectrum below) rather than asking the server to pick again, so
// what gets used is exactly what was last shown. Filters against the
// server-tracked `usedSpectrums` (see engine.ts's recordSpectrumUsed) so
// this preview — and whatever it ends up confirming — actually respects the
// same no-repeat-within-a-cycle pool the server enforces, falling back to
// the full list once every pair's been used (same reset the server does).
function pickRandomSpectrum(usedKeys: string[], exclude?: { left: string; right: string } | null): { left: string; right: string } {
  const used = new Set(usedKeys);
  let pool = SPECTRUMS.filter(([l, r]) => !used.has(`${l}|${r}`));
  if (pool.length === 0) pool = SPECTRUMS;
  if (exclude) {
    const withoutExclude = pool.filter(([l, r]) => l !== exclude.left || r !== exclude.right);
    if (withoutExclude.length > 0) pool = withoutExclude;
  }
  const [left, right] = pool[Math.floor(Math.random() * pool.length)];
  return { left, right };
}

// Compact "X es el psíquico" status row — avatar and text sit side by side
// so the card doesn't end up mostly empty space around a small centered
// avatar with the name only appearing far below it.
function PsychicStatus({ name, status }: { name: string; status: string }) {
  return (
    <div className={T.avatarStatusRow}>
      <Avatar name={name} size={40} />
      <div>
        <p className="font-bold m-0">{name} es el psíquico</p>
        <p className={clsx(T.muted, "m-0")}>{status}</p>
      </div>
    </div>
  );
}

function Scoreboard({
  players,
  score,
  roundPoints,
}: {
  players: PublicPlayer[];
  score: Record<string, number> | undefined;
  // Endless mode has no separate "final results" screen to show a
  // once-ever scoreboard on, so this same scoreboard doubles as this
  // round's own points too — the delta shows just left of the running
  // total, no label, so it doesn't read as two competing numbers.
  roundPoints?: Record<string, number>;
}) {
  const ranked = players.map(p => ({ ...p, points: score?.[p.id] || 0 })).sort((a, b) => b.points - a.points);
  return (
    <Collapsible title="Tabla de puntuación">
      {ranked.map((p, i) => {
        const delta = roundPoints?.[p.id] ?? 0;
        return (
          <div key={p.id} className={T.rankRow(i === ranked.length - 1)}>
            <span className={T.rankIndex}>{i + 1}</span>
            <Avatar name={p.name} size={28} />
            <span className={T.rankName}>
              {p.name}
              {!p.online ? " (desconectado)" : ""}
            </span>
            {roundPoints && <span className={T.deltaBadge(delta > 0)}>+{delta}</span>}
            <span className={T.rankPointsTotal}>{p.points}</span>
          </div>
        );
      })}
    </Collapsible>
  );
}

// "Ronda X/Y" indicator, shown at the top of every phase — hidden entirely
// in endless mode (no fixed round count to count down against).
function RoundBadge({ round }: { round: SintoniaRoundState | null }) {
  if (!round || round.playMode !== "rounds") return null;
  return (
    <p className={clsx(T.muted, "text-center mb-2.5")}>
      Ronda {(round.roundsPlayed ?? 0) + 1}/{round.roundLimit}
    </p>
  );
}

// Covers this game's in-progress phases (clue/guess/result) inside a
// multiplayer room. Props per the registry contract in games/registry.js.
export function RoundView({ room, me, myPlayer, myRole, wordReveal, isHost, send }: RoundViewProps) {
  const [clueText, setClueText] = useState("");
  const [clueSubmitted, setClueSubmitted] = useState(false);
  const [guessValue, setGuessValue] = useState(50);
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const [setupPsychicId, setSetupPsychicId] = useState<string | "random" | null>(null); // null = sugerido, "random", o un id
  const [spectrumMode, setSpectrumMode] = useState<"random" | "manual" | "same">("random");
  const [spectrumLeft, setSpectrumLeft] = useState("");
  const [spectrumRight, setSpectrumRight] = useState("");
  const [randomPreview, setRandomPreview] = useState<{ left: string; right: string } | null>(null);
  const revealCount = useRevealCountdown(room.roundHistory?.length ?? 0);

  const roundSetup = room.round as SintoniaRoundState | null;
  const role = myRole as SintoniaPrivateRole | null;
  const reveal = wordReveal as SintoniaWordReveal | null;

  // A fresh private_role arrives every round (new psychic/target) — reset
  // this round's local input state. If the server already has a guess on
  // file for us (myRole.myGuess — set when a refresh/reconnect lands mid-
  // "guess", see engine.ts's getPrivateView), restore the locked-in state
  // instead of showing the slider again, since resubmitting would just be
  // rejected now that submit_guess locks the first value in.
  useEffect(() => {
    setClueText("");
    setClueSubmitted(false);
    const myGuess = role?.myGuess;
    setGuessValue(myGuess ?? 50);
    setGuessSubmitted(myGuess != null);
  }, [myRole]);

  // Every time the room re-enters "setup" (lobby start or "Nueva ronda"),
  // reset the host's psychic pick so stale choices from a previous round
  // don't stick. The spectrum pick resets whenever a new psychic is handed
  // the "spectrum" phase, and again if the host asks them to choose again.
  useEffect(() => {
    if (room.phase === "setup") setSetupPsychicId(null);
  }, [room.phase]);
  useEffect(() => {
    if (room.phase === "spectrum") {
      setSpectrumMode("random");
      setSpectrumLeft("");
      setSpectrumRight("");
      setRandomPreview(pickRandomSpectrum(roundSetup?.usedSpectrums || []));
    }
  }, [room.phase]);

  if (room.phase === "setup") {
    const round = roundSetup;
    if (!isHost) {
      return (
        <PhaseTransition phaseKey="setup">
          <div>
            <RoundBadge round={round} />
            <div className={clsx(T.card, "text-center")}>
              <p className="text-[#9089c0] text-sm">Esperando que el anfitrión configure la ronda...</p>
            </div>
          </div>
        </PhaseTransition>
      );
    }

    const chosenPsychicId = setupPsychicId === null ? round?.suggestedPsychicId : setupPsychicId;

    const confirm = () => {
      send({
        type: "confirm_round_setup",
        psychicId: setupPsychicId || round?.suggestedPsychicId || "random",
      });
    };

    return (
      <PhaseTransition phaseKey="setup">
        <div>
          <RoundBadge round={round} />
          <div className={T.card}>
            <span className={T.label}>¿Quién es el psíquico esta ronda?</span>
            <div className="flex flex-col gap-2">
              {room.players.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSetupPsychicId(p.id)}
                  className={T.psychicChoiceBtn(chosenPsychicId === p.id && setupPsychicId !== "random")}
                >
                  <Avatar name={p.name} size={28} />
                  <span>{p.name}</span>
                  {p.id === round?.suggestedPsychicId && <span className={clsx(T.muted, "ml-auto text-[11px]")}>sugerido por turno</span>}
                </button>
              ))}
              <button onClick={() => setSetupPsychicId("random")} className={T.btn(setupPsychicId === "random" ? "primary" : "ghost")}>
                🎲 Elegir al azar
              </button>
            </div>
          </div>

          <Btn variant="success" onClick={confirm}>
            Continuar
          </Btn>
        </div>
      </PhaseTransition>
    );
  }

  const round = roundSetup;
  if (!round) return null;
  const psychic = room.players.find(p => p.id === round.psychicId);
  const isPsychic = !!role?.isPsychic;

  if (room.phase === "spectrum") {
    if (isPsychic) {
      // What would actually be used if confirmed right now — "same" reuses
      // last round's pair, "random" is whatever's currently previewed
      // (re-rollable, see pickRandomSpectrum), "manual" only resolves once
      // both sides are typed. Gates the confirm button.
      const resolvedPair =
        spectrumMode === "same"
          ? round.lastSpectrum
          : spectrumMode === "random"
            ? randomPreview
            : spectrumLeft.trim() && spectrumRight.trim()
              ? { left: spectrumLeft.trim(), right: spectrumRight.trim() }
              : null;
      // What the dial actually shows — unlike resolvedPair, manual mode
      // previews live as each side gets typed instead of waiting for both,
      // so the graph updates immediately as a visual reference while typing.
      const previewPair = spectrumMode === "manual" ? { left: spectrumLeft || "?", right: spectrumRight || "?" } : resolvedPair;

      const confirmSpectrum = () => {
        if (!resolvedPair) return;
        // A "random" pick is submitted as the exact pair just previewed
        // (manual override) instead of asking the server to pick again —
        // otherwise confirming could hand back something different from
        // what was actually shown.
        const mode = spectrumMode === "random" ? "manual" : spectrumMode;
        send({ type: "submit_spectrum", mode, left: resolvedPair.left, right: resolvedPair.right });
      };

      return (
        <PhaseTransition phaseKey="spectrum">
          <div>
            <RoundBadge round={round} />
            <div className={clsx(T.cardHighlight, "text-center")}>
              <p className="text-[22px] font-extrabold text-[#AFA9EC] m-0">Sos el psíquico</p>
            </div>
            {previewPair && (
              <div className={T.card}>
                <Dial value={50} showNeedle={false} leftLabel={previewPair.left} rightLabel={previewPair.right} />
              </div>
            )}
            <div className={T.card}>
              <span className={T.label}>¿Qué par de conceptos usamos?</span>
              <div className="flex flex-col gap-2">
                {round.lastSpectrum && (
                  <button
                    onClick={() => setSpectrumMode("same")}
                    className={clsx(T.btn(spectrumMode === "same" ? "primary" : "ghost"), "text-left")}
                  >
                    Repetir: {round.lastSpectrum.left} / {round.lastSpectrum.right}
                  </button>
                )}
                <button
                  onClick={() => {
                    setSpectrumMode("random");
                    if (!randomPreview) setRandomPreview(pickRandomSpectrum(round.usedSpectrums || []));
                  }}
                  className={clsx(T.btn(spectrumMode === "random" ? "primary" : "ghost"), "text-left")}
                >
                  Uno al azar de la base
                </button>
                <button
                  onClick={() => setSpectrumMode("manual")}
                  className={clsx(T.btn(spectrumMode === "manual" ? "primary" : "ghost"), "text-left")}
                >
                  Elegirlo yo mismo
                </button>
              </div>
              {spectrumMode === "random" && (
                <Btn
                  variant="ghost"
                  onClick={() => setRandomPreview(pickRandomSpectrum(round.usedSpectrums || [], randomPreview))}
                  style={{ marginTop: 10 }}
                >
                  🔀 Ver otra
                </Btn>
              )}
              {spectrumMode === "manual" && (
                <div className="flex gap-2 mt-2.5">
                  <input
                    className={clsx(T.input, "flex-1")}
                    placeholder="Extremo izquierdo"
                    value={spectrumLeft}
                    onChange={e => setSpectrumLeft(e.target.value)}
                  />
                  <input
                    className={clsx(T.input, "flex-1")}
                    placeholder="Extremo derecho"
                    value={spectrumRight}
                    onChange={e => setSpectrumRight(e.target.value)}
                  />
                </div>
              )}
              {spectrumMode === "manual" && (!spectrumLeft.trim() || !spectrumRight.trim()) && (
                <p className="text-xs text-[#E2C44A] mt-2">Completá los dos extremos para poder continuar</p>
              )}
            </div>
            <Btn variant="success" onClick={confirmSpectrum} disabled={!resolvedPair}>
              Confirmar y ver el objetivo
            </Btn>
          </div>
        </PhaseTransition>
      );
    }

    return (
      <PhaseTransition phaseKey="spectrum">
        <div>
          <RoundBadge round={round} />
          <PsychicStatus name={psychic?.name ?? ""} status="Está eligiendo el par de conceptos para esta ronda..." />
        </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "clue") {
    if (!isPsychic) {
      return (
        <PhaseTransition phaseKey="clue">
          <div>
            <RoundBadge round={round} />
            <div className={clsx(T.cardHighlight, "text-center mb-4")}>
              <p className="text-xs text-[#9089c0]">Espectro de esta ronda</p>
              <p className="text-xl font-extrabold text-[#AFA9EC]">
                {round.left} ↔ {round.right}
              </p>
            </div>
            <PsychicStatus name={psychic?.name ?? ""} status="Está pensando una pista para ubicar el objetivo secreto..." />
          </div>
        </PhaseTransition>
      );
    }

    const submitClue = () => {
      if (!clueText.trim()) return;
      send({ type: "submit_clue", clue: clueText.trim() });
      setClueSubmitted(true);
    };

    return (
      <PhaseTransition phaseKey="clue">
        <div>
          <RoundBadge round={round} />
          <div className={clsx(T.card, "text-center")}>
            <Dial value={role!.target!} target={role!.target!} leftLabel={round.left!} rightLabel={round.right!} />
          </div>
          <p className={clsx(T.muted, "text-center my-3")}>
            Sos el psíquico. Escribí una pista (una palabra, una frase, lo que sea) que ubique ese punto entre "{round.left}" y "
            {round.right}
            ", sin decir el objetivo directamente.
          </p>
          {!clueSubmitted ? (
            <div className={T.card}>
              <span className={T.label}>Tu pista</span>
              <input
                className={T.input}
                placeholder="Escribí tu pista..."
                value={clueText}
                onChange={e => setClueText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") submitClue();
                }}
              />
              <Btn variant="success" disabled={!clueText.trim()} onClick={submitClue} style={{ marginTop: 8 }}>
                Enviar pista
              </Btn>
            </div>
          ) : (
            <div className={clsx(T.card, "text-center")}>
              <p className="text-[#5DCAA5]">Pista enviada — esperando que adivinen</p>
            </div>
          )}
        </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "guess") {
    // Guessers who are offline right now aren't counted toward the
    // submittedCount/guessersOnline quorum (see engine.ts), so the round is
    // effectively paused waiting for them — if literally everyone else is
    // offline, nothing will ever auto-resolve it. Only the host gets an
    // override, and only once someone's actually missing.
    const offlineGuessers = room.players.filter(p => !p.online && p.id !== round.psychicId);
    const forceFinishBanner = offlineGuessers.length > 0 && (
      <div className={T.warnCard}>
        <p className="text-[13px] text-[#E2C44A] font-bold m-0">
          Esperando a que se reconecte{offlineGuessers.length === 1 ? "" : "n"}: {offlineGuessers.map(p => p.name).join(", ")}
        </p>
        {isHost && (
          <Btn variant="ghost" onClick={() => send({ type: "force_finish_round" })} style={{ marginTop: 10 }}>
            Terminar la ronda con las adivinanzas ya enviadas
          </Btn>
        )}
      </div>
    );

    if (isPsychic) {
      return (
        <PhaseTransition phaseKey="guess">
          <div>
            <RoundBadge round={round} />
            <div className={clsx(T.cardHighlight, "text-center mb-4")}>
              <p className="text-xs text-[#9089c0]">Tu pista</p>
              <p className="text-xl font-extrabold text-[#AFA9EC]">"{round.clue}"</p>
            </div>
            <div className={clsx(T.card, "text-center")}>
              <p className="text-[#9089c0] text-sm">
                Esperando que adivinen: {round.submittedCount}/{round.guessersOnline}
              </p>
            </div>
            {forceFinishBanner}
          </div>
        </PhaseTransition>
      );
    }

    const submitGuess = () => {
      send({ type: "submit_guess", value: guessValue });
      setGuessSubmitted(true);
    };

    return (
      <PhaseTransition phaseKey="guess">
        <div>
          <RoundBadge round={round} />
          <div className={clsx(T.cardHighlight, "text-center mb-4")}>
            <p className="text-xs text-[#9089c0]">Pista de {psychic?.name}</p>
            <p className="text-xl font-extrabold text-[#AFA9EC]">"{round.clue}"</p>
          </div>
          {!guessSubmitted ? (
            <>
              <div className={T.card}>
                <Dial value={guessValue} leftLabel={round.left!} rightLabel={round.right!} />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={guessValue}
                  onChange={e => setGuessValue(+e.target.value)}
                  className="w-full mt-4"
                />
              </div>
              <Btn variant="success" onClick={submitGuess}>
                Confirmar adivinanza
              </Btn>
            </>
          ) : (
            <div className={clsx(T.card, "text-center")}>
              <p className="text-[#5DCAA5]">Adivinanza enviada</p>
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
    const target = (reveal?.target ?? round.target)!;
    const left = (reveal?.left ?? round.left)!;
    const right = (reveal?.right ?? round.right)!;
    const points = round.pointsByPlayer || {};
    const guesses = round.guesses || {};
    const myId = me?.playerId;
    const guessers = room.players.filter(p => p.id !== round.psychicId && guesses[p.id] != null);
    const labels = markerLabels(guessers.map(p => p.name));
    const markers = guessers.map((p, i) => ({
      value: guesses[p.id],
      label: labels[i],
      color: MARKER_COLORS[i % MARKER_COLORS.length],
      highlight: p.id === myId,
    }));

    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando el objetivo..." />;

    return (
      <PhaseTransition phaseKey="result">
        <div>
          <div className={clsx(T.cardHighlight, "text-center")}>
            <span className={T.label}>Pista de {psychic?.name}</span>
            <p className="text-lg font-bold m-0">"{round.clue}"</p>
          </div>
          <div className={clsx(T.cardHighlight, "text-center")}>
            <Dial value={target} target={target} leftLabel={left} rightLabel={right} markers={markers} showNeedle={false} />
            {guessers.length > 0 && (
              <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mt-2.5">
                {guessers.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-1">
                    <span
                      className={T.markerDotBase}
                      style={{
                        background: MARKER_COLORS[i % MARKER_COLORS.length],
                        borderColor: p.id === myId ? "#fff" : undefined,
                        borderWidth: p.id === myId ? 2 : undefined,
                      }}
                    />
                    <span className={T.markerLabel(p.id === myId)}>
                      {labels[i]} — {p.name}
                      {p.id === myId ? " (vos)" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {(() => {
            const score = room.config.score as Record<string, number>;
            const gameOver = round.playMode === "rounds" && (round.roundsPlayed ?? 0) >= (round.roundLimit ?? Infinity);
            // Endless mode never reaches a "final results" screen — the
            // scoreboard doubles as this round's own points via
            // roundPoints, so there's no separate "Puntos de la ronda"
            // block to keep in sync with it (see Scoreboard below).
            if (round.playMode === "endless") return <Scoreboard players={room.players} score={score} roundPoints={points} />;

            // Rounds mode, still mid-match — no scoreboard yet (see gameOver
            // below for why it's saved for last), just this round's own tally.
            if (!gameOver)
              return (
                <Collapsible title="Puntos de la ronda">
                  {room.players.map(p => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
                      <span style={{ color: "#b8b0d4" }}>
                        {p.name}
                        {p.id === round.psychicId ? " (psíquico)" : ""}
                      </span>
                      <span style={{ color: (points[p.id] || 0) > 0 ? "#5DCAA5" : "#F09595" }}>+{points[p.id] || 0}</span>
                    </div>
                  ))}
                </Collapsible>
              );

            // Rounds mode, last round just finished — the scoreboard (and
            // the winner) stay hidden behind everyone's own tap on "Ver
            // resultados finales" instead of popping up right on top of
            // this same round's result the instant it resolves; myPlayer's
            // `ready` is repurposed for this exact vote (see the backend's
            // player_ready case — nothing else in this game touches it).
            const onlinePlayers = room.players.filter(p => p.online);
            const allReady = onlinePlayers.length > 0 && onlinePlayers.every(p => p.ready);
            if (!allReady)
              return (
                <div className={clsx(T.card, "text-center")}>
                  {myPlayer?.ready ? (
                    <p style={{ color: "#5DCAA5" }}>Listo — esperando a los demás para ver los resultados finales</p>
                  ) : (
                    <Btn variant="success" onClick={() => send({ type: "player_ready" })}>
                      Ver resultados finales
                    </Btn>
                  )}
                </div>
              );

            const topScore = Math.max(...room.players.map(p => score?.[p.id] || 0));
            const winners = room.players.filter(p => (score?.[p.id] || 0) === topScore);
            const isTie = winners.length > 1;
            return (
              <>
                <div className={clsx(T.cardHighlight, "text-center")}>
                  <span className={T.label}>Partida terminada</span>
                  <p className="my-1 text-xl font-extrabold text-[#AFA9EC]">
                    🏆 {isTie ? `Empate entre ${winners.map(w => w.name).join(" y ")}` : `Ganó ${winners[0]?.name}`}
                  </p>
                  <p className={T.muted}>
                    {round.roundsPlayed} rondas jugadas · {topScore} puntos
                  </p>
                </div>
                <Scoreboard players={room.players} score={score} />
              </>
            );
          })()}
          {(() => {
            const gameOver = round.playMode === "rounds" && (round.roundsPlayed ?? 0) >= (round.roundLimit ?? Infinity);
            // The vote gate above already covers "waiting for everyone" — the
            // rematch/next-match controls only make sense once whatever it's
            // gating (final results, in this case) is actually visible.
            const onlinePlayers = room.players.filter(p => p.online);
            const readyForControls = !gameOver || onlinePlayers.every(p => p.ready);
            return (
              readyForControls &&
              (isHost ? (
                gameOver ? (
                  <StartButton onClick={() => send({ type: "new_game" })}>Nueva partida</StartButton>
                ) : (
                  <StartButton onClick={() => send({ type: "start_round" })}>Nueva ronda</StartButton>
                )
              ) : (
                <div className={clsx(T.card, "text-center")}>
                  <p className="text-sm text-[#9089c0]">Esperando que el anfitrión inicie otra ronda</p>
                </div>
              ))
            );
          })()}
          {/* Group instances use the shell's persistent "Volver al grupo" link instead.
            Available to any player, not just the host — always here, even
            mid-vote on the final results, so nobody's stuck waiting to leave. */}
          <LeaveToLobbyButton groupCode={room.groupCode} send={send} />
        </div>
      </PhaseTransition>
    );
  }

  return null;
}
