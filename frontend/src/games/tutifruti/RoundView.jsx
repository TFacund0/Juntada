import { useState, useEffect, useRef } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";

function useCountdown(timerEnd) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!timerEnd) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [timerEnd]);
  if (!timerEnd) return null;
  return Math.max(0, Math.ceil((timerEnd - now) / 1000));
}

function playerName(room, id) {
  return room.players.find(p => p.id === id)?.name ?? "?";
}

// ── SETUP: letter draw, host can reroll ──
function SetupPhase({ room, isHost, send }) {
  const round = room.round;
  return (
    <div>
      <div style={{ ...S.cardHighlight, textAlign: "center", padding: "36px 20px" }}>
        <p style={{ fontSize: 13, color: "#9089c0", marginBottom: 8 }}>La letra es...</p>
        <p style={{ fontSize: 64, fontWeight: 800, color: "#AFA9EC", margin: 0, lineHeight: 1 }}>{round.letter}</p>
        {round.rerollsUsed > 0 && <p style={{ ...S.muted, marginTop: 10 }}>Letra cambiada {round.rerollsUsed} {round.rerollsUsed === 1 ? "vez" : "veces"}</p>}
      </div>
      {isHost ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn onClick={() => send({ type: "confirm_letter" })}>Confirmar y empezar</Btn>
          <Btn variant="secondary" onClick={() => send({ type: "confirm_letter", reroll: true })}>🔀 Cambiar letra</Btn>
        </div>
      ) : (
        <p style={{ ...S.muted, textAlign: "center" }}>Esperando que el anfitrión confirme la letra...</p>
      )}
    </div>
  );
}

// ── WRITING: fill in categories against the clock or until "basta" ──
function WritingPhase({ room, me, myRole, isHost, send }) {
  const round = room.round;
  const timeLeft = useCountdown(round.endMode === "timer" ? round.timerEnd : null);
  const [values, setValues] = useState(() => myRole?.myAnswers || {});
  const debounceRef = useRef(null);
  const letterRef = useRef(round.letter);

  useEffect(() => {
    if (letterRef.current !== round.letter) {
      letterRef.current = round.letter;
      setValues(myRole?.myAnswers || {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.letter]);

  const onChange = (catId, word) => {
    const next = { ...values, [catId]: word };
    setValues(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      send({ type: "submit_answers", answers: { [catId]: word } });
    }, 400);
  };

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div>
      <div style={{ ...S.cardHighlight, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#9089c0", marginBottom: 4 }}>Letra</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: "#AFA9EC", margin: 0 }}>{round.letter}</p>
      </div>
      {round.endMode === "timer" && timeLeft != null && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#9089c0" }}>Tiempo restante</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: timeLeft < 15 ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5" }}>{timeLeft}s</span>
          </div>
        </div>
      )}
      <div style={S.card}>
        <span style={S.label}>Completá con la letra "{round.letter}"</span>
        {round.categories.map(cat => (
          <div key={cat.id} style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "#9089c0", marginBottom: 4, display: "block" }}>{cat.icon ? `${cat.icon} ` : ""}{cat.label}</span>
            <input style={S.input} value={values[cat.id] || ""} onChange={e => onChange(cat.id, e.target.value)} placeholder={`${round.letter}...`} />
          </div>
        ))}
      </div>
      {round.endMode === "basta" && (
        <Btn variant="danger" onClick={() => send({ type: "call_basta" })}>¡BASTA!</Btn>
      )}
      <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>{round.doneCount} de {room.players.length} jugadores enviaron alguna respuesta</p>
    </div>
  );
}

// ── REVIEW: mark everyone's answers valid/invalid ──
function ReviewPhase({ room, me, isHost, send }) {
  const round = room.round;
  return (
    <div>
      <div style={{ ...S.cardHighlight, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#9089c0", marginBottom: 4 }}>Letra</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: "#AFA9EC", margin: 0 }}>{round.letter}</p>
      </div>
      {room.players.map(player => {
        const answers = round.answers[player.id] || {};
        const hasAny = round.categories.some(cat => answers[cat.id]);
        if (!hasAny) return null;
        return (
          <div key={player.id} style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Avatar name={player.name} size={28} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>{player.name}</span>
            </div>
            {round.categories.map(cat => {
              const word = answers[cat.id];
              if (!word) return null;
              const marksForWord = (round.marks[player.id] || {})[cat.id] || {};
              const isMine = player.id === me.playerId;
              return (
                <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(127,119,221,0.08)" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, color: "#7F77DD" }}>{cat.label}</span>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{word}</p>
                  </div>
                  {!isMine && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => send({ type: "mark_word", targetPlayerId: player.id, categoryId: cat.id, valid: true })}
                        style={{ ...S.btn(marksForWord[me.playerId] === true ? "success" : "secondary"), width: 36, height: 36, padding: 0, borderRadius: 8, fontSize: 16 }}>✓</button>
                      <button onClick={() => send({ type: "mark_word", targetPlayerId: player.id, categoryId: cat.id, valid: false })}
                        style={{ ...S.btn(marksForWord[me.playerId] === false ? "danger" : "secondary"), width: 36, height: 36, padding: 0, borderRadius: 8, fontSize: 16 }}>✗</button>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: -4 }}>
                    {Object.entries(marksForWord).map(([voterId, valid]) => (
                      <span key={voterId} title={playerName(room, voterId)} style={{ fontSize: 11, color: valid ? "#5DCAA5" : "#F09595", marginLeft: 2 }}>
                        {valid ? "✓" : "✗"}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {isHost ? (
        <Btn variant="success" onClick={() => send({ type: "confirm_review" })}>Confirmar puntajes</Btn>
      ) : (
        <p style={{ ...S.muted, textAlign: "center" }}>Esperando que el anfitrión confirme los puntajes</p>
      )}
    </div>
  );
}

// ── RESULT: round breakdown + running standings ──
function ResultPhase({ room, isHost, send }) {
  const round = room.round;
  const standings = [...room.players]
    .map(p => ({ ...p, score: room.config.score[p.id] || 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <div>
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <p style={{ ...S.title, fontSize: 26, display: "block" }}>{round.isFinalRound ? "Fin del juego" : "Puntos de la ronda"}</p>
      </div>
      <div style={S.card}>
        <span style={S.label}>Clasificación</span>
        {standings.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(127,119,221,0.08)" }}>
            <span style={{ fontWeight: 800, color: i === 0 ? "#E2C44A" : "#6b6490", width: 20 }}>{i + 1}</span>
            <Avatar name={p.name} size={30} />
            <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
            <span style={{ fontWeight: 800, color: "#5DCAA5" }}>{p.score} pts</span>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <span style={S.label}>Desglose ({round.letter})</span>
        {room.players.map(player => (
          <div key={player.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Avatar name={player.name} size={24} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>{player.name}</span>
              <span style={{ marginLeft: "auto", fontWeight: 800, color: "#5DCAA5", fontSize: 13 }}>+{round.pointsByPlayer[player.id]} pts</span>
            </div>
            {round.categories.map(cat => {
              const b = (round.breakdown[player.id] || {})[cat.id];
              if (!b || !b.word) return null;
              return (
                <div key={cat.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", color: "#b8b0d4" }}>
                  <span>{cat.label}: {b.word}</span>
                  <span style={{ color: !b.valid ? "#F09595" : b.duplicate ? "#EF9F27" : "#5DCAA5" }}>
                    {!b.valid ? "Inválida" : b.duplicate ? "Repetida (+5)" : "+10"}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {isHost && !round.isFinalRound && <Btn variant="success" onClick={() => send({ type: "start_round" })}>Nueva ronda</Btn>}
      {round.isFinalRound && <p style={{ ...S.muted, textAlign: "center" }}>Se jugaron todas las rondas configuradas.</p>}
    </div>
  );
}

export function RoundView({ room, me, myPlayer, myRole, isHost, send }) {
  if (!room.round) return null;
  if (room.phase === "setup") return <SetupPhase room={room} isHost={isHost} send={send} />;
  if (room.phase === "writing") return <WritingPhase room={room} me={me} myRole={myRole} isHost={isHost} send={send} />;
  if (room.phase === "review") return <ReviewPhase room={room} me={me} isHost={isHost} send={send} />;
  if (room.phase === "result") return <ResultPhase room={room} isHost={isHost} send={send} />;
  return null;
}
