import { Avatar } from "../ui/Avatar";
import "./NamePillEditor.css";

/**
 * Pill informativa que muestra el avatar y el nombre del jugador en las tarjetas
 * de entrada a salas y grupos. El cambio de nombre ahora vive de forma
 * exclusiva en ProfilePanel (perfil de usuario en la barra de navegación).
 */
export interface NamePillEditorProps {
  name: string;
  onSave?: (name: string) => void;
  avatarSize?: number;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export function NamePillEditor({ name, avatarSize = 26 }: NamePillEditorProps) {
  return (
    <div className="jt-name-pill">
      <span className="jt-name-avatar-ring">
        <Avatar name={name} size={avatarSize} />
      </span>
      <span className="jt-name-pill-label">{name}</span>
    </div>
  );
}
