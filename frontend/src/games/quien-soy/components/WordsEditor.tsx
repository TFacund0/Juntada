import { useState } from "react";
import { S } from "../../../theme/styles";

interface Player {
  id: string;
  name: string;
}

// Local pass-and-play's word entry: the group agrees out loud on a word for
// each player and types it in directly — no categories, no suggest/vote
// round-trip (that's the online-only flow, see WordSourceConfig). Every
// field stays masked by default so it doesn't spoil anything at a glance,
// but each row has its own reveal toggle for whenever someone needs to
// double-check what they wrote.
export function WordsEditor({
  players,
  words,
  onChange,
}: {
  players: Player[];
  words: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div style={S.card}>
      <span style={S.label}>Palabras</span>
      <p style={{ ...S.muted, margin: "0 0 10px", lineHeight: 1.4 }}>
        Escribí la palabra secreta de cada jugador (se define entre todos, en voz alta). Queda oculta — tocá el ojo para revelarla.
      </p>
      {players.map(p => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span
            style={{
              width: 90,
              flexShrink: 0,
              fontSize: 13,
              color: "#b8b0d4",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.name}
          </span>
          <input
            style={{ ...S.input, flex: 1 }}
            type={revealed[p.id] ? "text" : "password"}
            value={words[p.id] ?? ""}
            onChange={e => onChange(p.id, e.target.value)}
            placeholder="Ej: Messi, Bombero, Batman..."
          />
          <button
            onClick={() => setRevealed(r => ({ ...r, [p.id]: !r[p.id] }))}
            style={{ ...S.btn("ghost"), width: 40, height: 40, padding: 0, borderRadius: 8, flexShrink: 0 }}
          >
            {revealed[p.id] ? "🙈" : "👁️"}
          </button>
        </div>
      ))}
    </div>
  );
}
