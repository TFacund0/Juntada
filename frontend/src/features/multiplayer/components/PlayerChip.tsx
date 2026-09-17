import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { DEFAULT_COLORS } from "../../../theme/styles/colors";
import { Avatar } from "../../../components/ui/Avatar";
import { MemberActionsDialog } from "./MemberActionsDialog";
import { buildMemberMenuActions } from "../hooks/memberMenuActions";
import type { PublicPlayer } from "@juntada/shared-types";

/**
 * Una celda de la grilla de jugadores de la sala (LobbyScreen). Extraído de
 * ahí porque el markup del chip (avatar + nombre + pills + menú del
 * anfitrión) es el mismo para cada jugador — la única variación es props.
 */
export function PlayerChip({
  player,
  isMe,
  isHostPlayer,
  canManage,
  menuOpen,
  onToggleMenu,
  onTransferHost,
  onKickPlayer,
  animationDelay,
}: {
  player: PublicPlayer;
  isMe: boolean;
  isHostPlayer: boolean;
  canManage: boolean;
  menuOpen: boolean;
  onToggleMenu: (id: string | null) => void;
  onTransferHost: (id: string) => void;
  onKickPlayer: (id: string) => void;
  animationDelay?: number;
}) {
  const { transferHost, kickMember } = buildMemberMenuActions(player.id, onTransferHost, onKickPlayer, () => onToggleMenu(null));

  return (
    <div
      className={clsx(
        "jt-player-chip jt-glow-hover jt-animate-rise relative flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[14px] p-2 text-center border",
        isMe
          ? "bg-[var(--jt-accent-soft,rgba(127,119,221,0.08))] border-[var(--jt-accent-border-soft,rgba(127,119,221,0.35))]"
          : "bg-white/[0.03] border-[var(--jt-row-border,rgba(127,119,221,0.08))]",
      )}
      style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      <Avatar name={player.name} size={34} />
      <span
        className={clsx(
          "max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px]",
          isMe ? "font-extrabold text-white" : "font-bold",
        )}
      >
        {player.name}
        {isMe && (
          <span className="block text-[10.5px] font-semibold" style={{ color: `var(--jt-muted-text, ${DEFAULT_COLORS.mutedText})` }}>
            vos
          </span>
        )}
      </span>
      {(isHostPlayer || !player.online) && (
        <div className="flex flex-wrap justify-center gap-1">
          {isHostPlayer && (
            <span
              className="jt-player-host-badge inline-flex items-center gap-1 rounded-full border border-[var(--jt-accent-border-soft,rgba(127,119,221,0.35))] bg-[var(--jt-accent-soft,rgba(127,119,221,0.18))] px-[7px] py-0.5 text-[9px] font-bold"
              style={{ color: `var(--jt-accent-strong, ${DEFAULT_COLORS.accentStrong})` }}
            >
              👑 Anfitrión
            </span>
          )}
          {!player.online && <span className={T.pill(false)}>Desconectado</span>}
        </div>
      )}
      {canManage && (
        <div className="absolute right-1.5 top-1.5">
          <button
            onClick={() => onToggleMenu(player.id)}
            aria-label={`Opciones para ${player.name}`}
            className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-[7px] border-none bg-white/[0.06] p-0 font-[inherit] text-[13px] font-extrabold leading-none text-[var(--jt-muted-text,#8079a8)]"
          >
            ⋮
          </button>
          {menuOpen && (
            <MemberActionsDialog
              memberName={player.name}
              memberOnline={player.online}
              onTransferHost={transferHost}
              onKickMember={kickMember}
              onClose={() => onToggleMenu(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
