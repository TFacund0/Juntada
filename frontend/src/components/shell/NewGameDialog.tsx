import type { GameDef } from "../../games/gameTypes";
import { DialogFrame } from "../dialogs/DialogFrame";
import { CloseIcon } from "../ui/icons";
import { GamePicker } from "./gamePicker/GamePicker";
import "./NewGameDialog.css";

interface NewGameDialogProps {
  games: GameDef[];
  onPick: (id: string) => void;
  onClose: () => void;
}

/**
 * Modal mobile-only para "Nueva partida" en GroupScreen — reusa el
 * buscador + categorías + grilla de GamePicker (el catálogo del menú
 * principal), pero sin los tabs "Disponibles/Próximamente" (no aplican
 * dentro de un grupo ya armado) y con "Destacados" al mismo tamaño que el
 * resto de las categorías en vez de la grilla grande (`showAvailabilityFilter`
 * / `featuredLayout` en GamePicker) — empaquetado como diálogo centrado con
 * el fondo del grupo desenfocado detrás (ver overlayBlur en DialogFrame). En
 * desktop la grilla de juegos ya vive suelta en la columna derecha de
 * GroupScreen, así que este trigger/modal ni se renderiza ahí (ver
 * .jt-group-newgame-trigger en GroupScreen.css).
 */
export function NewGameDialog({ games, onPick, onClose }: NewGameDialogProps) {
  return (
    <DialogFrame onClose={onClose} maxWidth={560} padding={0} overlayBlur={10} cardClassName="jt-newgame-card">
      <div className="jt-newgame-header">
        <p className="jt-newgame-title">Nueva partida</p>
        <button onClick={onClose} aria-label="Cerrar" className="jt-newgame-close-btn">
          <CloseIcon size={14} />
        </button>
      </div>
      <div className="jt-newgame-body jt-thin-scrollbar">
        <GamePicker games={games} onPick={onPick} showAvailabilityFilter={false} featuredLayout={false} />
      </div>
    </DialogFrame>
  );
}
