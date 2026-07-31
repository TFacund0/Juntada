import { useState, useEffect } from "react";
import { Avatar } from "../ui/Avatar";
import "./ProfilePanel.css";

/**
 * Panel de perfil propio del disparador-avatar del navbar de inicio (ver
 * AppHeader.tsx) — reemplaza al dropdown genérico + NamePillEditor de antes:
 * ese pill alternaba entre modo lectura/edición con anchos distintos, lo que
 * hacía "saltar" el layout dentro de un panel angosto. Acá el campo de
 * nombre es un input fijo, siempre visible, con su botón "Guardar" que solo
 * se habilita si hay un cambio real — sin salto de tamaño.
 *
 * Hoy solo tiene la sección de nombre, pero el layout (header con avatar +
 * secciones debajo) ya está pensado para sumar más control de cuenta más
 * adelante sin rehacerlo.
 */
export function ProfilePanel({ playerName, onSavePlayerName }: { playerName: string; onSavePlayerName: (name: string) => void }) {
  const [draft, setDraft] = useState(playerName);

  useEffect(() => setDraft(playerName), [playerName]);

  const trimmed = draft.trim();
  const dirty = trimmed.length > 0 && trimmed !== playerName;

  const save = () => {
    if (!dirty) return;
    onSavePlayerName(trimmed);
  };

  return (
    <div className="jt-profile-panel">
      <div className="jt-profile-panel-header">
        <span className="jt-profile-panel-avatar-ring">
          <Avatar name={playerName} size={38} />
        </span>
        <div className="jt-profile-panel-name">
          <span className="jt-profile-panel-name-value">{playerName}</span>
          <span className="jt-profile-panel-name-tag">Tu perfil</span>
        </div>
      </div>

      <div className="jt-profile-panel-body">
        <span className="jt-profile-panel-section-label">Nombre</span>
        <div className="jt-profile-panel-name-row">
          <input
            className="jt-profile-panel-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setDraft(playerName);
            }}
            placeholder="Tu nombre"
          />
          <button onClick={save} disabled={!dirty} className="jt-profile-panel-save-btn">
            Guardar
          </button>
        </div>
        <p className="jt-profile-panel-footnote">Más ajustes de cuenta van a vivir acá — por ahora, solo tu nombre.</p>
      </div>
    </div>
  );
}
