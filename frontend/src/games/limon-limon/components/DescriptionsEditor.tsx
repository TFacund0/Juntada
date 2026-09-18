import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { SUITS, VALUES, cardKey, valueLabel, suitInfo } from "../deck";
import { SuitGlyph } from "./SuitGlyph";

const MAX_LENGTH = 300;
const COMMIT_DELAY_MS = 400;

interface DescriptionsEditorProps {
  descriptions: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

// Cada carta (número + palo) puede tener un significado propio — 40 en
// total — así que se editan agrupadas por palo en pestañas para que no se
// amontonen. Es solo informativo: durante la ronda el grupo elige siempre a
// mano quién come cada carta.
//
// En el modo online, cada onChange termina mandando la config completa de la
// sala a todos los jugadores conectados — hacerlo en cada tecla sería un
// mensaje y un re-render de sala entera por carácter tipeado. Por eso el
// input se actualiza al toque (para que se sienta responsive) pero recién
// dispara `onChange` (y con eso el broadcast) unos milisegundos después de
// que la persona deja de tipear ese campo.
export function DescriptionsEditor({ descriptions, onChange }: DescriptionsEditorProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(SUITS[0].id);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeSuit = suitInfo(tab);

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
    },
    [],
  );

  const handleInput = (key: string, value: string) => {
    setDrafts(d => ({ ...d, [key]: value }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      onChange(key, value);
      setDrafts(d => {
        const { [key]: _discard, ...rest } = d;
        return rest;
      });
    }, COMMIT_DELAY_MS);
  };

  if (!open) {
    return (
      <div className={T.card}>
        <button onClick={() => setOpen(true)} className={clsx(T.btn("ghost"), "w-full")}>
          Modificar significado de las cartas
        </button>
      </div>
    );
  }

  return (
    <div className={T.card}>
      <div className="mb-1 flex items-center justify-between">
        <span className={T.label}>Significado de cada carta (editable)</span>
        <button onClick={() => setOpen(false)} className={clsx(T.btn("ghost"), "w-auto px-3 py-1.5 text-xs")}>
          Cerrar
        </button>
      </div>
      <p className={clsx(T.muted, "-mt-0.5 mb-3.5")}>
        Cada carta (número y palo) puede tener un significado distinto. Es solo una referencia — quién come cada carta se elige siempre
        manualmente.
      </p>

      <div className="mb-4 flex gap-1.5">
        {SUITS.map(s => (
          <button
            key={s.id}
            onClick={() => setTab(s.id)}
            className={clsx(T.btn(tab === s.id ? "primary" : "ghost"), "flex flex-1 items-center justify-center gap-1.5 px-1 py-2 text-xs")}
          >
            <svg width={14} height={14} viewBox="-8 -8 16 16">
              <SuitGlyph suit={s.id} />
            </svg>
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {VALUES.map(value => {
          const key = cardKey(tab, value);
          return (
            <div key={key}>
              <span className="mb-1 block text-xs font-bold" style={{ color: activeSuit.color }}>
                {valueLabel(value)} de {activeSuit.label}
              </span>
              <input
                className={clsx(T.input, "text-[13px]")}
                maxLength={MAX_LENGTH}
                value={drafts[key] ?? descriptions[key] ?? ""}
                onChange={e => handleInput(key, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
