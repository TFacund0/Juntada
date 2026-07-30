import { S } from "../../../theme/styles";
import type { RoundViewProps } from "../../gameTypes";
import type { ChatEntry } from "../types/roundView";

/**
 * Lista de mensajes del chat en vivo (intentos + avisos de acierto).
 *
 * Compartido por la vista de solo-lectura de quien dibuja durante "drawing"
 * y la vista de todos durante "reveal" — el mismo render, solo cambia si
 * debajo hay o no un input para escribir.
 */
export function ChatMessages({ chatLog, players }: { chatLog: ChatEntry[]; players: RoundViewProps["room"]["players"] }) {
  if (chatLog.length === 0) return <p style={{ ...S.muted, margin: "0 0 12px" }}>Todavía no escribió nadie.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, minHeight: 20 }}>
      {chatLog.map((entry, i) => {
        const p = players.find(x => x.id === entry.playerId);
        if (!p) return null;
        return entry.type === "correct" ? (
          <p key={i} style={{ fontSize: 13, color: "#5DCAA5", margin: 0, fontWeight: 700 }}>
            ✓ {p.name} adivinó
          </p>
        ) : (
          <p key={i} style={{ fontSize: 13, color: "#b8b0d4", margin: 0 }}>
            <strong style={{ color: "#AFA9EC" }}>{p.name}:</strong> {entry.text}
          </p>
        );
      })}
    </div>
  );
}
