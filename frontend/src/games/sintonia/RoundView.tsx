import { useState, useEffect } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { Avatar } from "../../components/Avatar";
import { Dial, MARKER_COLORS } from "./Dial";
import { RevealCountdown, useRevealCountdown } from "../../components/RevealCountdown";
import { Collapsible } from "../../components/Collapsible";
import { ConfirmBackButton } from "../../components/ConfirmBackButton";
import type { RoundViewProps } from "../gameTypes";
import type { PublicPlayer } from "@juntada/shared-types";

// Compact "X es el psíquico" status row — avatar and text sit side by side
// so the card doesn't end up mostly empty space around a small centered
// avatar with the name only appearing far below it.
function PsychicStatus({ name, status }: { name: string; status: string }) {
  return (
    <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}>
      <Avatar name={name} size={40} />
      <div>
        <p style={{ fontWeight: 700, margin: 0 }}>{name} es el psíquico</p>
        <p style={{ ...S.muted, margin: 0 }}>{status}</p>
      </div>
    </div>
  );
}

function Scoreboard({ players, score }: { players: PublicPlayer[]; score: Record<string, number> | undefined }) {
  const ranked = players.map(p => ({ ...p, points: score?.[p.id] || 0 })).sort((a, b) => b.points - a.points);
  return (
    <Collapsible title="Tabla de puntuación">
      {ranked.map((p, i) => (
        <div
          key={p.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 0",
            borderBottom: i < ranked.length - 1 ? "1px solid rgba(127,119,221,0.08)" : "none",
          }}
        >
          <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{i + 1}</span>
          <Avatar name={p.name} size={28} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>
            {p.name}
            {!p.online ? " (desconectado)" : ""}
          </span>
          <span style={{ fontWeight: 800, color: "#AFA9EC", minWidth: 28, textAlign: "right" }}>{p.points}</span>
        </div>
      ))}
    </Collapsible>
  );
}

// Covers this game's in-progress phases (clue/guess/result) inside a
// multiplayer room. Props per the registry contract in games/registry.js.
export function RoundView({ room, me, myPlayer: _myPlayer, myRole, wordReveal, isHost, send }: RoundViewProps) {
  const [clueText, setClueText] = useState("");
  const [clueSubmitted, setClueSubmitted] = useState(false);
  const [guessValue, setGuessValue] = useState(50);
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const [setupPsychicId, setSetupPsychicId] = useState<string | "random" | null>(null); // null = sugerido, "random", o un id
  const [spectrumMode, setSpectrumMode] = useState<"random" | "manual" | "same">("random");
  const [spectrumLeft, setSpectrumLeft] = useState("");
  const [spectrumRight, setSpectrumRight] = useState("");
  const revealCount = useRevealCountdown(room.roundHistory?.length ?? 0);

  const roundSetup = room.round as any;

  // A fresh private_role arrives every round (new psychic/target) — reset
  // this round's local input state.
  useEffect(() => {
    setClueText("");
    setClueSubmitted(false);
    setGuessValue(50);
    setGuessSubmitted(false);
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
    }
  }, [room.phase]);

  if (room.phase === "setup") {
    const round = roundSetup;
    if (!isHost) {
      return (
        <div style={{ ...S.card, textAlign: "center" }}>
          <p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión configure la ronda...</p>
        </div>
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
      <div>
        <div style={S.card}>
          <span style={S.label}>¿Quién es el psíquico esta ronda?</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {room.players.map(p => (
              <button
                key={p.id}
                onClick={() => setSetupPsychicId(p.id)}
                style={{
                  ...S.btn(chosenPsychicId === p.id && setupPsychicId !== "random" ? "primary" : "ghost"),
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  justifyContent: "flex-start",
                  padding: "10px 14px",
                }}
              >
                <Avatar name={p.name} size={28} />
                <span>{p.name}</span>
                {p.id === round?.suggestedPsychicId && (
                  <span style={{ ...S.muted, marginLeft: "auto", fontSize: 11 }}>sugerido por turno</span>
                )}
              </button>
            ))}
            <button onClick={() => setSetupPsychicId("random")} style={{ ...S.btn(setupPsychicId === "random" ? "primary" : "ghost") }}>
              🎲 Elegir al azar
            </button>
          </div>
        </div>

        <Btn variant="success" onClick={confirm}>
          Continuar
        </Btn>
      </div>
    );
  }

  const round = roundSetup;
  if (!round) return null;
  const psychic = room.players.find(p => p.id === round.psychicId);
  const isPsychic = (myRole as any)?.isPsychic;

  if (room.phase === "spectrum") {
    if (isPsychic) {
      const manualIncomplete = spectrumMode === "manual" && (!spectrumLeft.trim() || !spectrumRight.trim());
      const confirmSpectrum = () => {
        send({ type: "submit_spectrum", mode: spectrumMode, left: spectrumLeft.trim(), right: spectrumRight.trim() });
      };

      return (
        <div>
          <div style={{ ...S.cardHighlight, textAlign: "center" }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#AFA9EC", margin: 0 }}>Sos el psíquico</p>
          </div>
          <div style={S.card}>
            <span style={S.label}>¿Qué par de conceptos usamos?</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {round.lastSpectrum && (
                <button
                  onClick={() => setSpectrumMode("same")}
                  style={{ ...S.btn(spectrumMode === "same" ? "primary" : "ghost"), textAlign: "left" }}
                >
                  Repetir: {round.lastSpectrum.left} / {round.lastSpectrum.right}
                </button>
              )}
              <button
                onClick={() => setSpectrumMode("random")}
                style={{ ...S.btn(spectrumMode === "random" ? "primary" : "ghost"), textAlign: "left" }}
              >
                Uno al azar de la base
              </button>
              <button
                onClick={() => setSpectrumMode("manual")}
                style={{ ...S.btn(spectrumMode === "manual" ? "primary" : "ghost"), textAlign: "left" }}
              >
                Elegirlo yo mismo
              </button>
            </div>
            {spectrumMode === "manual" && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input
                  style={{ ...S.input, flex: 1 }}
                  placeholder="Extremo izquierdo"
                  value={spectrumLeft}
                  onChange={e => setSpectrumLeft(e.target.value)}
                />
                <input
                  style={{ ...S.input, flex: 1 }}
                  placeholder="Extremo derecho"
                  value={spectrumRight}
                  onChange={e => setSpectrumRight(e.target.value)}
                />
              </div>
            )}
          </div>
          <Btn variant="success" onClick={confirmSpectrum} disabled={manualIncomplete}>
            Confirmar y ver el objetivo
          </Btn>
        </div>
      );
    }

    return <PsychicStatus name={psychic?.name ?? ""} status="Está eligiendo el par de conceptos para esta ronda..." />;
  }

  if (room.phase === "clue") {
    if (!isPsychic) {
      return (
        <div>
          <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#9089c0" }}>Espectro de esta ronda</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#AFA9EC" }}>
              {round.left} ↔ {round.right}
            </p>
          </div>
          <PsychicStatus name={psychic?.name ?? ""} status="Está pensando una pista para ubicar el objetivo secreto..." />
        </div>
      );
    }

    const submitClue = () => {
      if (!clueText.trim()) return;
      send({ type: "submit_clue", clue: clueText.trim() });
      setClueSubmitted(true);
    };

    return (
      <div>
        <div style={{ ...S.card, textAlign: "center" }}>
          <Dial value={(myRole as any).target} target={(myRole as any).target} leftLabel={round.left} rightLabel={round.right} />
        </div>
        <p style={{ ...S.muted, textAlign: "center", margin: "12px 0" }}>
          Sos el psíquico. Escribí una pista (una palabra, una frase, lo que sea) que ubique ese punto entre "{round.left}" y "{round.right}
          ", sin decir el objetivo directamente.
        </p>
        {!clueSubmitted ? (
          <div style={S.card}>
            <span style={S.label}>Tu pista</span>
            <input
              style={S.input}
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
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#5DCAA5" }}>Pista enviada — esperando que adivinen</p>
          </div>
        )}
      </div>
    );
  }

  if (room.phase === "guess") {
    if (isPsychic) {
      return (
        <div>
          <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#9089c0" }}>Tu pista</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#AFA9EC" }}>"{round.clue}"</p>
          </div>
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#9089c0", fontSize: 14 }}>
              Esperando que adivinen: {round.submittedCount}/{round.guessersOnline}
            </p>
          </div>
        </div>
      );
    }

    const submitGuess = () => {
      send({ type: "submit_guess", value: guessValue });
      setGuessSubmitted(true);
    };

    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#9089c0" }}>Pista de {psychic?.name}</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "#AFA9EC" }}>"{round.clue}"</p>
        </div>
        {!guessSubmitted ? (
          <>
            <div style={S.card}>
              <Dial value={guessValue} leftLabel={round.left} rightLabel={round.right} />
              <input
                type="range"
                min="0"
                max="100"
                value={guessValue}
                onChange={e => setGuessValue(+e.target.value)}
                style={{ width: "100%", marginTop: 16 }}
              />
            </div>
            <Btn variant="success" onClick={submitGuess}>
              Confirmar adivinanza
            </Btn>
          </>
        ) : (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#5DCAA5" }}>Adivinanza enviada</p>
            <p style={{ ...S.muted, marginTop: 6 }}>
              {round.submittedCount}/{round.guessersOnline} confirmaron
            </p>
          </div>
        )}
      </div>
    );
  }

  if (room.phase === "result") {
    const target = (wordReveal as any)?.target ?? round.target;
    const left = (wordReveal as any)?.left ?? round.left;
    const right = (wordReveal as any)?.right ?? round.right;
    const points = round.pointsByPlayer || {};
    const guesses = round.guesses || {};
    const myId = me?.playerId;
    const guessers = room.players.filter(p => p.id !== round.psychicId && guesses[p.id] != null);
    const markers = guessers.map((p, i) => ({
      value: guesses[p.id],
      label: p.name.trim()[0]?.toUpperCase(),
      color: MARKER_COLORS[i % MARKER_COLORS.length],
      highlight: p.id === myId,
    }));

    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando el objetivo..." />;

    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <span style={S.label}>Pista de {psychic?.name}</span>
          <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>"{round.clue}"</p>
        </div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <Dial value={target} target={target} leftLabel={left} rightLabel={right} markers={markers} showNeedle={false} />
          {guessers.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 10px", marginTop: 10 }}>
              {guessers.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      background: MARKER_COLORS[i % MARKER_COLORS.length],
                      border: p.id === myId ? "2px solid #fff" : "1.5px solid rgba(255,255,255,0.4)",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: p.id === myId ? 800 : 600, color: p.id === myId ? "#fff" : "#b8b0d4" }}>
                    {p.name.trim()[0]?.toUpperCase()} — {p.name}
                    {p.id === myId ? " (vos)" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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
        <Scoreboard players={room.players} score={room.config.score as Record<string, number>} />
        {(() => {
          const score = room.config.score as Record<string, number>;
          const gameOver = round.playMode === "rounds" && (round.roundsPlayed ?? 0) >= (round.roundLimit ?? Infinity);
          if (!gameOver) return null;
          const winner = room.players.slice().sort((a, b) => (score?.[b.id] || 0) - (score?.[a.id] || 0))[0];
          return (
            <div style={{ ...S.cardHighlight, textAlign: "center" }}>
              <span style={S.label}>Partida terminada</span>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#AFA9EC", margin: "4px 0" }}>🏆 Ganó {winner?.name}</p>
              <p style={S.muted}>
                {round.roundsPlayed} rondas jugadas · {score?.[winner?.id ?? ""] || 0} puntos
              </p>
            </div>
          );
        })()}
        {isHost &&
          (round.playMode === "rounds" && (round.roundsPlayed ?? 0) >= (round.roundLimit ?? Infinity) ? (
            <StartButton onClick={() => send({ type: "new_game" })}>Nueva partida</StartButton>
          ) : (
            <StartButton onClick={() => send({ type: "start_round" })}>Nueva ronda</StartButton>
          ))}
        {/* Group instances use the shell's persistent "Volver al grupo" link instead. */}
        {isHost && room.groupCode === null && (
          <ConfirmBackButton
            title="¿Volver al lobby?"
            message="Se interrumpe la partida para todos. La tabla de puntuación se mantiene si vuelven a jugar sin arrancar una partida nueva."
            confirmLabel="Volver al lobby"
            onConfirm={() => send({ type: "back_to_lobby" })}
          >
            Volver al lobby
          </ConfirmBackButton>
        )}
        {!isHost && (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión inicie otra ronda</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
