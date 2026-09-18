import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Btn } from "../../../components/ui/Btn";

const MAX_WORD_LENGTH = 30;
// Coincide con el tope `.max(50)` que ya aplica `configValue` en
// @juntada/shared-types (SCHEMAS.update_config) — evita mandar un patch que
// el servidor va a rechazar igual, mostrando el límite antes en vez de
// después.
const MAX_WORDS = 50;

interface CustomWordsEditorProps {
  words: string[];
  onChange: (next: string[]) => void;
}

/**
 * Lista editable de palabras propias del anfitrión, sumadas al pool de las
 * categorías activas (ver `pickThreeWords` en `LocalGame.tsx` y
 * `engine.ts`) — a diferencia de `DescriptionsEditor` (edita valores de
 * claves ya fijas, con debounce por tipeo), acá cada alta/baja es una
 * acción discreta del usuario, así que no hace falta debounce.
 */
export function CustomWordsEditor({ words, onChange }: CustomWordsEditorProps) {
  const [draft, setDraft] = useState("");

  const addWord = () => {
    const trimmed = draft.trim().slice(0, MAX_WORD_LENGTH);
    if (!trimmed || words.length >= MAX_WORDS || words.includes(trimmed)) return;
    onChange([...words, trimmed]);
    setDraft("");
  };

  return (
    <div className={T.card}>
      <span className={T.label}>
        Tus palabras ({words.length}/{MAX_WORDS})
      </span>
      <p className={clsx(T.muted, "mt-1 mb-3")}>Sumá las tuyas además de (o en vez de) las categorías predefinidas.</p>
      <div className={clsx("flex gap-2", words.length > 0 ? "mb-3" : "mb-0")}>
        <input
          className={clsx(T.input, "flex-1")}
          placeholder="Escribí una palabra o frase corta"
          maxLength={MAX_WORD_LENGTH}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") addWord();
          }}
        />
        <Btn variant="ghost" onClick={addWord} style={{ width: "auto", padding: "11px 18px" }}>
          Agregar
        </Btn>
      </div>
      {words.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {words.map(w => (
            <span
              key={w}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/[0.12] py-1.5 pr-1.5 pl-3 text-[13px] font-semibold"
            >
              {w}
              <button
                onClick={() => onChange(words.filter(x => x !== w))}
                aria-label={`Quitar "${w}"`}
                className="w-[18px] h-[18px] rounded-full border-none bg-white/[0.12] text-white cursor-pointer text-[11px] leading-none flex items-center justify-center"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
