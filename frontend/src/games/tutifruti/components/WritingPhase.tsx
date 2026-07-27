import { useState, useEffect, useRef } from "react";
import { S } from "../../../theme/styles";
import { Btn } from "../../../components/Btn";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import type { RoundViewProps } from "../../gameTypes";
import type { TutifrutiRoundState, TutifrutiPrivateRole } from "../types";
import { RoundBadge } from "./RoundBadge";
import { useCountdown } from "./useCountdown";

// ── WRITING: fill in categories against the clock or until "basta" ──
export function WritingPhase({
  room,
  myPlayer,
  myRole,
  send,
}: Pick<RoundViewProps, "room" | "me" | "myPlayer" | "myRole" | "isHost" | "send">) {
  const round = room.round as TutifrutiRoundState;
  const role = myRole as TutifrutiPrivateRole | null;
  const timeLeft = useCountdown(round.endMode === "timer" ? round.timerEnd : null);
  // Only "Ya terminé" (timer mode) locks answers — basta mode has no
  // individual confirm step, everyone keeps typing until someone calls
  // "¡BASTA!" for the whole table.
  const locked = !!myPlayer?.ready;
  const [values, setValues] = useState<Record<string, string>>(() => role?.myAnswers || {});
  // Keyed per category — a single shared timer/pending-value would let
  // typing in category B cancel category A's still-pending debounce (via
  // the old clearTimeout) without ever resending it, silently dropping A's
  // answer the moment you moved on to fill in something else, well before
  // ever touching "Ya terminé".
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Tracks whatever hasn't been sent yet per category, so "Ya terminé" can
  // flush it immediately instead of leaving the last word(s) typed
  // unsubmitted — the backend rejects any submit_answers once ready is set
  // (see engine.ts), so without this the last category typed right before
  // confirming would silently score 0 with no feedback that it never saved.
  const pendingRef = useRef<Record<string, string>>({});
  const letterRef = useRef(round.letter);
  const onlinePlayers = room.players.filter(p => p.online);
  const readyCount = onlinePlayers.filter(p => p.ready).length;
  const [confirmBasta, setConfirmBasta] = useState(false);

  useEffect(() => {
    if (letterRef.current !== round.letter) {
      letterRef.current = round.letter;
      setValues(role?.myAnswers || {});
      // A new round means whatever was still pending from the previous
      // letter is moot — its categories don't even exist anymore.
      Object.values(debounceRefs.current).forEach(clearTimeout);
      debounceRefs.current = {};
      pendingRef.current = {};
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.letter]);

  const onChange = (catId: string, word: string) => {
    const next = { ...values, [catId]: word };
    setValues(next);
    pendingRef.current[catId] = word;
    if (debounceRefs.current[catId]) clearTimeout(debounceRefs.current[catId]);
    debounceRefs.current[catId] = setTimeout(() => {
      send({ type: "submit_answers", answers: { [catId]: word } });
      delete pendingRef.current[catId];
      delete debounceRefs.current[catId];
    }, 400);
  };

  // Skips the debounce and sends whatever's still pending right now (every
  // category with an in-flight edit, not just the last one touched),
  // instead of letting "Ya terminé" race it (see player_ready's onClick).
  const flushPending = () => {
    Object.values(debounceRefs.current).forEach(clearTimeout);
    debounceRefs.current = {};
    if (Object.keys(pendingRef.current).length > 0) {
      send({ type: "submit_answers", answers: { ...pendingRef.current } });
      pendingRef.current = {};
    }
  };

  useEffect(() => () => flushPending(), []);

  return (
    <div>
      <RoundBadge round={round} />
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
        {round.categories.map(cat => (
          <div key={cat.id} style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "#9089c0", marginBottom: 4, display: "block" }}>
              {cat.icon ? `${cat.icon} ` : ""}
              {cat.label}
            </span>
            <input
              style={{ ...S.input, opacity: locked ? 0.5 : 1 }}
              value={values[cat.id] || ""}
              onChange={e => onChange(cat.id, e.target.value)}
              placeholder={`${round.letter}...`}
              disabled={locked}
            />
          </div>
        ))}
      </div>
      {round.endMode === "basta" && (
        <Btn variant="danger" onClick={() => setConfirmBasta(true)}>
          ¡BASTA!
        </Btn>
      )}
      {confirmBasta && (
        <ConfirmDialog
          title="¿Gritar BASTA?"
          message={`Corta la ronda para todos ahora mismo — ${round.doneCount ?? 0} de ${room.players.length} ya enviaron alguna respuesta. Nadie más va a poder seguir escribiendo.`}
          confirmLabel="¡BASTA!"
          onConfirm={() => {
            setConfirmBasta(false);
            flushPending();
            send({ type: "call_basta" });
          }}
          onCancel={() => setConfirmBasta(false)}
        />
      )}
      {round.endMode === "timer" &&
        (myPlayer?.ready ? (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#5DCAA5", margin: 0 }}>Marcaste que ya terminaste — esperando a los demás</p>
          </div>
        ) : (
          <Btn
            variant="success"
            onClick={() => {
              flushPending();
              send({ type: "player_ready" });
            }}
          >
            Ya terminé
          </Btn>
        ))}
      {/* Timer mode already reports progress via readyCount right below "Ya
          terminé" — showing doneCount too said almost the same thing twice
          ("enviaron alguna respuesta" vs "ya terminaron"). Basta mode has no
          ready concept, so doneCount is its only progress indicator. */}
      {round.endMode === "timer" ? (
        <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>
          {readyCount} de {onlinePlayers.length} jugadores ya terminaron
        </p>
      ) : (
        <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>
          {round.doneCount} de {room.players.length} jugadores enviaron alguna respuesta
        </p>
      )}
    </div>
  );
}
