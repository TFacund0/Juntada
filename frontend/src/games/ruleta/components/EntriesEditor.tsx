import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Btn } from "../../../components/ui/Btn";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { useFlashError } from "../../../hooks/ui/useFlashError";

export interface RuletaEntry<Id> {
  id: Id;
  name: string;
  description: string;
}

interface EntriesEditorProps<Id> {
  entries: RuletaEntry<Id>[];
  onAdd: (name: string, description: string) => void;
  onRemove: (id: Id) => void;
}

// Past this many entries the wheel's slices get too thin to read (labels
// already shrink and truncate well before this) — a soft cap keeps the
// wheel actually usable instead of turning into an unreadable pinwheel.
const MAX_ENTRIES = 24;
// Matches RoundView.tsx's/LocalGame.tsx's own wheel-label truncation, so the
// setup list previews names exactly as they'll actually appear on the wheel
// instead of only discovering the cutoff once the wheel's already spinning.
const WHEEL_LABEL_MAX = 14;

function wheelLabel(name: string): string {
  return name.length > WHEEL_LABEL_MAX ? `${name.slice(0, WHEEL_LABEL_MAX - 1)}…` : name;
}

// The entries list + add form — identical between the online ConfigPanel
// (host loads entries for the room, ids are server-assigned strings) and
// local mode (single device, ids are Date.now() numbers). Generic over the
// id type so both can reuse this without a cast.
export function EntriesEditor<Id>({ entries, onAdd, onRemove }: EntriesEditorProps<Id>) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [error, errorKey, setError] = useFlashError();

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (entries.length >= MAX_ENTRIES) {
      setError(`Máximo ${MAX_ENTRIES} entradas — con más, la rueda deja de ser legible`);
      return;
    }
    // Two slices with the same name are indistinguishable on the wheel and
    // in the elimination/stats lists — not blocked outright (a host might
    // genuinely want two identical dares), just flagged so it's a choice,
    // not a surprise discovered mid-game.
    if (entries.some(e => e.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setError("Ya hay una entrada con ese nombre — va a ser difícil distinguirlas en la rueda");
      return;
    }
    onAdd(trimmed, desc.trim());
    setName("");
    setDesc("");
  };

  return (
    <div className={T.card}>
      <span className={T.label}>Entradas ({entries.length})</span>
      {entries.map(e => (
        <div key={String(e.id)} className="flex items-start gap-2 mb-2.5">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" title={e.name.length > WHEEL_LABEL_MAX ? e.name : undefined}>
              {wheelLabel(e.name)}
            </p>
            {e.description && <p className="mt-0.5 text-xs text-[#9089c0]">{e.description}</p>}
          </div>
          <button onClick={() => onRemove(e.id)} className={clsx(T.btn("danger"), "w-8! h-8 p-0 rounded-lg shrink-0")}>
            ×
          </button>
        </div>
      ))}

      <input
        className={clsx(T.input, "mb-2")}
        placeholder="Nombre (ej: Juan, o 'Prenda 1')"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) submit();
        }}
      />
      <textarea
        className={clsx(T.input, "mb-2 resize-y min-h-[60px]")}
        placeholder="Descripción / castigo (opcional)"
        value={desc}
        onChange={e => setDesc(e.target.value)}
      />
      <Btn variant="ghost" onClick={submit}>
        Agregar a la ruleta
      </Btn>
      <ErrorBanner message={error} flashKey={errorKey} variant="inline" />
      {entries.length < 2 && <p className={clsx(T.muted, "text-center mt-2")}>Cargá al menos 2 entradas</p>}
    </div>
  );
}
