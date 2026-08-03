import { DialogFrame } from "../../../components/dialogs/DialogFrame";
import { Avatar } from "../../../components/ui/Avatar";
import { CrownIcon, UserMinusIcon } from "../../../components/ui/icons";
import "./MemberActionsDialog.css";

interface MemberActionsDialogProps {
  memberName: string;
  memberOnline: boolean;
  onTransferHost: () => void;
  onKickMember: () => void;
  onClose: () => void;
}

/**
 * "Hacer anfitrión"/"Expulsar" para un integrante del grupo — diálogo
 * centrado (mismo marco que ConfirmDialog/GameDetailDialog) en vez de un
 * dropdown anclado al botón "⋮" dentro del chip: un chip de ~84px de ancho
 * en la grilla de 3-4 columnas de mobile no tiene margen para desplegar un
 * panel de 176px sin recortarlo contra el borde de la pantalla o taparlo con
 * el chip vecino.
 */
export function MemberActionsDialog({ memberName, memberOnline, onTransferHost, onKickMember, onClose }: MemberActionsDialogProps) {
  return (
    <DialogFrame onClose={onClose} textAlign="center" cardClassName="jt-card-glow jt-member-actions-card">
      <Avatar name={memberName} size={48} />
      <p className="jt-member-actions-title">{memberName}</p>
      <div className="jt-member-actions-list">
        {memberOnline && (
          <button className="jt-member-actions-item" onClick={onTransferHost}>
            <span className="jt-member-actions-item-icon">
              <CrownIcon size={16} color="var(--jt-warn-text, #e2c44a)" />
            </span>
            Hacer anfitrión
          </button>
        )}
        <button className="jt-member-actions-item jt-member-actions-item--danger" onClick={onKickMember}>
          <span className="jt-member-actions-item-icon jt-member-actions-item-icon--danger">
            <UserMinusIcon size={16} color="var(--jt-danger-text, #f09595)" />
          </span>
          Expulsar del grupo
        </button>
      </div>
      <button className="jt-member-actions-cancel" onClick={onClose}>
        Cancelar
      </button>
    </DialogFrame>
  );
}
