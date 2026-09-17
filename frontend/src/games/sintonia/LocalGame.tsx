import { useMemo, useState } from "react";
import clsx from "clsx";
import { T } from "../../theme/styles/classes";
import { Btn } from "../../components/ui/Btn";
import { StartButton } from "../../components/setup/StartButton";
import { BackButton } from "../../components/game-kit/BackButton";
import { Avatar } from "../../components/ui/Avatar";
import { Toggle } from "../../components/game-kit/Toggle";
import { SetupTabs, type SetupTab } from "../../components/setup/SetupTabs";
import { StickyActionBar } from "../../components/setup/StickyActionBar";
import { ConfirmBackButton } from "../../components/game-kit/ConfirmBackButton";
import { MinPlayersHint } from "../../components/game-kit/MinPlayersHint";
import { RevealCountdown, useRevealCountdown } from "../../components/game-kit/RevealCountdown";
import { shuffle } from "@juntada/core-utils";
import { nextPlayerName } from "../../utils/nextPlayerName";
import { SPECTRUMS } from "@juntada/sintonia-data";
import { scoreFor } from "@juntada/sintonia-scoring";
import { Dial, MARKER_COLORS, markerLabels } from "./components/Dial";
import { Collapsible } from "../../components/game-kit/Collapsible";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { useFlashError } from "../../hooks/ui/useFlashError";
import { PlayModeConfig } from "./components/PlayModeConfig";
import type { HistoryEntry, LocalPlayer, RoundData } from "./types/localGame";

// ═══════════════════════════════════════════════════════════════════════════════
// SINTONÍA (estilo Wavelength) — un solo dispositivo, se pasa de mano en mano.
// Mismo modelo que el modo online: primero se elige quién es el psíquico
// (sugerido por turno, manual o al azar). Ya con el dispositivo en mano, el
// propio psíquico elige el par de conceptos (repetir el último, uno al azar
// de la base, o uno escrito por él) antes de ver el objetivo secreto y, si
// "pistas escritas" está activo, escribir la pista; si no, la dice en voz
// alta. Después el dispositivo pasa de jugador en jugador para que cada uno
// adivine por su cuenta, y al final se revela el objetivo con la marca de
// cada uno y el puntaje de la ronda — igual que en el modo online.
// ═══════════════════════════════════════════════════════════════════════════════

const MIN_PLAYERS = 2;

function randomTarget(): number {
  return 8 + Math.floor(Math.random() * 85); // 8..92, evita los extremos
}

// Whoever comes right after the last round's psychic, in the current player
// order — anchored to that player's identity (not a raw counter) so it stays
// fair even if someone was added or removed since the last round.
function nextSuggestedPsychicId(players: LocalPlayer[], lastPsychicId: number | null): number {
  const idx = lastPsychicId != null ? players.findIndex(p => p.id === lastPsychicId) : -1;
  return players[idx === -1 ? 0 : (idx + 1) % players.length].id;
}

function Scoreboard({
  players,
  history,
  roundPoints,
}: {
  players: LocalPlayer[];
  history: HistoryEntry[];
  // Endless mode has no separate "final results" screen to show a
  // once-ever scoreboard on, so this same scoreboard doubles as this
  // round's own points too — the delta shows just left of the running
  // total, no label, so it doesn't read as two competing numbers.
  roundPoints?: Record<number, number>;
}) {
  const ranked = useMemo(
    () =>
      players
        .map(p => ({
          ...p,
          points: history.reduce((sum, h) => sum + (h.pointsByPlayer[p.id] || 0), 0),
          timesPsychic: history.filter(h => h.psychicId === p.id).length,
        }))
        .sort((a, b) => b.points - a.points),
    [players, history],
  );
  return (
    <Collapsible title="Tabla de puntuación">
      {ranked.map((p, i) => {
        const delta = roundPoints?.[p.id] ?? 0;
        return (
          <div key={p.id} className={T.rankRow(i === ranked.length - 1)}>
            <span className={T.rankIndex}>{i + 1}</span>
            <Avatar name={p.name} size={28} />
            <span className={T.rankName}>{p.name}</span>
            <span className={T.muted}>psíquico x{p.timesPsychic}</span>
            {roundPoints && <span className={T.deltaBadge(delta > 0)}>+{delta}</span>}
            <span className={T.rankPointsTotal}>{p.points}</span>
          </div>
        );
      })}
    </Collapsible>
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
  const [nameError, nameErrorKey, setNameError] = useFlashError();
  const [config, setConfig] = useState<{ writtenClues: boolean; playMode: "endless" | "rounds"; roundLimit: number }>({
    writtenClues: false,
    playMode: "endless",
    roundLimit: 5,
  });

  const [pool, setPool] = useState<[string, string][]>([]); // pares de la base sin usar en esta partida
  // Anchored to the last psychic's identity rather than a raw array index —
  // an index would silently skip or repeat someone if a player is added or
  // removed between rounds, since it'd then point at a different position
  // in the (now different-sized) array than originally intended.
  const [lastPsychicId, setLastPsychicId] = useState<number | null>(null);
  const [round, setRound] = useState<RoundData | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [clueText, setClueText] = useState("");
  const [guessOrder, setGuessOrder] = useState<number[]>([]);
  const [guessIdx, setGuessIdx] = useState(0);
  const [guessValue, setGuessValue] = useState(50);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const revealCount = useRevealCountdown(history.length);

  const [tab, setTab] = useState<SetupTab>("players");

  const [setupPsychicId, setSetupPsychicId] = useState<number | "random" | null>(null); // null = sugerido, "random", o un id
  // Elegidos por el propio psíquico, una vez que tiene el dispositivo en mano
  // (ver fase "reveal"), no por quien configura la ronda.
  const [spectrumMode, setSpectrumMode] = useState<"random" | "manual" | "same">("random");
  const [spectrumLeft, setSpectrumLeft] = useState("");
  const [spectrumRight, setSpectrumRight] = useState("");
  const [randomPreview, setRandomPreview] = useState<{ left: string; right: string } | null>(null);

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

  const goToRoundSetup = () => {
    setSetupPsychicId(null);
    setPhase("roundSetup");
  };

  const startGame = () => {
    setHistory([]);
    setLastPsychicId(null);
    setRound(null);
    setPool([]);
    goToRoundSetup();
  };

  const confirmRoundSetup = () => {
    const suggestedId = nextSuggestedPsychicId(players, lastPsychicId);
    let psychicId = setupPsychicId;
    if (!psychicId || psychicId === "random") {
      psychicId = setupPsychicId === "random" ? players[Math.floor(Math.random() * players.length)].id : suggestedId;
    }
    const psychic = players.find(p => p.id === psychicId)!;

    setRound({ left: null, right: null, target: null, psychicId: psychicId as number, psychicName: psychic.name, clue: null, guesses: {} });
    setRevealed(false);
    setClueText("");
    setGuessOrder(players.filter(p => p.id !== psychicId).map(p => p.id));
    setGuessIdx(0);
    setGuessValue(50);
    setLastPsychicId(psychicId as number);
    setSpectrumMode("random");
    setSpectrumLeft("");
    setSpectrumRight("");
    setPhase("reveal");
    setRandomPreview(pickAndCyclePreview());
  };

  // Picks the next pair for the "random" preview and cycles it to the back
  // of `pool` (not removing it) — so re-rolling ("Ver otra") just keeps
  // walking the same shuffled, no-repeats-within-a-match deck instead of
  // consuming from it; only actually confirming a random pick (see
  // confirmSpectrum) removes it for good.
  const pickAndCyclePreview = (): { left: string; right: string } => {
    const source = pool.length > 0 ? pool : shuffle(SPECTRUMS as [string, string][]);
    const [left, right] = source[0];
    setPool([...source.slice(1), source[0]]);
    return { left, right };
  };

  // Called by the psychic, once they have the device in hand, to lock in
  // this round's pair of concepts before the secret target is generated.
  const confirmSpectrum = () => {
    const lastRound = history[history.length - 1];
    let left: string, right: string;
    if (spectrumMode === "manual" && spectrumLeft.trim() && spectrumRight.trim()) {
      left = spectrumLeft.trim();
      right = spectrumRight.trim();
    } else if (spectrumMode === "same" && lastRound) {
      left = lastRound.left;
      right = lastRound.right;
    } else if (randomPreview) {
      left = randomPreview.left;
      right = randomPreview.right;
      // Already cycled to the back of `pool` by the preview pick — drop it
      // for real now instead of leaving it there to resurface later.
      setPool(prev => prev.filter(([l, r]) => l !== left || r !== right));
    } else {
      return; // no random preview yet (shouldn't normally happen)
    }
    setRound(r => r && { ...r, left, right, target: randomTarget() });
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
      const pts = scoreFor(Math.abs(value - round.target!));
      pointsByPlayer[Number(pid)] = pts;
      guesserPointsSum += pts;
    });
    pointsByPlayer[round.psychicId] = (pointsByPlayer[round.psychicId] || 0) + guesserPointsSum;

    setHistory(h => [
      ...h,
      {
        left: round.left!,
        right: round.right!,
        target: round.target!,
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
      <div className="pb-[88px]">
        <SetupTabs tab={tab} onChange={setTab} />

        {tab === "players" && (
          <>
            <div className={T.card}>
              <span className={T.label}>Jugadores ({players.length})</span>
              {players.map(p => (
                <div key={p.id} className="flex items-center gap-2 mb-2">
                  <Avatar name={p.name} size={32} />
                  <input className={clsx(T.input, "flex-1 min-w-0")} value={p.name} onChange={e => renamePlayer(p.id, e.target.value)} />
                  <button onClick={() => setPlayers(prev => prev.filter(x => x.id !== p.id))} className={T.squareIconBtn("danger")}>
                    ×
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-2.5">
                <input
                  className={clsx(T.input, "flex-1")}
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

            {history.length > 0 && <Scoreboard players={players} history={history} />}
          </>
        )}

        {tab === "config" && (
          <>
            <div className={T.card}>
              <Toggle
                label={config.writtenClues ? "Pistas escritas (se escriben en el dispositivo)" : "Pistas dichas en voz alta"}
                value={config.writtenClues}
                onChange={v => setConfig(c => ({ ...c, writtenClues: v }))}
              />
              <p className={clsx(T.muted, "mt-2.5 mb-0 leading-[1.4]")}>
                Con pistas escritas, el psíquico la tipea en el dispositivo antes de pasarlo. Sin esto, la dice en voz alta y el dispositivo
                pasa directo a que el resto adivine.
              </p>
            </div>

            <PlayModeConfig
              playMode={config.playMode}
              roundLimit={config.roundLimit}
              onChange={patch => setConfig(c => ({ ...c, ...patch }))}
            />
          </>
        )}

        <StickyActionBar>
          <StartButton onClick={startGame} disabled={players.length < MIN_PLAYERS}>
            Iniciar partida
          </StartButton>
          <MinPlayersHint count={players.length} min={MIN_PLAYERS} />
        </StickyActionBar>
      </div>
    );

  // ── ROUND SETUP (elegir psíquico para esta ronda) ──
  if (phase === "roundSetup") {
    const suggestedId = nextSuggestedPsychicId(players, lastPsychicId);
    const chosenPsychicId = setupPsychicId === null ? suggestedId : setupPsychicId;

    return (
      <div>
        <div className={T.card}>
          <span className={T.label}>¿Quién es el psíquico esta ronda?</span>
          <div className="flex flex-col gap-2">
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => setSetupPsychicId(p.id)}
                className={T.psychicChoiceBtn(chosenPsychicId === p.id && setupPsychicId !== "random")}
              >
                <Avatar name={p.name} size={28} />
                <span>{p.name}</span>
                {p.id === suggestedId && <span className={clsx(T.muted, "ml-auto text-[11px]")}>sugerido por turno</span>}
              </button>
            ))}
            <button onClick={() => setSetupPsychicId("random")} className={T.btn(setupPsychicId === "random" ? "primary" : "ghost")}>
              🎲 Elegir al azar
            </button>
          </div>
        </div>

        <StartButton onClick={confirmRoundSetup}>Continuar</StartButton>
        <BackButton onClick={() => setPhase("setup")}>Volver a configuración</BackButton>
      </div>
    );
  }

  // ── REVEAL (el "psíquico" ve el objetivo) ──
  if (phase === "reveal" && round) {
    const psychic = players.find(p => p.id === round.psychicId)!;

    // Antes de ver el objetivo, el propio psíquico elige el par de conceptos
    // de esta ronda (repetir el último, uno al azar, o uno escrito por él).
    if (round.left === null) {
      const lastRound = history[history.length - 1];
      const resolvedPair =
        spectrumMode === "same"
          ? lastRound
          : spectrumMode === "random"
            ? randomPreview
            : spectrumLeft.trim() && spectrumRight.trim()
              ? { left: spectrumLeft.trim(), right: spectrumRight.trim() }
              : null;
      // What the dial actually shows — unlike resolvedPair, manual mode
      // previews live as each side gets typed instead of waiting for both.
      const previewPair = spectrumMode === "manual" ? { left: spectrumLeft || "?", right: spectrumRight || "?" } : resolvedPair;
      return (
        <div>
          <div className="text-center mb-4">
            <div className={T.avatarNameRow}>
              <Avatar name={psychic.name} size={56} />
              <p className="font-extrabold text-xl m-0">{psychic.name}</p>
            </div>
            <p className={T.muted}>Pasále el dispositivo solo a esta persona</p>
          </div>
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
              {lastRound && (
                <button
                  onClick={() => setSpectrumMode("same")}
                  className={clsx(T.btn(spectrumMode === "same" ? "primary" : "ghost"), "text-left")}
                >
                  Repetir: {lastRound.left} / {lastRound.right}
                </button>
              )}
              <button
                onClick={() => {
                  setSpectrumMode("random");
                  if (!randomPreview) setRandomPreview(pickAndCyclePreview());
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
              <Btn variant="ghost" onClick={() => setRandomPreview(pickAndCyclePreview())} style={{ marginTop: 10 }}>
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
          <BackButton onClick={() => setPhase("roundSetup")}>Elegir otro psíquico</BackButton>
        </div>
      );
    }

    const canProceed = revealed && (!config.writtenClues || clueText.trim());
    return (
      <div>
        <div className="text-center mb-4">
          <div className={T.avatarNameRow}>
            <Avatar name={psychic.name} size={56} />
            <p className="font-extrabold text-xl m-0">{psychic.name}</p>
          </div>
          <p className={T.muted}>Pasále el dispositivo solo a esta persona</p>
        </div>
        <div className={T.revealCard(revealed)} onClick={() => setRevealed(v => !v)}>
          {!revealed ? (
            <p className="text-[#6b6490] text-[15px]">Tocá para revelar el objetivo</p>
          ) : (
            <>
              <Dial value={round.target!} target={round.target} leftLabel={round.left!} rightLabel={round.right!} />
              <p className="text-xs text-[#5a5280] mt-3">Tocá para ocultar</p>
            </>
          )}
        </div>
        {revealed && !config.writtenClues && (
          <p className={clsx(T.muted, "text-center my-3")}>
            Pensá una pista (una palabra, una persona, lo que sea) que ubique ese punto entre "{round.left}" y "{round.right}" y decila en
            voz alta. No digas el objetivo directamente.
          </p>
        )}
        {revealed && config.writtenClues && (
          <div className={T.card}>
            <span className={T.label}>Tu pista</span>
            <input className={T.input} placeholder="Escribí tu pista..." value={clueText} onChange={e => setClueText(e.target.value)} />
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
        <div className="text-center mb-4">
          <div className={T.avatarNameRow}>
            <Avatar name={guesser.name} size={56} />
            <p className="font-extrabold text-xl m-0">{guesser.name}</p>
          </div>
          <p className={T.muted}>
            Turno {guessIdx + 1} de {guessOrder.length} — pasále el dispositivo a esta persona
          </p>
        </div>
        {round.clue ? (
          <div className={clsx(T.cardHighlight, "text-center mb-4")}>
            <p className="text-xs text-[#9089c0]">Pista de {round.psychicName}</p>
            <p className="text-xl font-extrabold text-[#AFA9EC]">"{round.clue}"</p>
          </div>
        ) : (
          <p className={clsx(T.muted, "text-center mb-4")}>Guiate por la pista que dijo {round.psychicName} en voz alta</p>
        )}
        <div className={T.card}>
          <Dial value={guessValue} leftLabel={round.left!} rightLabel={round.right!} />
          <input type="range" min="0" max="100" value={guessValue} onChange={e => setGuessValue(+e.target.value)} className="w-full mt-4" />
        </div>
        <Btn variant="success" onClick={confirmCurrentGuess}>
          {guessIdx + 1 < guessOrder.length ? "Confirmar y pasar al siguiente" : "Confirmar y revelar resultado"}
        </Btn>
      </div>
    );
  }

  // ── RESULT ──
  if (phase === "result" && round) {
    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando el objetivo..." />;

    const points = round.pointsByPlayer || {};
    const guessers = players.filter(p => p.id !== round.psychicId && round.guesses[p.id] != null);
    const labels = markerLabels(guessers.map(p => p.name));
    const markers = guessers.map((p, i) => ({
      value: round.guesses[p.id],
      label: labels[i],
      color: MARKER_COLORS[i % MARKER_COLORS.length],
    }));

    return (
      <div>
        <div className={clsx(T.cardHighlight, "text-center")}>
          <span className={T.label}>Pista de {round.psychicName}</span>
          {round.clue ? (
            <p className="text-lg font-bold m-0">"{round.clue}"</p>
          ) : (
            <p className={clsx(T.muted, "m-0")}>(dicha en voz alta)</p>
          )}
        </div>
        <div className={clsx(T.cardHighlight, "text-center")}>
          <Dial
            value={round.target!}
            target={round.target}
            leftLabel={round.left!}
            rightLabel={round.right!}
            markers={markers}
            showNeedle={false}
          />
          {guessers.length > 0 && (
            <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-1 mt-2.5">
              {guessers.map((p, i) => (
                <div key={p.id} className="flex items-center gap-1">
                  <span className={T.markerDotBase} style={{ background: MARKER_COLORS[i % MARKER_COLORS.length] }} />
                  <span className="text-[11px] font-semibold text-[#b8b0d4]">
                    {labels[i]} — {p.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {(() => {
          if (config.playMode === "endless") return <Scoreboard players={players} history={history} roundPoints={points} />;

          const gameOver = history.length >= config.roundLimit;
          if (!gameOver)
            return (
              <Collapsible title="Puntos de la ronda">
                {players.map(p => (
                  <div key={p.id} className="flex justify-between py-1.5 text-sm">
                    <span className="text-[#b8b0d4]">
                      {p.name}
                      {p.id === round.psychicId ? " (psíquico)" : ""}
                    </span>
                    <span className={(points[p.id] || 0) > 0 ? "text-[#5DCAA5]" : "text-[#F09595]"}>+{points[p.id] || 0}</span>
                  </div>
                ))}
              </Collapsible>
            );

          const scoreOf = (p: LocalPlayer) => history.reduce((sum, h) => sum + (h.pointsByPlayer[p.id] || 0), 0);
          const scores = players.map(scoreOf);
          const topScore = Math.max(...scores);
          const winners = players.filter((p, i) => scores[i] === topScore);
          const isTie = winners.length > 1;
          return (
            <>
              <div className={clsx(T.cardHighlight, "text-center")}>
                <span className={T.label}>Partida terminada</span>
                <p className="text-xl font-extrabold text-[#AFA9EC] my-1">
                  🏆 {isTie ? `Empate entre ${winners.map(w => w.name).join(" y ")}` : `Ganó ${winners[0]?.name}`}
                </p>
                <p className={T.muted}>
                  {history.length} rondas jugadas · {topScore} puntos
                </p>
              </div>
              <Scoreboard players={players} history={history} />
            </>
          );
        })()}
        <div className="flex flex-col gap-2.5 mt-1">
          {config.playMode === "rounds" && history.length >= config.roundLimit ? (
            <StartButton onClick={startGame}>Nueva partida</StartButton>
          ) : (
            <StartButton onClick={goToRoundSetup}>Siguiente ronda</StartButton>
          )}
          <ConfirmBackButton
            title="¿Terminar la partida?"
            message="Se interrumpe la partida y se pierde la tabla de puntuación."
            onConfirm={() => {
              setHistory([]);
              setLastPsychicId(null);
              setRound(null);
              setPool([]);
              setPhase("setup");
            }}
          >
            Terminar partida
          </ConfirmBackButton>
        </div>
      </div>
    );
  }

  return null;
}
