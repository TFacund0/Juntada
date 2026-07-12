import { useState, useEffect, useRef } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import { RevealCountdown, useRevealCountdown } from "../../components/RevealCountdown";
import type { RoundViewProps } from "../gameTypes";

// Same accent/case-insensitive normalization the backend uses to decide
// whether a word actually starts with the round's letter.
function normalizeWord(word: string | undefined): string {
  return (word || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function startsWithLetter(word: string, letter: string): boolean {
  const w = normalizeWord(word);
  return !w || w.startsWith(normalizeWord(letter));
}

function useCountdown(timerEnd: number | null): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!timerEnd) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [timerEnd]);
  if (!timerEnd) return null;
  return Math.max(0, Math.ceil((timerEnd - now) / 1000));
}

// ── SETUP: letter draw, host can reroll ──
function SetupPhase({ room, isHost, send }: Pick<RoundViewProps, "room" | "isHost" | "send">) {
  const round = room.round as any;
  return (
    <div>
      <div style={{ ...S.cardHighlight, textAlign: "center", padding: "36px 20px" }}>
        <p style={{ fontSize: 13, color: "#9089c0", marginBottom: 8 }}>La letra es...</p>
        <p style={{ fontSize: 64, fontWeight: 800, color: "#AFA9EC", margin: 0, lineHeight: 1 }}>{round.letter}</p>
        {round.rerollsUsed > 0 && (
          <p style={{ ...S.muted, marginTop: 10 }}>
            Letra cambiada {round.rerollsUsed} {round.rerollsUsed === 1 ? "vez" : "veces"}
          </p>
        )}
      </div>
      {isHost ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn onClick={() => send({ type: "confirm_letter" })}>Confirmar y empezar</Btn>
          <Btn variant="ghost" onClick={() => send({ type: "confirm_letter", reroll: true })}>
            🔀 Cambiar letra
          </Btn>
        </div>
      ) : (
        <p style={{ ...S.muted, textAlign: "center" }}>Esperando que el anfitrión confirme la letra...</p>
      )}
    </div>
  );
}

// ── WRITING: fill in categories against the clock or until "basta" ──
function WritingPhase({ room, myPlayer, myRole, send }: Pick<RoundViewProps, "room" | "me" | "myPlayer" | "myRole" | "isHost" | "send">) {
  const round = room.round as any;
  const timeLeft = useCountdown(round.endMode === "timer" ? round.timerEnd : null);
  const [values, setValues] = useState<Record<string, string>>(() => (myRole as any)?.myAnswers || {});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const letterRef = useRef(round.letter);
  const onlinePlayers = room.players.filter(p => p.online);
  const readyCount = onlinePlayers.filter(p => p.ready).length;

  useEffect(() => {
    if (letterRef.current !== round.letter) {
      letterRef.current = round.letter;
      setValues((myRole as any)?.myAnswers || {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.letter]);

  const onChange = (catId: string, word: string) => {
    const next = { ...values, [catId]: word };
    setValues(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      send({ type: "submit_answers", answers: { [catId]: word } });
    }, 400);
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

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
            <span style={{ fontSize: 20, fontWeight: 800, color: timeLeft < 15 ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5" }}>
              {timeLeft}s
            </span>
          </div>
        </div>
      )}
      <div style={S.card}>
        <span style={S.label}>Completá con la letra "{round.letter}"</span>
        {round.categories.map((cat: any) => (
          <div key={cat.id} style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "#9089c0", marginBottom: 4, display: "block" }}>
              {cat.icon ? `${cat.icon} ` : ""}
              {cat.label}
            </span>
            <input
              style={S.input}
              value={values[cat.id] || ""}
              onChange={e => onChange(cat.id, e.target.value)}
              placeholder={`${round.letter}...`}
            />
          </div>
        ))}
      </div>
      {round.endMode === "basta" && (
        <Btn variant="danger" onClick={() => send({ type: "call_basta" })}>
          ¡BASTA!
        </Btn>
      )}
      {round.endMode === "timer" &&
        (myPlayer?.ready ? (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#5DCAA5", margin: 0 }}>Marcaste que ya terminaste — esperando a los demás</p>
          </div>
        ) : (
          <Btn variant="success" onClick={() => send({ type: "player_ready" })}>
            Ya terminé
          </Btn>
        ))}
      {round.endMode === "timer" && (
        <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>
          {readyCount} de {onlinePlayers.length} jugadores ya terminaron
        </p>
      )}
      <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>
        {round.doneCount} de {room.players.length} jugadores enviaron alguna respuesta
      </p>
    </div>
  );
}

// ── REVIEW: mark everyone's answers valid/invalid, grouped by category and
// without showing who wrote each word — just the word and the votes on it.
// Everyone (including the word's own author) can vote on any word, and every
// player has to confirm before the round's scores get tallied.
function ReviewPhase({ room, me, send }: Pick<RoundViewProps, "room" | "me" | "send">) {
  const round = room.round as any;
  const online = room.players.filter(p => p.online);
  const confirmedCount = online.filter(p => round.reviewConfirmed?.[p.id]).length;
  const iConfirmed = !!me && !!round.reviewConfirmed?.[me.playerId];

  return (
    <div>
      <div style={{ ...S.cardHighlight, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#9089c0", marginBottom: 4 }}>Letra</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: "#AFA9EC", margin: 0 }}>{round.letter}</p>
      </div>
      {round.categories.map((cat: any) => {
        const entries = room.players.map(p => ({ playerId: p.id, word: (round.answers[p.id] || {})[cat.id] })).filter(e => e.word);
        if (entries.length === 0) return null;
        return (
          <div key={cat.id} style={S.card}>
            <span style={S.label}>
              {cat.icon ? `${cat.icon} ` : ""}
              {cat.label}
            </span>
            {entries.map(({ playerId, word }) => {
              const marksForWord = (round.marks[playerId] || {})[cat.id] || {};
              const wrongLetter = !startsWithLetter(word, round.letter);
              return (
                <div
                  key={playerId}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid rgba(127,119,221,0.08)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, wordBreak: "break-word", overflowWrap: "anywhere" }}>{word}</p>
                    {wrongLetter && (
                      <span style={{ fontSize: 11, color: "#F09595", fontWeight: 700 }}>✗ no empieza con "{round.letter}" — no cuenta</span>
                    )}
                  </div>
                  {/* Fixed-width tally column to the left of our own vote buttons, so
                      the buttons never shift position as votes come in. */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 2, width: 46, justifyContent: "flex-end", flexShrink: 0 }}>
                    {Object.values(marksForWord).map((valid: any, i: number) => (
                      <span key={i} style={{ fontSize: 11, color: valid ? "#5DCAA5" : "#F09595" }}>
                        {valid ? "✓" : "✗"}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => send({ type: "mark_word", targetPlayerId: playerId, categoryId: cat.id, valid: true })}
                      style={{
                        ...S.btn(me && marksForWord[me.playerId] === true ? "success" : "ghost"),
                        width: 36,
                        height: 36,
                        padding: 0,
                        borderRadius: 8,
                        fontSize: 16,
                      }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => send({ type: "mark_word", targetPlayerId: playerId, categoryId: cat.id, valid: false })}
                      style={{
                        ...S.btn(me && marksForWord[me.playerId] === false ? "danger" : "ghost"),
                        width: 36,
                        height: 36,
                        padding: 0,
                        borderRadius: 8,
                        fontSize: 16,
                      }}
                    >
                      ✗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {iConfirmed ? (
        <div style={{ ...S.card, textAlign: "center" }}>
          <p style={{ color: "#5DCAA5", margin: 0 }}>
            Confirmaste los puntajes — esperando a los demás ({confirmedCount}/{online.length})
          </p>
        </div>
      ) : (
        <Btn variant="success" onClick={() => send({ type: "confirm_review" })}>
          Confirmar puntajes ({confirmedCount}/{online.length})
        </Btn>
      )}
    </div>
  );
}

// ── RESULT: round breakdown + running standings ──
function ResultPhase({ room, isHost, send }: Pick<RoundViewProps, "room" | "isHost" | "send">) {
  const round = room.round as any;
  const revealCount = useRevealCountdown(room.roundHistory?.length ?? 0);
  const score = room.config.score as Record<string, number>;
  const standings = [...room.players]
    .map(p => ({ ...p, score: score[p.id] || 0, roundPts: round.pointsByPlayer[p.id] || 0 }))
    .sort((a, b) => b.score - a.score);

  if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando puntajes..." />;

  return (
    <div>
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <p style={{ ...S.title, fontSize: 26, display: "block" }}>{round.isFinalRound ? "Fin del juego" : "Puntos de la ronda"}</p>
      </div>
      <div style={S.card}>
        <span style={S.label}>Clasificación</span>
        {standings.map((p, i) => (
          <div
            key={p.id}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(127,119,221,0.08)" }}
          >
            <span style={{ fontWeight: 800, color: i === 0 ? "#E2C44A" : "#6b6490", width: 20 }}>{i + 1}</span>
            <Avatar name={p.name} size={30} />
            <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
            <span style={{ fontSize: 12, color: "#5DCAA5", marginRight: 8 }}>+{p.roundPts}</span>
            <span style={{ fontWeight: 800, color: "#5DCAA5" }}>{p.score} pts</span>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <span style={S.label}>Desglose ({round.letter})</span>
        {round.categories.map((cat: any) => {
          const entries = room.players.map(p => (round.breakdown[p.id] || {})[cat.id]).filter((b: any) => b && b.word);
          if (entries.length === 0) return null;
          return (
            <div key={cat.id} style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "#7F77DD", fontWeight: 700 }}>
                {cat.icon ? `${cat.icon} ` : ""}
                {cat.label}
              </span>
              {entries.map((b: any, i: number) => (
                <div
                  key={i}
                  style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "4px 0", color: "#b8b0d4" }}
                >
                  <span style={{ wordBreak: "break-word", overflowWrap: "anywhere", minWidth: 0 }}>{b.word}</span>
                  <span style={{ flexShrink: 0, color: !b.valid ? "#F09595" : b.duplicate ? "#EF9F27" : "#5DCAA5" }}>
                    {b.wrongLetter ? `No empieza con "${round.letter}"` : !b.valid ? "Inválida" : b.duplicate ? "Repetida (+5)" : "+10"}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {isHost && !round.isFinalRound && (
        <Btn variant="success" onClick={() => send({ type: "start_round" })}>
          Nueva ronda
        </Btn>
      )}
      {round.isFinalRound && <p style={{ ...S.muted, textAlign: "center" }}>Se jugaron todas las rondas configuradas.</p>}
    </div>
  );
}

export function RoundView({ room, me, myPlayer, myRole, isHost, send }: RoundViewProps) {
  if (!room.round) return null;
  if (room.phase === "setup") return <SetupPhase room={room} isHost={isHost} send={send} />;
  if (room.phase === "writing") return <WritingPhase room={room} me={me} myPlayer={myPlayer} myRole={myRole} isHost={isHost} send={send} />;
  if (room.phase === "review") return <ReviewPhase room={room} me={me} send={send} />;
  if (room.phase === "result") return <ResultPhase room={room} isHost={isHost} send={send} />;
  return null;
}
