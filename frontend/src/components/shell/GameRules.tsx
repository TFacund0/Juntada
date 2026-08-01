import { DialogFrame } from "../dialogs/DialogFrame";
import { CloseIcon } from "../ui/icons";
import "./GameRules.css";

interface GameRulesProps {
  rules?: string[];
  onClose: () => void;
}

function BookIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

/**
 * Renderiza el campo `rules` de un juego (ver `games/registry.ts`) — un
 * array plano de strings, un párrafo por entrada, donde una entrada que
 * empieza con "- " se suma a la tanda anterior de bullets dentro de un
 * `<ul>`. No hace falta un parser de markdown para algo tan simple, y cada
 * juego solo escribe oraciones planas.
 *
 * Cada párrafo suelto se muestra como un paso numerado (ver GameRules.css)
 * en vez de solo texto plano seguido — le da a la lista de reglas la misma
 * sensación de "guía paso a paso" que ya tienen los onboardings del resto
 * de la app, en vez de un bloque de texto sin jerarquía.
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

  let stepNumber = 0;

  return (
    <DialogFrame
      onClose={onClose}
      maxWidth={420}
      cardStyle={{ maxHeight: "80vh", overflowY: "auto" }}
      cardClassName="jt-rules-card jt-card-glow"
      textAlign="left"
    >
      <div className="jt-rules-header">
        <div className="jt-rules-badge">
          <BookIcon />
        </div>
        <h2 className="jt-rules-title">Cómo se juega</h2>
        <button onClick={onClose} aria-label="Cerrar" className="jt-close-chip">
          <CloseIcon size={14} />
        </button>
      </div>
      {blocks.map((block, i) =>
        Array.isArray(block) ? (
          <ul key={i} className="jt-rules-bullets">
            {block.map((item, j) => (
              <li key={j} className="jt-rules-bullet-item">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <div key={i} className="jt-rules-step">
            <span className="jt-rules-step-num">{++stepNumber}</span>
            <p className="jt-rules-step-text">{block}</p>
          </div>
        ),
      )}
    </DialogFrame>
  );
}
