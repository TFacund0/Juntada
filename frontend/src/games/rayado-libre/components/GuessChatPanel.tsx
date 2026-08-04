import { S } from "../../../theme/styles";
import { Btn } from "../../../components/ui/Btn";
import type { RoundViewProps } from "../../gameTypes";
import type { ChatEntry } from "../types/roundView";

interface GuessChatPanelProps {
  chatLog: ChatEntry[];
  players: RoundViewProps["room"]["players"];
  correctGuessers: string[];
  roundPoints: Record<string, number>;
  /** "live" trunca a las últimas 5 entradas y suma arriba los aciertos en
   * chips (drawing); "recap" muestra el log completo tal cual, sin nada más
   * arriba — en "reveal" quién está listo ya se ve en `RoundScoreboard`. */
  variant?: "live" | "recap";
  /** Presente = rol adivinador (muestra el campo de texto); ausente = solo lectura (dibujante). */
  input?: {
    value: string;
    onChange: (text: string) => void;
    onSubmit: () => void;
    disabledReason?: string;
  };
}

/**
 * Cuadrante de chat compartido por dibujante (solo lectura) y adivinadores
 * (con input al pie) durante "drawing", y reusado como recap completo en
 * "reveal" — mismo componente, solo cambia qué tanto del log se muestra.
 * Las entradas de tipo "correct" no se listan acá (ya se ven arriba, en la
 * fila de chips de quién acertó) — este feed es solo lo que la gente
 * efectivamente escribió.
 */
export function GuessChatPanel({ chatLog, players, correctGuessers, roundPoints, variant = "live", input }: GuessChatPanelProps) {
  const messages = chatLog.filter(e => e.type !== "correct");
  const visible = variant === "live" ? messages.slice(-5) : messages;

  return (
    <div style={S.card}>
      {variant === "live" && correctGuessers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {correctGuessers.map(id => {
            const p = players.find(x => x.id === id);
            if (!p) return null;
            return (
              <div key={id} style={{ ...S.pill(true), opacity: p.online ? 1 : 0.55 }}>
                ✓ {p.name} · +{roundPoints[id] ?? 0}
              </div>
            );
          })}
        </div>
      )}
      <span style={S.label}>{input ? "Chat — escribí tu respuesta" : "Chat — lo que van escribiendo"}</span>
      {visible.length === 0 ? (
        <p style={{ ...S.muted, margin: "0 0 12px" }}>Todavía no escribió nadie.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, minHeight: 20 }}>
          {visible.map((entry, i) => {
            const p = players.find(x => x.id === entry.playerId);
            if (!p) return null;
            return (
              <p key={i} style={{ fontSize: 13, color: "#b8b0d4", margin: 0 }}>
                <strong style={{ color: "#AFA9EC" }}>{p.name}:</strong> {entry.text}
              </p>
            );
          })}
        </div>
      )}
      {input &&
        (input.disabledReason ? (
          <p style={{ ...S.muted, textAlign: "center" }}>{input.disabledReason}</p>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...S.input, flex: 1 }}
              placeholder="Tu respuesta..."
              value={input.value}
              onChange={e => input.onChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") input.onSubmit();
              }}
            />
            <Btn onClick={input.onSubmit} style={{ width: "auto", padding: "11px 18px" }}>
              Enviar
            </Btn>
          </div>
        ))}
    </div>
  );
}
