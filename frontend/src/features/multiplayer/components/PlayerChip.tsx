import type { RefObject } from "react";
import { S } from "../../../theme/styles";
import { Avatar } from "../../../components/ui/Avatar";
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
  menuRef,
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
  menuRef: RefObject<HTMLDivElement>;
  onToggleMenu: (id: string | null) => void;
  onTransferHost: (id: string) => void;
  onKickPlayer: (id: string) => void;
  animationDelay?: number;
}) {
  return (
    <div
      className="jt-player-chip jt-glow-hover jt-animate-rise"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        textAlign: "center",
        position: "relative",
        padding: "8px",
        borderRadius: 14,
        overflow: "hidden",
        background: isMe ? "var(--jt-accent-soft, rgba(127,119,221,0.08))" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isMe ? "var(--jt-accent-border-soft, rgba(127,119,221,0.35))" : "var(--jt-row-border, rgba(127,119,221,0.08))"}`,
        animationDelay: animationDelay ? `${animationDelay}ms` : undefined,
      }}
    >
      <Avatar name={player.name} size={34} />
      <span
        style={{
          fontSize: 12.5,
          fontWeight: isMe ? 800 : 700,
          color: isMe ? "#fff" : undefined,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}
      >
        {player.name}
        {isMe && <span style={{ display: "block", fontWeight: 600, color: "var(--jt-muted-text, #6b6490)", fontSize: 10.5 }}>vos</span>}
      </span>
      {(isHostPlayer || !player.online) && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
          {isHostPlayer && (
            <span
              className="jt-player-host-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 20,
                background: "var(--jt-accent-soft, rgba(127,119,221,0.18))",
                color: "var(--jt-accent-strong, #AFA9EC)",
                border: "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.35))",
              }}
            >
              👑 Anfitrión
            </span>
          )}
          {!player.online && <span style={S.pill(false)}>Desconectado</span>}
        </div>
      )}
      {canManage && (
        <div ref={menuOpen ? menuRef : undefined} style={{ position: "absolute", top: 6, right: 6 }}>
          <button
            onClick={() => onToggleMenu(menuOpen ? null : player.id)}
            aria-label={`Opciones para ${player.name}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              padding: 0,
              border: "none",
              borderRadius: 7,
              background: "rgba(255,255,255,0.06)",
              color: "var(--jt-muted-text, #8079a8)",
              cursor: "pointer",
              fontSize: 13,
              lineHeight: 1,
              fontWeight: 800,
              fontFamily: "inherit",
            }}
          >
            ⋮
          </button>
          {menuOpen && (
            <div style={{ ...S.dropdownMenu, width: 170 }}>
              {player.online && (
                <button onClick={() => onTransferHost(player.id)} style={S.dropdownMenuItem}>
                  👑 Hacer anfitrión
                </button>
              )}
              <button onClick={() => onKickPlayer(player.id)} style={{ ...S.dropdownMenuItem, color: "#F09595" }}>
                🚫 Expulsar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
