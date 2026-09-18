import { useState, useEffect } from "react";
import { Avatar } from "../ui/Avatar";
import { useAuth } from "../../features/auth/context/AuthContext";
import "./ProfilePanel.css";

const ERROR_COPY: Record<string, string> = {
  username_taken: "Ese nombre de usuario ya está en uso.",
};

/**
 * Panel de perfil propio del disparador-avatar del navbar de inicio (ver
 * AppHeader.tsx) — reemplaza al dropdown genérico + NamePillEditor de antes:
 * ese pill alternaba entre modo lectura/edición con anchos distintos, lo que
 * hacía "saltar" el layout dentro de un panel angosto. Acá el campo de
 * nombre es un input fijo, siempre visible, con su botón "Guardar" que solo
 * se habilita si hay un cambio real — sin salto de tamaño.
 *
 * El nombre acá ES el `username` de la cuenta (PATCH /api/me) — la
 * unicidad se re-chequea en el backend en cada rename, así que un choque
 * (`username_taken`) se muestra inline en vez de aplicarse en silencio (ver
 * spec user-profile).
 */
export function ProfilePanel({ playerName }: { playerName: string }) {
  const { logout, updateProfile } = useAuth();
  const [draft, setDraft] = useState(playerName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(playerName), [playerName]);

  const trimmed = draft.trim();
  const dirty = trimmed.length > 0 && trimmed !== playerName;

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError("");
    const result = await updateProfile({ username: trimmed });
    setSaving(false);
    if (!result.ok) setError(ERROR_COPY[result.error] ?? "No se pudo guardar el cambio.");
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
        <span className="jt-profile-panel-section-label">Nombre de usuario</span>
        <div className="jt-profile-panel-name-row">
          <input
            className="jt-profile-panel-input"
            value={draft}
            onChange={e => {
              setDraft(e.target.value);
              setError("");
            }}
            onKeyDown={e => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setDraft(playerName);
            }}
            placeholder="Tu usuario"
          />
          <button onClick={save} disabled={!dirty || saving} className="jt-profile-panel-save-btn">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
        {error && (
          <p className="jt-profile-panel-footnote" style={{ color: "#F09595" }}>
            {error}
          </p>
        )}
        <p className="jt-profile-panel-footnote">Así te ven los demás jugadores en salas y grupos.</p>

        <button onClick={() => logout()} className="jt-profile-panel-save-btn" style={{ marginTop: 14, width: "100%" }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
