import { S } from "../../../theme/styles";
import { Btn } from "../../../components/Btn";
import type { RoundViewProps } from "../../gameTypes";
import type { TutifrutiRoundState } from "../types";
import { RoundBadge } from "./RoundBadge";

// ── SETUP: letter draw, host can reroll ──
export function SetupPhase({ room, isHost, send }: Pick<RoundViewProps, "room" | "isHost" | "send">) {
  const round = room.round as TutifrutiRoundState;
  return (
    <div>
      <RoundBadge round={round} />
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
