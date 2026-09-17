import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Avatar } from "../../../components/ui/Avatar";
import { StartButton } from "../../../components/setup/StartButton";
import { StickyActionBar, STICKY_ACTION_BAR_CLEARANCE } from "../../../components/setup/StickyActionBar";
import type { RoundViewProps } from "../../gameTypes";
import type { RoomPublicState } from "@juntada/shared-types";
import type { TutifrutiRoundState, TutifrutiAnswerBreakdown } from "../types/roundView";
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
      <div className="py-3 text-center">
        <p className={clsx(T.title, "block text-2xl")}>Puntos de la ronda</p>
      </div>
      <div className={T.card}>
        <span className={T.label}>Clasificación</span>
        {standings.map((p, i) => (
          <div
            key={p.id}
            className="tf-podium-row flex items-center gap-2.5 border-b border-[rgba(127,119,221,0.08)] py-2"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span
              className="w-5 font-extrabold"
              style={{ color: i === 0 ? "var(--jt-warn-text, #E2C44A)" : "var(--jt-muted-text, #6b6490)" }}
            >
              {i + 1}
            </span>
            <Avatar name={p.name} size={30} />
            <span className="flex-1 font-bold">{p.name}</span>
            <span className="mr-2 text-xs text-[#5DCAA5]">+{p.roundPts}</span>
            <span className="font-extrabold text-[#5DCAA5]">{p.score} pts</span>
          </div>
        ))}
      </div>
      <div className={T.card}>
        <span className={T.label}>Desglose ({round.letter})</span>
        {round.categories.map(cat => {
          const entries = room.players
            .map(p => (breakdown[p.id] || {})[cat.id])
            .filter((b): b is TutifrutiAnswerBreakdown => !!b && !!b.word);
          if (entries.length === 0) return null;
          return (
            <div key={cat.id} className="mb-3">
              <span className="text-xs font-bold text-[#7F77DD]">
                {cat.icon ? `${cat.icon} ` : ""}
                {cat.label}
              </span>
              {entries.map((b, i) => (
                <div key={i} className="flex justify-between gap-2.5 py-1 text-[13px] text-[#b8b0d4]">
                  <span className={clsx("min-w-0 break-words [overflow-wrap:anywhere]", !b.valid && "text-[#F09595] line-through")}>
                    {b.word}
                  </span>
                  <span className="shrink-0" style={{ color: !b.valid ? "#F09595" : b.duplicate ? "#EF9F27" : "#5DCAA5" }}>
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
        <p className={clsx(T.muted, "text-center")}>
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
