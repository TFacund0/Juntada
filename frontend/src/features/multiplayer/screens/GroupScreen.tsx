import { useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { S } from "../../../theme/styles";
import { Avatar } from "../../../components/ui/Avatar";
import { CodeDisplay } from "../../../components/ui/CodeDisplay";
import { QRDialog } from "../../../components/dialogs/QRDialog";
import { ConfirmDialog } from "../../../components/dialogs/ConfirmDialog";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { GameDetailDialog } from "../../../components/shell/GameDetailDialog";
import { CrownIcon, PlusIcon } from "../../../components/ui/icons";
import { NewGameDialog } from "../../../components/shell/NewGameDialog";
import { getGame } from "../../../games/registry";
import type { GameDef } from "../../../games/gameTypes";
import type { GroupPublicState } from "@juntada/shared-types";
import { buildGroupJoinUrl } from "../utils/joinLink";
import "./GroupScreen.css";

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
  const [linkCopied, setLinkCopied] = useState(false);
  // Mismo vistazo (arte, descripción, "¿Cómo se juega?") que al elegir un
  // juego desde el catálogo del home (ver GamePicker) — acá "Jugar" crea la
  // instancia dentro del grupo en vez de navegar a un juego local/nuevo.
  const [previewGame, setPreviewGame] = useState<GameDef | null>(null);
  // Solo mobile (ver .jt-group-newgame-trigger) — en desktop la grilla de
  // "Nueva partida" ya vive suelta en la columna derecha.
  const [showNewGamePicker, setShowNewGamePicker] = useState(false);
  const onlineCount = group.members.filter(m => m.online).length;

  const copyLink = () => {
    navigator.clipboard?.writeText(buildGroupJoinUrl(group.code)).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };

  return (
    <div className="jt-group-root jt-group-breakout">
      <div className="jt-group-glow" />
      {reconnectBanner}

      <div className="jt-group-header">
        <div>
          <h1 className="jt-group-title">{group.name}</h1>
          <p className="jt-group-subtitle">
            {onlineCount} de {group.members.length} conectados
          </p>
        </div>
        <div className="jt-group-code-chip">
          <CodeDisplay code={group.code} compact />
        </div>
      </div>

      <div className="jt-group-code-full">
        <CodeDisplay code={group.code} label="GRUPO" />
      </div>

      <div className="jt-group-copybar">
        <button className="jt-group-copy-btn" onClick={copyLink}>
          {linkCopied ? "Copiado" : "Copiar link"}
        </button>
        <button className="jt-group-share-btn" onClick={() => onShowQR(true)} aria-label="Invitar por QR">
          ↗
        </button>
      </div>

      {showQR && (
        <QRDialog
          title="Escaneá para unirte"
          subtitle={`${group.name} · Grupo ${group.code}`}
          value={buildGroupJoinUrl(group.code)}
          onClose={() => onShowQR(false)}
        />
      )}

      <div className="jt-group-grid">
        <div className="jt-group-col">
          <div className="jt-group-open-section">
            <p className="jt-group-open-title">
              Partidas abiertas <span className="jt-group-section-count">· {group.instances.length}</span>
            </p>
            {group.instances.length === 0 ? (
              <p className="jt-group-empty jt-group-open-empty">Nadie abrió una partida todavía.</p>
            ) : (
              <div className="jt-group-open-list">
                {group.instances.map((inst, i) => {
                  const g = getGame(inst.gameType);
                  const joinable = inst.phase === "lobby" && inst.playerCount < inst.maxPlayers;
                  return (
                    <div
                      key={inst.roomCode}
                      className={`jt-group-open-card jt-animate-rise ${joinable ? "jt-group-open-card--joinable" : ""}`}
                      style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                    >
                      <span className="jt-group-open-card-icon">
                        {g?.icon ?? "🎮"}
                        {joinable && <span className="jt-group-open-card-live" aria-hidden />}
                      </span>
                      <div className="jt-group-row-body">
                        <p className="jt-group-row-title">{g?.label ?? inst.gameType}</p>
                        <p className="jt-group-row-meta">
                          Abrió {inst.hostName} ·{" "}
                          <strong>
                            {inst.playerCount}/{inst.maxPlayers}
                          </strong>{" "}
                          jugadores
                          {!joinable && inst.phase !== "lobby" && " · en curso"}
                          {!joinable && inst.phase === "lobby" && " · llena"}
                        </p>
                      </div>
                      <button
                        disabled={!joinable || pendingJoinCode === inst.roomCode}
                        onClick={() => onJoinInstance(inst.roomCode)}
                        className={`jt-group-join-btn ${joinable ? "jt-group-join-btn--active" : "jt-group-join-btn--disabled"}`}
                      >
                        {pendingJoinCode === inst.roomCode ? "Uniéndose..." : joinable ? "Unirse" : "—"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="jt-group-open-section">
            <p className="jt-group-open-title">
              Integrantes <span className="jt-group-section-count">· {group.members.length}</span>
            </p>
            <div className="jt-group-members-grid">
              {group.members.map((m, i) => (
                <div key={m.id} className="jt-group-member-chip jt-animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                  {isGroupHost && m.id !== myPlayerId && (
                    <div ref={openPlayerMenu === m.id ? playerMenuRef : undefined} className="jt-group-member-menu">
                      <button
                        onClick={() => onTogglePlayerMenu(openPlayerMenu === m.id ? null : m.id)}
                        aria-label={`Opciones para ${m.name}`}
                        className="jt-group-member-menu-btn"
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
        </div>

        <div className="jt-group-col jt-group-col--newgame">
          <div style={S.card} className="jt-card-glow jt-group-newgame-card">
            <p className="jt-group-newgame-label">Nueva partida</p>
            <div className="jt-group-games-grid">
              {playableGames.map(g => (
                <button key={g.id} onClick={() => setPreviewGame(g)} className="jt-group-game-card">
                  <span className="jt-group-game-icon">{g.icon}</span>
                  <span className="jt-group-game-body">
                    <p className="jt-group-game-title">{g.label}</p>
                    {g.minPlayers && <p className="jt-group-game-meta">Desde {g.minPlayers} jugadores</p>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {previewGame && (
        <GameDetailDialog
          game={previewGame}
          onClose={() => setPreviewGame(null)}
          onStart={() => {
            onCreateInstance(previewGame.id);
            setPreviewGame(null);
          }}
        />
      )}

      {showNewGamePicker && (
        <NewGameDialog
          games={playableGames}
          onClose={() => setShowNewGamePicker(false)}
          onPick={id => {
            onCreateInstance(id);
            setShowNewGamePicker(false);
          }}
        />
      )}

      {
        // Portal a document.body: esta pantalla vive dentro del <ScreenFade>
        // de MultiplayerGame.tsx, que anima con `transform` al montar — un
        // ancestro con `transform` es el containing block de cualquier
        // `position: fixed` de acá adentro, así que sin portal la barra
        // quedaría mal ubicada durante esa animación en vez de fija al
        // viewport. Mismo motivo que StickyActionBar/jt-lobby-action-bar en
        // LobbyScreen.tsx.
        createPortal(
          <div className="jt-group-bottom-bar jt-group-breakout">
            <button type="button" className="jt-group-newgame-trigger" onClick={() => setShowNewGamePicker(true)}>
              <span className="jt-group-newgame-trigger-shine" aria-hidden />
              <span className="jt-group-newgame-trigger-icon" aria-hidden>
                <PlusIcon size={14} color="#fff" />
              </span>
              <span className="jt-group-newgame-trigger-body">
                <span className="jt-group-newgame-trigger-title">Nueva partida</span>
                <span className="jt-group-newgame-trigger-hint">Elegí entre todos los juegos</span>
              </span>
            </button>

            <div className="jt-group-leave-row">
              <button className="jt-group-leave-btn" onClick={onConfirmLeaveGroup}>
                Salir del grupo
              </button>
            </div>
          </div>,
          document.body,
        )
      }
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
