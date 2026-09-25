import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
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
  /** Sin la card propia — para cuando ya va dentro de la columna del chat de la pantalla de dibujo (ver DrawingStage). */
  bare?: boolean;
}

/**
 * Cuadrante de chat compartido por dibujante (solo lectura) y adivinadores
 * (con input al pie) durante "drawing", y reusado como recap completo en
 * "reveal" — mismo componente, solo cambia qué tanto del log se muestra.
 * Las entradas de tipo "correct" no se listan acá (ya se ven arriba, en la
 * fila de chips de quién acertó) — este feed es solo lo que la gente
 * efectivamente escribió.
 */
export function GuessChatPanel({
  chatLog,
  players,
  correctGuessers,
  roundPoints,
  variant = "live",
  input,
  bare = false,
}: GuessChatPanelProps) {
  const messages = chatLog.filter(e => e.type !== "correct");
  const visible = variant === "live" ? messages.slice(-5) : messages;

  return (
    <div className={bare ? "p-3" : T.card}>
      {variant === "live" && correctGuessers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {correctGuessers.map(id => {
            const p = players.find(x => x.id === id);
            if (!p) return null;
            return (
              <div key={id} className={clsx(T.pill(true), p.online ? "opacity-100" : "opacity-[0.55]")}>
                ✓ {p.name} · +{roundPoints[id] ?? 0}
              </div>
            );
          })}
        </div>
      )}
      <span className={T.label}>{input ? "Chat — escribí tu respuesta" : "Chat — lo que van escribiendo"}</span>
      {visible.length === 0 ? (
        <p className={clsx(T.muted, "mb-3")}>Todavía no escribió nadie.</p>
      ) : (
        <div className="flex flex-col gap-1.5 mb-2.5 min-h-5">
          {visible.map((entry, i) => {
            const p = players.find(x => x.id === entry.playerId);
            if (!p) return null;
            return (
              <p key={i} className="text-[13px] text-[#b8b0d4]">
                <strong className="text-[#AFA9EC]">{p.name}:</strong> {entry.text}
              </p>
            );
          })}
        </div>
      )}
      {input &&
        (input.disabledReason ? (
          <p className={clsx(T.muted, "text-center")}>{input.disabledReason}</p>
        ) : (
          // flex-wrap + min-w: mismo motivo que el resto de los inputs+botón
          // de esta app — sin esto, el botón "Enviar" le come el ancho al
          // input en un contenedor angosto.
          <div className="flex flex-wrap gap-2">
            <input
              className={clsx(T.input, "min-w-[140px] flex-1")}
              placeholder="Tu respuesta..."
              value={input.value}
              onChange={e => input.onChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") input.onSubmit();
              }}
            />
            {/* `!`: pisa el ancho completo y el padding de la variante base de Btn. */}
            <Btn onClick={input.onSubmit} className="w-auto! px-[18px]! py-[11px]!">
              Enviar
            </Btn>
          </div>
        ))}
    </div>
  );
}
