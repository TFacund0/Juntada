import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";

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
    <div className={T.card}>
      <span className={T.label}>Palabras</span>
      <p className={clsx(T.muted, "mb-2.5 leading-[1.4]")}>
        Escribí la palabra secreta de cada jugador (se define entre todos, en voz alta). Queda oculta — tocá el ojo para revelarla.
      </p>
      {players.map(p => (
        <div key={p.id} className="flex items-center gap-2 mb-2">
          <span className="w-[90px] shrink-0 text-[13px] text-[#b8b0d4] truncate">{p.name}</span>
          <input
            className={clsx(T.input, "flex-1")}
            type={revealed[p.id] ? "text" : "password"}
            value={words[p.id] ?? ""}
            onChange={e => onChange(p.id, e.target.value)}
            placeholder="Ej: Messi, Bombero, Batman..."
          />
          <button
            onClick={() => setRevealed(r => ({ ...r, [p.id]: !r[p.id] }))}
            className={clsx(T.btn("ghost"), "w-10! h-10 p-0 rounded-lg shrink-0")}
          >
            {revealed[p.id] ? "🙈" : "👁️"}
          </button>
        </div>
      ))}
    </div>
  );
}
