import { useRef, useState } from "react";
import { useClickOutside } from "../../hooks/useClickOutside";
import "./GroupMenuDropdown.css";

/**
 * Reemplazo de "Unirme"/"Crear grupo" para pantallas angostas — ver el
 * @media en GroupMenuDropdown.css: por debajo de ese ancho, esos dos botones
 * (jt-home-nav-link/jt-home-cta-btn) se ocultan y este trigger + panel toman
 * su lugar, para que "Juntada" nunca compita por espacio con ellos. Estado
 * propio (no se comparte con el menú de perfil): son dos disparadores
 * independientes uno al lado del otro.
 */
export function GroupMenuDropdown({ onStartGroupFlow }: { onStartGroupFlow: (intent: "create" | "join") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));

  const pick = (intent: "create" | "join") => {
    setOpen(false);
    onStartGroupFlow(intent);
  };

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="jt-group-menu-trigger">
        Grupo <span className="jt-group-menu-caret">▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 5 }}>
          <div className="jt-group-menu-panel">
            <button onClick={() => pick("create")} className="jt-group-menu-row jt-group-menu-row--primary">
              <span className="jt-group-menu-row-title">Crear grupo</span>
              <span className="jt-group-menu-row-subtitle">Generá un código para invitar a tu grupo</span>
            </button>
            <button onClick={() => pick("join")} className="jt-group-menu-row">
              <span className="jt-group-menu-row-title">Unirme a un grupo</span>
              <span className="jt-group-menu-row-subtitle">Entrá con el código que te compartieron</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
