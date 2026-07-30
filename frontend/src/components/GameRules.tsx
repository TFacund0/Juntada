import { S } from "../theme/styles";
import { DialogFrame } from "./DialogFrame";

interface GameRulesProps {
  rules?: string[];
  onClose: () => void;
}

/**
 * Renderiza el campo `rules` de un juego (ver `games/registry.ts`) — un
 * array plano de strings, un párrafo por entrada, donde una entrada que
 * empieza con "- " se suma a la tanda anterior de bullets dentro de un
 * `<ul>`. No hace falta un parser de markdown para algo tan simple, y cada
 * juego solo escribe oraciones planas.
 *
 * Se muestra como diálogo modal (mismo `DialogFrame` que `ConfirmDialog`/
 * `QRDialog`) en vez de un bloque más dentro de la página — antes quedaba
 * intercalado entre el header y el juego en curso, empujando todo hacia
 * abajo y mezclándose visualmente con la partida en pantalla.
 */
export function GameRules({ rules, onClose }: GameRulesProps) {
  if (!rules || rules.length === 0) return null;

  const blocks: (string | string[])[] = [];
  for (const line of rules) {
    if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (Array.isArray(last)) last.push(line.slice(2));
      else blocks.push([line.slice(2)]);
    } else {
      blocks.push(line);
    }
  }

  return (
    <DialogFrame onClose={onClose} maxWidth={420} cardStyle={{ maxHeight: "80vh", overflowY: "auto" }} textAlign="left">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={S.label}>Cómo se juega</span>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{ background: "none", border: "none", color: "var(--jt-muted-text)", cursor: "pointer", fontSize: 20, lineHeight: 1 }}
        >
          ✕
        </button>
      </div>
      {blocks.map((block, i) =>
        Array.isArray(block) ? (
          <ul key={i} style={{ margin: "0 0 10px", paddingLeft: 18 }}>
            {block.map((item, j) => (
              <li key={j} style={{ fontSize: 13, color: "var(--jt-muted-text)", marginBottom: 4, lineHeight: 1.4 }}>
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} style={{ fontSize: 13, color: "var(--jt-muted-text)", margin: "0 0 10px", lineHeight: 1.5 }}>
            {block}
          </p>
        ),
      )}
    </DialogFrame>
  );
}
