import { useState, useEffect } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import { Dial } from "./Dial";

function Scoreboard({ players, score }) {
  const ranked = players
    .map(p => ({ ...p, points: score?.[p.id] || 0 }))
    .sort((a, b) => b.points - a.points);
  return (
    <div style={S.card}>
      <span style={S.label}>Tabla de puntuación</span>
      {ranked.map((p, i) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < ranked.length - 1 ? "1px solid rgba(127,119,221,0.08)" : "none" }}>
          <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{i + 1}</span>
          <Avatar name={p.name} size={28} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}{!p.online ? " (desconectado)" : ""}</span>
          <span style={{ fontWeight: 800, color: "#AFA9EC", minWidth: 28, textAlign: "right" }}>{p.points}</span>
        </div>
      ))}
    </div>
  );
}

// Covers this game's in-progress phases (clue/guess/result) inside a
// multiplayer room. Props per the registry contract in games/registry.js.
export function RoundView({ room, me, myPlayer, myRole, wordReveal, isHost, send }) {
  const [clueText, setClueText] = useState("");
  const [clueSubmitted, setClueSubmitted] = useState(false);
  const [guessValue, setGuessValue] = useState(50);
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const [setupPsychicId, setSetupPsychicId] = useState(null); // null = sugerido, "random", o un id
  const [setupSpectrumMode, setSetupSpectrumMode] = useState("random");
  const [setupManualLeft, setSetupManualLeft] = useState("");
  const [setupManualRight, setSetupManualRight] = useState("");

  // A fresh private_role arrives every round (new psychic/target) — reset
  // this round's local input state.
  useEffect(() => {
    setClueText("");
    setClueSubmitted(false);
    setGuessValue(50);
    setGuessSubmitted(false);
  }, [myRole]);

  // Every time the room re-enters "setup" (lobby start or "Nueva ronda"),
  // reset the host's picks so stale choices from a previous round don't stick.
  useEffect(() => {
    if (room.phase === "setup") {
      setSetupPsychicId(null);
      setSetupSpectrumMode("random");
      setSetupManualLeft("");
      setSetupManualRight("");
    }
  }, [room.phase]);

  if (room.phase === "setup") {
    const round = room.round;
    if (!isHost) {
      return (
        <div style={{ ...S.card, textAlign: "center" }}>
          <p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión configure la ronda...</p>
        </div>
      );
    }

    const chosenPsychicId = setupPsychicId === null ? round?.suggestedPsychicId : setupPsychicId;
    const manualIncomplete = setupSpectrumMode === "manual" && (!setupManualLeft.trim() || !setupManualRight.trim());

    const confirm = () => {
      send({
        type: "confirm_round_setup",
        psychicId: setupPsychicId || round?.suggestedPsychicId || "random",
        spectrumMode: setupSpectrumMode,
        left: setupManualLeft.trim(),
        right: setupManualRight.trim(),
      });
    };

    return (
      <div>
        <div style={S.card}>
          <span style={S.label}>¿Quién es el psíquico esta ronda?</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {room.players.map(p => (
              <button key={p.id} onClick={() => setSetupPsychicId(p.id)}
                style={{ ...S.btn(chosenPsychicId === p.id && setupPsychicId !== "random" ? "primary" : "secondary"), display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-start", padding: "10px 14px" }}>
                <Avatar name={p.name} size={28} />
                <span>{p.name}</span>
                {p.id === round?.suggestedPsychicId && <span style={{ ...S.muted, marginLeft: "auto", fontSize: 11 }}>sugerido por turno</span>}
              </button>
            ))}
            <button onClick={() => setSetupPsychicId("random")} style={{ ...S.btn(setupPsychicId === "random" ? "primary" : "secondary") }}>
              🎲 Elegir al azar
            </button>
          </div>
        </div>

        <div style={S.card}>
          <span style={S.label}>¿Qué par de conceptos usamos?</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {round?.lastSpectrum && (
              <button onClick={() => setSetupSpectrumMode("same")} style={{ ...S.btn(setupSpectrumMode === "same" ? "primary" : "secondary"), textAlign: "left" }}>
                🔁 Repetir: {round.lastSpectrum.left} / {round.lastSpectrum.right}
              </button>
            )}
            <button onClick={() => setSetupSpectrumMode("random")} style={{ ...S.btn(setupSpectrumMode === "random" ? "primary" : "secondary"), textAlign: "left" }}>
              🎲 Uno al azar de la base
            </button>
            <button onClick={() => setSetupSpectrumMode("manual")} style={{ ...S.btn(setupSpectrumMode === "manual" ? "primary" : "secondary"), textAlign: "left" }}>
              ✍️ Elegirlo yo mismo
            </button>
          </div>
          {setupSpectrumMode === "manual" && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Extremo izquierdo" value={setupManualLeft} onChange={e => setSetupManualLeft(e.target.value)} />
              <input style={{ ...S.input, flex: 1 }} placeholder="Extremo derecho" value={setupManualRight} onChange={e => setSetupManualRight(e.target.value)} />
            </div>
          )}
        </div>

        <Btn variant="success" onClick={confirm} disabled={manualIncomplete}>Empezar ronda</Btn>
      </div>
    );
  }

  const round = room.round;
  if (!round) return null;
  const psychic = room.players.find(p => p.id === round.psychicId);
  const isPsychic = myRole?.isPsychic;

  if (room.phase === "clue") {
    if (!isPsychic) {
      return (
        <div>
          <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#9089c0" }}>Espectro de esta ronda</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#AFA9EC" }}>{round.left} ↔ {round.right}</p>
          </div>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <Avatar name={psychic?.name} size={48} />
            <p style={{ fontWeight: 700, marginTop: 8 }}>{psychic?.name} es el psíquico</p>
            <p style={S.muted}>Está pensando una pista para ubicar el objetivo secreto...</p>
          </div>
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
          <Dial value={myRole.target} target={myRole.target} leftLabel={round.left} rightLabel={round.right} />
        </div>
        <p style={{ ...S.muted, textAlign: "center", margin: "12px 0" }}>
          Sos el psíquico. Escribí una pista (una palabra, una frase, lo que sea) que ubique ese punto entre "{round.left}" y "{round.right}", sin decir el objetivo directamente.
        </p>
        {!clueSubmitted ? (
          <div style={S.card}>
            <span style={S.label}>Tu pista</span>
            <input style={S.input} placeholder="Escribí tu pista..." value={clueText} onChange={e => setClueText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submitClue(); }} />
            <Btn variant="success" disabled={!clueText.trim()} onClick={submitClue} style={{ marginTop: 8 }}>Enviar pista</Btn>
          </div>
        ) : (
          <div style={{ ...S.card, textAlign: "center" }}><p style={{ color: "#5DCAA5" }}>Pista enviada — esperando que adivinen</p></div>
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
            <p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que adivinen: {round.submittedCount}/{round.guessersOnline}</p>
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
              <input type="range" min="0" max="100" value={guessValue} onChange={e => setGuessValue(+e.target.value)} style={{ width: "100%", marginTop: 16 }} />
            </div>
            <Btn variant="success" onClick={submitGuess}>Confirmar adivinanza</Btn>
          </>
        ) : (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#5DCAA5" }}>Adivinanza enviada</p>
            <p style={{ ...S.muted, marginTop: 6 }}>{round.submittedCount}/{round.guessersOnline} confirmaron</p>
          </div>
        )}
      </div>
    );
  }

  if (room.phase === "result") {
    const target = wordReveal?.target ?? round.target;
    const left = wordReveal?.left ?? round.left;
    const right = wordReveal?.right ?? round.right;
    const points = round.pointsByPlayer || {};
    const guesses = round.guesses || {};
    const markers = room.players
      .filter(p => p.id !== round.psychicId && guesses[p.id] != null)
      .map(p => ({ value: guesses[p.id], label: p.name.trim()[0]?.toUpperCase() }));
    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <Dial value={target} target={target} leftLabel={left} rightLabel={right} markers={markers} />
        </div>
        <div style={S.card}>
          <span style={S.label}>Pista de {psychic?.name}</span>
          <p style={{ fontSize: 18, fontWeight: 700, margin: "4px 0 0" }}>"{round.clue}"</p>
          <p style={{ ...S.muted, marginTop: 6 }}>{psychic?.name} gana lo mismo que sumaron los que adivinaron: +{round.psychicBonus ?? 0}</p>
        </div>
        <div style={S.card}>
          <span style={S.label}>Puntos de la ronda</span>
          {room.players.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
              <span style={{ color: "#b8b0d4" }}>{p.name}{p.id === round.psychicId ? " (psíquico)" : ""}</span>
              <span style={{ color: (points[p.id] || 0) > 0 ? "#5DCAA5" : "#F09595" }}>+{points[p.id] || 0}</span>
            </div>
          ))}
        </div>
        <Scoreboard players={room.players} score={room.config.score} />
        {isHost && <Btn variant="success" onClick={() => send({ type: "start_round" })}>Nueva ronda</Btn>}
        {isHost && <Btn variant="secondary" onClick={() => send({ type: "back_to_lobby" })} style={{ marginTop: 10 }}>Volver al lobby</Btn>}
        {!isHost && <div style={{ ...S.card, textAlign: "center" }}><p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión inicie otra ronda</p></div>}
      </div>
    );
  }

  return null;
}
