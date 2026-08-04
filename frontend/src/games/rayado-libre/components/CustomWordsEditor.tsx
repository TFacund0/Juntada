import { useState } from "react";
import { S } from "../../../theme/styles";
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
    <div style={S.card}>
      <span style={S.label}>
        Tus palabras ({words.length}/{MAX_WORDS})
      </span>
      <p style={{ ...S.muted, margin: "4px 0 12px" }}>Sumá las tuyas además de (o en vez de) las categorías predefinidas.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: words.length > 0 ? 12 : 0 }}>
        <input
          style={{ ...S.input, flex: 1 }}
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {words.map(w => (
            <span
              key={w}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 6px 6px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {w}
              <button
                onClick={() => onChange(words.filter(x => x !== w))}
                aria-label={`Quitar "${w}"`}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(255,255,255,0.12)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 11,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
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
