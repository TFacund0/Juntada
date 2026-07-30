import { S } from "../../../theme/styles";

interface RevealOnEliminationControlProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

// "¿Se revela el rol al eliminar a alguien?" — byte-identical between
// LocalGame and ConfigPanel's "Reglas" tab, just wired to a different write
// path (local React state vs a patch sent to the server). Rendered inside
// each caller's own ConfigSection, same as every other rule question.
export function RevealOnEliminationControl({ value, onChange }: RevealOnEliminationControlProps) {
  return (
    <>
      <span style={S.label}>¿Se revela el rol al eliminar a alguien?</span>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={() => onChange(true)}
          style={{ ...S.btn(value ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
        >
          Sí, se revela
        </button>
        <button
          onClick={() => onChange(false)}
          style={{ ...S.btn(!value ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
        >
          No, queda en duda
        </button>
      </div>
      <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
        {value
          ? "Al eliminar a alguien se muestra si era el impostor o no."
          : "Al eliminar a alguien no se revela su rol — sigan jugando con la duda."}
      </p>
    </>
  );
}
