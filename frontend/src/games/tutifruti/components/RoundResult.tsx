import { S } from "../../../theme/styles";
import { Avatar } from "../../../components/ui/Avatar";
import { StartButton } from "../../../components/setup/StartButton";
import { StickyActionBar, STICKY_ACTION_BAR_CLEARANCE } from "../../../components/setup/StickyActionBar";
import type { RoundViewProps } from "../../gameTypes";
import type { RoomPublicState } from "@juntada/shared-types";
import type { TutifrutiRoundState, TutifrutiAnswerBreakdown } from "../types";
import { RoundBadge } from "./RoundBadge";

// ── RESULT: round breakdown + running standings ──
export function RoundResult({
  room,
  round,
  isHost,
  onShowFinal,
  send,
}: {
  room: RoomPublicState;
  round: TutifrutiRoundState;
  isHost: boolean;
  onShowFinal: () => void;
  send: RoundViewProps["send"];
}) {
  const score = room.config.score as Record<string, number>;
  const pointsByPlayer = round.pointsByPlayer!;
  const breakdown = round.breakdown!;
  const standings = [...room.players]
    .map(p => ({ ...p, score: score[p.id] || 0, roundPts: pointsByPlayer[p.id] || 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <div style={{ paddingBottom: isHost ? STICKY_ACTION_BAR_CLEARANCE : undefined }}>
      <RoundBadge round={round} />
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <p style={{ ...S.title, fontSize: 26, display: "block" }}>Puntos de la ronda</p>
      </div>
      <div style={S.card}>
        <span style={S.label}>Clasificación</span>
        {standings.map((p, i) => (
          <div
            key={p.id}
            className="tf-podium-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              borderBottom: "1px solid rgba(127,119,221,0.08)",
              animationDelay: `${i * 60}ms`,
            }}
          >
            <span style={{ fontWeight: 800, color: i === 0 ? "var(--jt-warn-text, #E2C44A)" : "var(--jt-muted-text, #6b6490)", width: 20 }}>
              {i + 1}
            </span>
            <Avatar name={p.name} size={30} />
            <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
            <span style={{ fontSize: 12, color: "#5DCAA5", marginRight: 8 }}>+{p.roundPts}</span>
            <span style={{ fontWeight: 800, color: "#5DCAA5" }}>{p.score} pts</span>
          </div>
        ))}
      </div>
      <div style={S.card}>
        <span style={S.label}>Desglose ({round.letter})</span>
        {round.categories.map(cat => {
          const entries = room.players
            .map(p => (breakdown[p.id] || {})[cat.id])
            .filter((b): b is TutifrutiAnswerBreakdown => !!b && !!b.word);
          if (entries.length === 0) return null;
          return (
            <div key={cat.id} style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "#7F77DD", fontWeight: 700 }}>
                {cat.icon ? `${cat.icon} ` : ""}
                {cat.label}
              </span>
              {entries.map((b, i) => (
                <div
                  key={i}
                  style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "4px 0", color: "#b8b0d4" }}
                >
                  <span
                    style={{
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                      minWidth: 0,
                      color: !b.valid ? "#F09595" : undefined,
                      textDecoration: !b.valid ? "line-through" : undefined,
                    }}
                  >
                    {b.word}
                  </span>
                  <span style={{ flexShrink: 0, color: !b.valid ? "#F09595" : b.duplicate ? "#EF9F27" : "#5DCAA5" }}>
                    {b.wrongLetter
                      ? `No empieza con "${round.letter}"`
                      : !b.valid
                        ? "Inválida"
                        : b.duplicate
                          ? `Repetida (+${b.points})`
                          : `+${b.points}`}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {!isHost && (
        <p style={{ ...S.muted, textAlign: "center" }}>
          {round.isFinalRound
            ? "Se jugaron todas las rondas configuradas — esperando al anfitrión."
            : "Esperando a que el anfitrión inicie una nueva ronda..."}
        </p>
      )}
      {isHost && (
        <StickyActionBar>
          {round.isFinalRound ? (
            <StartButton className="jt-btn-anim tf-startbtn-pulse" onClick={onShowFinal}>
              Ver resultados finales
            </StartButton>
          ) : (
            <StartButton className="jt-btn-anim tf-startbtn-pulse" onClick={() => send({ type: "start_round" })}>
              Nueva ronda
            </StartButton>
          )}
        </StickyActionBar>
      )}
    </div>
  );
}
