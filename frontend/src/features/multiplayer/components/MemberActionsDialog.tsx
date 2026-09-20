import clsx from "clsx";
import { DialogFrame } from "../../../components/dialogs/DialogFrame";
import { Avatar } from "../../../components/ui/Avatar";
import { CrownIcon, UserMinusIcon } from "../../../components/ui/icons";
import { DEFAULT_COLORS } from "../../../theme/styles/colors";

interface MemberActionsDialogProps {
  memberName: string;
  memberOnline: boolean;
  onTransferHost: () => void;
  onKickMember: () => void;
  onClose: () => void;
  /** "group" (default) para GroupScreen, "room" para el chip de sala independiente (LobbyScreen/PlayerChip) — solo cambia el copy de "Expulsar de...". */
  scope?: "group" | "room";
}

const ITEM =
  "flex items-center gap-2.5 w-full box-border px-3.5 py-3 rounded-xl bg-jt-card-bg border border-jt-card-border text-[#e8e4f0] font-[inherit] text-[13.5px] font-bold text-left cursor-pointer transition-[transform,border-color,background] duration-[180ms] hover:-translate-y-0.5 hover:border-jt-accent-border-soft motion-reduce:transition-none";

const ITEM_ICON = "w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-jt-surface";

/**
 * "Hacer anfitrión"/"Expulsar" para un integrante del grupo — diálogo
 * centrado (mismo marco que ConfirmDialog/GameDetailDialog) en vez de un
 * dropdown anclado al botón "⋮" dentro del chip: un chip de ~84px de ancho
 * en la grilla de 3-4 columnas de mobile no tiene margen para desplegar un
 * panel de 176px sin recortarlo contra el borde de la pantalla o taparlo con
 * el chip vecino.
 */
const TITLE_ID = "jt-member-actions-title-label";

export function MemberActionsDialog({
  memberName,
  memberOnline,
  onTransferHost,
  onKickMember,
  onClose,
  scope = "group",
}: MemberActionsDialogProps) {
  return (
    <DialogFrame
      onClose={onClose}
      titleId={TITLE_ID}
      textAlign="center"
      cardClassName="jt-card-glow [--jt-glow-color:rgba(127,119,221,0.22)]"
    >
      <Avatar name={memberName} size={48} />
      <p id={TITLE_ID} className="my-3 mb-4 text-[15px] font-extrabold text-white">
        {memberName}
      </p>
      <div className="flex flex-col gap-2 mb-2.5">
        {memberOnline && (
          <button className={ITEM} onClick={onTransferHost}>
            <span className={ITEM_ICON}>
              <CrownIcon size={16} color={`var(--jt-warn-text, ${DEFAULT_COLORS.warnText})`} />
            </span>
            Hacer anfitrión
          </button>
        )}
        <button
          className={clsx(
            ITEM,
            "text-jt-danger-text bg-jt-danger-bg border-jt-danger-border hover:border-[color-mix(in_srgb,var(--jt-danger-border)_60%,rgba(226,75,74,0.5))]",
          )}
          onClick={onKickMember}
        >
          <span className={clsx(ITEM_ICON, "bg-[rgba(226,75,74,0.12)]")}>
            <UserMinusIcon size={16} color={`var(--jt-danger-text, ${DEFAULT_COLORS.dangerText})`} />
          </span>
          {scope === "room" ? "Expulsar de la sala" : "Expulsar del grupo"}
        </button>
      </div>
      <button
        className="w-full box-border py-3 rounded-xl bg-none border-none text-jt-muted-text font-[inherit] text-[13px] font-bold cursor-pointer hover:text-white"
        onClick={onClose}
      >
        Cancelar
      </button>
    </DialogFrame>
  );
}
