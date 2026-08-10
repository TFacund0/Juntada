import { Avatar } from "../../../../components/ui/Avatar";
import { CrownIcon } from "../../../../components/ui/icons";
import type { GroupPublicState } from "@juntada/shared-types";

// "Integrantes" grid: crown badge for the host, online/offline dot,
// "(vos)" label for the current player, and the host-only options menu
// button. Extracted verbatim from GroupScreen.tsx, which still owns
// `openPlayerMenu` and the toggle callback.
export function GroupMembersGrid({
  group,
  myPlayerId,
  isGroupHost,
  onTogglePlayerMenu,
}: {
  group: GroupPublicState;
  myPlayerId: string | undefined;
  isGroupHost: boolean;
  onTogglePlayerMenu: (id: string | null) => void;
}) {
  return (
    <div className="jt-group-open-section">
      <p className="jt-group-open-title">
        Integrantes <span className="jt-group-section-count">· {group.members.length}</span>
      </p>
      <div className="jt-group-members-grid">
        {group.members.map((m, i) => (
          <div key={m.id} className="jt-group-member-chip jt-animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
            {isGroupHost && m.id !== myPlayerId && (
              <button onClick={() => onTogglePlayerMenu(m.id)} aria-label={`Opciones para ${m.name}`} className="jt-group-member-menu-btn">
                ⋮
              </button>
            )}
            <div className="jt-group-member-avatar-wrap">
              <Avatar name={m.name} size={46} />
              <span
                className={`jt-group-member-status ${!m.online ? "jt-group-member-status--offline" : ""}`}
                title={m.online ? "Conectado" : "Desconectado"}
              />
              {m.id === group.hostId && (
                <span className="jt-group-host-badge" title="Anfitrión">
                  <CrownIcon size={11} color="var(--jt-warn-text, #e2c44a)" />
                </span>
              )}
            </div>
            <p className="jt-group-member-name">
              {m.name}
              {m.id === myPlayerId && " (vos)"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
