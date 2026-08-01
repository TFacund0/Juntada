import type { ReactNode, RefObject } from "react";
import { S } from "../../../theme/styles";
import { Btn } from "../../../components/ui/Btn";
import { Avatar } from "../../../components/ui/Avatar";
import { CodeDisplay } from "../../../components/ui/CodeDisplay";
import { QRDialog } from "../../../components/dialogs/QRDialog";
import { ConfirmDialog } from "../../../components/dialogs/ConfirmDialog";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { getGame } from "../../../games/registry";
import type { GameDef } from "../../../games/gameTypes";
import type { GroupPublicState } from "@juntada/shared-types";
import { buildGroupJoinUrl } from "../utils/joinLink";

// Attached to a group with no active instance: the group's own code/roster,
// the list of open instances anyone can join, and the "create a new
// instance" picker. Covers connectionPhase "group" — extracted verbatim out
// of MultiplayerGame.tsx, which still owns all of this screen's state.
export function GroupScreen({
  reconnectBanner,
  group,
  myPlayerId,
  isGroupHost,
  showQR,
  onShowQR,
  openPlayerMenu,
  onTogglePlayerMenu,
  playerMenuRef,
  onTransferHost,
  onKickMember,
  playableGames,
  showCreateInstance,
  onToggleCreateInstance,
  onCreateInstance,
  pendingJoinCode,
  onJoinInstance,
  confirmLeaveGroup,
  onConfirmLeaveGroup,
  onLeaveGroup,
  onCancelLeaveGroup,
  error,
  errorKey,
}: {
  reconnectBanner: ReactNode;
  group: GroupPublicState;
  myPlayerId: string | undefined;
  isGroupHost: boolean;
  showQR: boolean;
  onShowQR: (show: boolean) => void;
  openPlayerMenu: string | null;
  onTogglePlayerMenu: (id: string | null) => void;
  playerMenuRef: RefObject<HTMLDivElement>;
  onTransferHost: (id: string) => void;
  onKickMember: (id: string) => void;
  playableGames: GameDef[];
  showCreateInstance: boolean;
  onToggleCreateInstance: () => void;
  onCreateInstance: (gameId: string) => void;
  pendingJoinCode: string | null;
  onJoinInstance: (roomCode: string) => void;
  confirmLeaveGroup: boolean;
  onConfirmLeaveGroup: () => void;
  onLeaveGroup: () => void;
  onCancelLeaveGroup: () => void;
  error: string;
  errorKey: number;
}) {
  return (
    <div>
      {reconnectBanner}
      <p style={{ textAlign: "center", fontSize: 18, fontWeight: 800, color: "#AFA9EC", margin: "0 0 12px" }}>{group.name}</p>
      <CodeDisplay code={group.code} />
      <button
        onClick={() => onShowQR(true)}
        style={{
          display: "block",
          margin: "10px auto 0",
          background: "none",
          border: "none",
          color: "#7F77DD",
          cursor: "pointer",
          fontSize: 13,
          fontFamily: "inherit",
          fontWeight: 700,
        }}
      >
        Invitar
      </button>
      {showQR && (
        <QRDialog
          title="Escaneá para unirte"
          subtitle={`${group.name} · Grupo ${group.code}`}
          value={buildGroupJoinUrl(group.code)}
          onClose={() => onShowQR(false)}
        />
      )}

      <div style={{ ...S.card, marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={S.label}>
            {group.members.length}/{group.maxMembers} en el grupo
          </span>
        </div>
        {group.members.map(m => (
          <div
            key={m.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              borderBottom: "1px solid rgba(127,119,221,0.08)",
            }}
          >
            <Avatar name={m.name} size={32} />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontWeight: m.id === myPlayerId ? 800 : 600,
                color: m.id === myPlayerId ? "#fff" : undefined,
              }}
            >
              {m.name}
              {m.id === myPlayerId && " (vos)"}
            </span>
            {m.id === group.hostId && <span style={S.pill(false)}>Anfitrión</span>}
            {!m.online && <span style={S.pill(false)}>Desconectado</span>}
            {isGroupHost && m.id !== myPlayerId && (
              <div ref={openPlayerMenu === m.id ? playerMenuRef : undefined} style={{ position: "relative" }}>
                <button
                  onClick={() => onTogglePlayerMenu(openPlayerMenu === m.id ? null : m.id)}
                  aria-label={`Opciones para ${m.name}`}
                  style={{
                    ...S.btn("ghost"),
                    width: 30,
                    height: 30,
                    padding: 0,
                    borderRadius: 8,
                    fontSize: 16,
                    lineHeight: 1,
                    fontWeight: 800,
                  }}
                >
                  ⋮
                </button>
                {openPlayerMenu === m.id && (
                  <div style={{ ...S.dropdownMenu, width: 170 }}>
                    {m.online && (
                      <button onClick={() => onTransferHost(m.id)} style={S.dropdownMenuItem}>
                        👑 Hacer anfitrión
                      </button>
                    )}
                    <button onClick={() => onKickMember(m.id)} style={{ ...S.dropdownMenuItem, color: "#F09595" }}>
                      🚫 Expulsar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ ...S.card, marginTop: 14 }}>
        <span style={S.label}>Partidas abiertas</span>
        {group.instances.length === 0 && <p style={{ ...S.muted, margin: "8px 0 0" }}>Nadie abrió una partida todavía.</p>}
        {group.instances.map(inst => {
          const g = getGame(inst.gameType);
          const joinable = inst.phase === "lobby" && inst.playerCount < inst.maxPlayers;
          return (
            <div
              key={inst.roomCode}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 0",
                borderBottom: "1px solid rgba(127,119,221,0.08)",
              }}
            >
              <span style={{ fontSize: 22 }}>{g?.icon ?? "🎮"}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, margin: 0 }}>{g?.label ?? inst.gameType}</p>
                <p style={{ ...S.muted, margin: 0, fontSize: 12 }}>
                  {inst.hostName} · {inst.playerCount}/{inst.maxPlayers} {!joinable && inst.phase !== "lobby" && "· en curso"}
                  {!joinable && inst.phase === "lobby" && "· llena"}
                </p>
              </div>
              <button
                disabled={!joinable || pendingJoinCode === inst.roomCode}
                onClick={() => onJoinInstance(inst.roomCode)}
                style={{
                  ...S.btn(joinable ? "primary" : "ghost"),
                  width: "auto",
                  padding: "6px 14px",
                  fontSize: 13,
                  borderRadius: 8,
                  opacity: joinable ? 1 : 0.5,
                  cursor: joinable && pendingJoinCode !== inst.roomCode ? "pointer" : "not-allowed",
                }}
              >
                {pendingJoinCode === inst.roomCode ? "Uniéndose..." : joinable ? "Unirse" : "—"}
              </button>
            </div>
          );
        })}
      </div>

      <Btn variant="ghost" onClick={onToggleCreateInstance} style={{ marginTop: 10 }}>
        {showCreateInstance ? "Cancelar" : "➕ Crear partida"}
      </Btn>
      {showCreateInstance && (
        <div style={{ ...S.card, marginTop: 10 }}>
          <span style={S.label}>Elegí un juego</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {playableGames.map(g => (
              <button
                key={g.id}
                onClick={() => onCreateInstance(g.id)}
                style={{
                  ...S.btn("ghost"),
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  justifyContent: "flex-start",
                  padding: "10px 14px",
                }}
              >
                <span style={{ fontSize: 18 }}>{g.icon}</span>
                <span>{g.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Btn variant="ghost" onClick={onConfirmLeaveGroup} style={{ marginTop: 14, opacity: 0.8 }}>
        Salir del grupo
      </Btn>
      {confirmLeaveGroup && (
        <ConfirmDialog
          title="¿Salir del grupo?"
          message="Dejás de formar parte de este grupo. Para volver vas a necesitar el código de nuevo."
          confirmLabel="Sí, salir"
          onConfirm={onLeaveGroup}
          onCancel={onCancelLeaveGroup}
        />
      )}

      <ErrorBanner message={error} flashKey={errorKey} variant="inline" />
    </div>
  );
}
