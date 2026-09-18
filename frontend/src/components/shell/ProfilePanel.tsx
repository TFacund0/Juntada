import { useState, useEffect, useRef } from "react";
import { Avatar } from "../ui/Avatar";
import { useAuth } from "../../features/auth/context/AuthContext";

const ERROR_COPY: Record<string, string> = {
  username_taken: "Ese nombre de usuario ya está en uso.",
};

const MENU_ITEM =
  "flex items-center justify-between gap-2.5 rounded-xl px-2 py-2.5 text-[13px] font-bold text-jt-muted-text cursor-default";

/**
 * Panel de perfil propio del disparador-avatar del navbar de inicio (ver
 * AppHeader.tsx). Layout tipo "tarjeta de perfil": avatar grande centrado,
 * nombre debajo, y una lista de accesos (hoy solo placeholders bloqueados
 * para Configuración/Estadísticas — se activan cuando esas pantallas
 * existan; el candado + tooltip "Próximamente" evita el badge de texto
 * permanente). El nombre no se edita en un input siempre visible: se ve
 * como texto y el lápiz lo convierte en campo editable, para no mostrar un
 * botón "Guardar" cuando no hay nada que guardar todavía.
 *
 * El nombre acá ES el `username` de la cuenta (PATCH /api/me) — la
 * unicidad se re-chequea en el backend en cada rename, así que un choque
 * (`username_taken`) se muestra inline en vez de aplicarse en silencio (ver
 * spec user-profile).
 *
 * Colores: usa los tokens `jt-*` de `theme/tailwind.css` (alias a las
 * variables --jt-* de sharedChrome.css) en vez de `var(--jt-*, fallback)`
 * repetido — mismos valores, sin duplicar el fallback en cada clase.
 */
export function ProfilePanel({ playerName }: { playerName: string }) {
  const { logout, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(playerName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(playerName);
  }, [playerName, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const trimmed = draft.trim();
  const dirty = trimmed.length > 0 && trimmed !== playerName;

  const cancelEdit = () => {
    setEditing(false);
    setDraft(playerName);
    setError("");
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError("");
    const result = await updateProfile({ username: trimmed });
    setSaving(false);
    if (!result.ok) {
      setError(ERROR_COPY[result.error] ?? "No se pudo guardar el cambio.");
      return;
    }
    setEditing(false);
  };

  return (
    <div
      className="flex w-[260px] flex-col rounded-[20px] border border-jt-accent-border bg-jt-surface px-[18px] pb-3.5 pt-6
        shadow-[0_20px_50px_-14px_rgba(0,0,0,0.75)] animate-[jt-dropdown-in_180ms_cubic-bezier(0.16,1,0.3,1)_both]"
    >
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="mb-1.5 flex rounded-full bg-[linear-gradient(135deg,var(--jt-accent-strong),var(--jt-accent))] p-1">
          <Avatar name={playerName} size={72} />
        </span>

        {editing ? (
          <div className="flex w-full flex-col gap-1.5">
            <input
              ref={inputRef}
              className="w-full rounded-[10px] border border-jt-card-border bg-[color-mix(in_srgb,var(--jt-bg)_60%,transparent)]
                px-2.5 py-[7px] text-center font-[inherit] text-[13px] font-bold text-[#e8e4f0] outline-none transition-colors focus:border-jt-accent-border"
              value={draft}
              onChange={e => {
                setDraft(e.target.value);
                setError("");
              }}
              onKeyDown={e => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancelEdit();
              }}
              placeholder="Tu usuario"
            />
            <div className="flex items-center justify-center gap-3.5">
              <button
                onClick={cancelEdit}
                className="border-none bg-none px-1 py-0.5 text-xs font-semibold text-jt-muted-text transition-colors hover:text-[#e8e4f0]"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={!dirty || saving}
                className="border-none bg-none px-1 py-0.5 text-xs font-bold text-jt-accent-strong transition-opacity
                  disabled:cursor-default disabled:opacity-35 not-disabled:hover:opacity-80"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="group inline-flex items-center gap-1.5 rounded-lg border-none bg-none px-1.5 py-0.5 transition-colors hover:bg-[color-mix(in_srgb,var(--jt-accent)_12%,transparent)]"
            onClick={() => setEditing(true)}
          >
            <span className="max-w-[170px] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-[#e8e4f0]">
              {playerName}
            </span>
            <span className="text-xs text-jt-muted-text opacity-50 transition-opacity group-hover:opacity-100" aria-hidden="true">
              ✎
            </span>
          </button>
        )}

        {error && <p className="m-0 mt-2 text-[11px] leading-[1.5] text-jt-danger-text">{error}</p>}
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-jt-accent-strong">Tu perfil</span>
      </div>

      <div className="mt-[18px] flex flex-col gap-0.5 border-t border-jt-row-border pt-2.5">
        <div className={MENU_ITEM} title="Próximamente">
          <span>Configuración</span>
          <svg className="shrink-0 text-jt-muted-text" viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <div className={MENU_ITEM} title="Próximamente">
          <span>Estadísticas</span>
          <svg className="shrink-0 text-jt-muted-text" viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      </div>

      <button
        onClick={() => logout()}
        className="mx-auto mt-3.5 border-none bg-none px-1.5 py-1 text-[11px] font-semibold text-jt-muted-text opacity-70 transition-colors hover:text-[#d9776f] hover:opacity-100"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
