import { useState, useEffect } from "react";
import { Avatar } from "../ui/Avatar";
import "./NamePillEditor.css";

/**
 * Pill inline de "tocá para editar tu nombre", compartida entre la pantalla
 * de inicio, el modal de crear/unirse a grupo y la pantalla de crear/unirse
 * a una sala puntual — mismo look, mismo comportamiento en todo lugar donde
 * se usa. Mientras se edita, un overlay fijo de pantalla completa (debajo de
 * la pill, encima de todo lo demás) bloquea el resto de la página: un toque
 * perdido en otro lado no descarta el borrador en silencio, solo empuja al
 * jugador a confirmar ("Guardar") o cancelar explícitamente.
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
          <div className="jt-name-pill jt-name-pill--editing">
            <input
              className="jt-name-pill-input"
              placeholder="Tu nombre"
              autoFocus
              maxLength={40}
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
            <button onClick={save} disabled={!draft.trim()} className="jt-name-pill-btn jt-name-pill-btn--save">
              Guardar
            </button>
            <button onClick={cancel} className="jt-name-pill-btn jt-name-pill-btn--cancel">
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
            className="jt-name-pill"
          >
            <span className="jt-name-avatar-ring">
              <Avatar name={name} size={avatarSize} />
            </span>
            <span className="jt-name-pill-label">{name}</span>
            <span className="jt-name-pill-edit-hint">Editar</span>
          </button>
        )}
      </div>
      {editing && nudge && (
        <p style={{ color: "var(--jt-warn-text, #E2C44A)", fontSize: 12, fontWeight: 700, marginTop: 8, position: "relative", zIndex: 41 }}>
          Confirmá o cancelá el nombre para seguir
        </p>
      )}
    </>
  );
}
