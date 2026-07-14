import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";

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

// The entries list + add form — identical between the online ConfigPanel
// (host loads entries for the room, ids are server-assigned strings) and
// local mode (single device, ids are Date.now() numbers). Generic over the
// id type so both can reuse this without a cast.
export function EntriesEditor<Id>({ entries, onAdd, onRemove }: EntriesEditorProps<Id>) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, desc.trim());
    setName("");
    setDesc("");
  };

  return (
    <div style={S.card}>
      <span style={S.label}>Entradas ({entries.length})</span>
      {entries.map(e => (
        <div key={String(e.id)} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{e.name}</p>
            {e.description && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9089c0" }}>{e.description}</p>}
          </div>
          <button
            onClick={() => onRemove(e.id)}
            style={{ ...S.btn("danger"), width: 32, height: 32, padding: 0, borderRadius: 8, flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      ))}

      <input
        style={{ ...S.input, marginBottom: 8 }}
        placeholder="Nombre (ej: Juan, o 'Prenda 1')"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) submit();
        }}
      />
      <textarea
        style={{ ...S.input, marginBottom: 8, resize: "vertical", minHeight: 60 }}
        placeholder="Descripción / castigo (opcional)"
        value={desc}
        onChange={e => setDesc(e.target.value)}
      />
      <Btn variant="ghost" onClick={submit}>
        Agregar a la ruleta
      </Btn>
      {entries.length < 2 && <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Cargá al menos 2 entradas</p>}
    </div>
  );
}
