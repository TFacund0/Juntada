import { useState, useEffect } from "react";
import { S } from "../theme/styles";
import { Avatar } from "./Avatar";

/**
 * Pill inline de "tocá para editar tu nombre", compartida entre la pantalla
 * de inicio y la de crear/unirse multijugador — mismo look, mismo
 * comportamiento en todo lugar donde se usa. Mientras se edita, un overlay
 * fijo de pantalla completa (debajo de la pill, encima de todo lo demás)
 * bloquea el resto de la página: un toque perdido en otro lado no descarta
 * el borrador en silencio, solo empuja al jugador a confirmar (✓) o
 * cancelar (✕) explícitamente.
 *
 * `editing`/`onEditingChange` son opcionales — omitilos para que este
 * componente maneje su propio estado de abierto/cerrado, o pasalos para
 * también poder abrir la edición desde afuera (ej. `MultiplayerGame.tsx` la
 * abre automáticamente cuando se rechaza un join por nombre ya usado en esa
 * sala).
 */
export interface NamePillEditorProps {
  name: string;
  onSave: (name: string) => void;
  avatarSize?: number;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export function NamePillEditor({ name, onSave, avatarSize = 26, editing: editingProp, onEditingChange }: NamePillEditorProps) {
  const [editingState, setEditingState] = useState(false);
  const editing = editingProp ?? editingState;
  const setEditing = (value: boolean) => {
    setEditingState(value);
    onEditingChange?.(value);
  };

  const [draft, setDraft] = useState(name);
  const [nudge, setNudge] = useState(false);

  // Cada vez que se abre la edición (ya sea porque el jugador tocó la pill
  // o porque quien la usa la forzó a abrirse), arrancar desde el nombre
  // actual, no desde un borrador desactualizado.
  useEffect(() => {
    if (editing) setDraft(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setEditing(false);
    setNudge(false);
  };

  const cancel = () => {
    setDraft(name);
    setEditing(false);
    setNudge(false);
  };

  return (
    <>
      {editing && <div onClick={() => setNudge(true)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, position: "relative", zIndex: 41 }}>
        {editing ? (
          <div style={{ ...S.namePill, cursor: "default", paddingLeft: 12 }}>
            <input
              style={{
                background: "none",
                border: "none",
                outline: "none",
                color: "#e8e4f0",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                width: 110,
              }}
              placeholder="Tu nombre"
              autoFocus
              value={draft}
              onChange={e => {
                setDraft(e.target.value);
                setNudge(false);
              }}
              onKeyDown={e => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancel();
              }}
            />
            <button
              onClick={save}
              disabled={!draft.trim()}
              aria-label="Guardar nombre"
              style={{
                background: "rgba(93,202,165,0.18)",
                border: "none",
                borderRadius: 999,
                color: "#5DCAA5",
                cursor: draft.trim() ? "pointer" : "default",
                opacity: draft.trim() ? 1 : 0.4,
                fontSize: 14,
                fontFamily: "inherit",
                fontWeight: 700,
                padding: "5px 10px",
              }}
            >
              ✓
            </button>
            <button
              onClick={cancel}
              aria-label="Cancelar edición"
              style={{
                background: "rgba(226,75,74,0.14)",
                border: "none",
                borderRadius: 999,
                color: "#F09595",
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "inherit",
                fontWeight: 700,
                padding: "5px 10px",
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
            style={S.namePill}
          >
            <Avatar name={name} size={avatarSize} />
            <span style={{ fontWeight: 700, fontSize: 14, color: "#e8e4f0" }}>{name}</span>
            <span style={{ color: "var(--jt-accent)", fontSize: 13 }}>✎</span>
          </button>
        )}
      </div>
      {editing && nudge && (
        <p style={{ color: "#E2C44A", fontSize: 12, fontWeight: 700, marginTop: 8, position: "relative", zIndex: 41 }}>
          Confirmá (✓) o cancelá (✕) el nombre para seguir
        </p>
      )}
    </>
  );
}
