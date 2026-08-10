import { useState } from "react";
import { useCopyToClipboard } from "../../../hooks/ui/useCopyToClipboard";
import { createPortal } from "react-dom";
import { S } from "../../../theme/styles";
import { CodeDisplay } from "../../../components/ui/CodeDisplay";
import { QRDialog } from "../../../components/dialogs/QRDialog";
import { ConfirmDialog } from "../../../components/dialogs/ConfirmDialog";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { GameDetailDialog } from "../../../components/shell/GameDetailDialog";
import { PlusIcon, ShareArrowIcon } from "../../../components/ui/icons";
import { NewGameDialog } from "../../../components/shell/NewGameDialog";
import { MemberActionsDialog } from "../components/MemberActionsDialog";
import { GroupOpenInstances } from "../components/group/GroupOpenInstances";
import { GroupMembersGrid } from "../components/group/GroupMembersGrid";
import type { GameDef } from "../../../games/gameTypes";
import type { GroupPublicState } from "@juntada/shared-types";
import { buildGroupJoinUrl } from "../utils/joinLink";
import "./GroupScreen.css";

// Attached to a group with no active instance: the group's own code/roster,
// the list of open instances anyone can join, and the "create a new
// instance" picker. Covers connectionPhase "group" — extracted verbatim out
// of MultiplayerGame.tsx, which still owns all of this screen's state.
export function GroupScreen({
  group,
  myPlayerId,
  isGroupHost,
  showQR,
  onShowQR,
  openPlayerMenu,
  onTogglePlayerMenu,
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
  group: GroupPublicState;
  myPlayerId: string | undefined;
  isGroupHost: boolean;
  showQR: boolean;
  onShowQR: (show: boolean) => void;
  openPlayerMenu: string | null;
  onTogglePlayerMenu: (id: string | null) => void;
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
  const { copied: linkCopied, copy: copyLinkToClipboard } = useCopyToClipboard();
  // Mismo vistazo (arte, descripción, "¿Cómo se juega?") que al elegir un
  // juego desde el catálogo del home (ver GamePicker) — acá "Jugar" crea la
  // instancia dentro del grupo en vez de navegar a un juego local/nuevo.
  const [previewGame, setPreviewGame] = useState<GameDef | null>(null);
  // Solo mobile (ver .jt-group-games-section, tile "Nueva partida") — en
  // desktop la grilla de "Nueva partida" ya vive suelta en la columna derecha.
  const [showNewGamePicker, setShowNewGamePicker] = useState(false);
  const onlineCount = group.members.filter(m => m.online).length;

  const copyLink = () => copyLinkToClipboard(buildGroupJoinUrl(group.code));

  return (
    <div className="jt-group-root jt-group-breakout">
      <div className="jt-group-glow" />

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
          <ShareArrowIcon size={18} />
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
          <GroupOpenInstances instances={group.instances} pendingJoinCode={pendingJoinCode} onJoinInstance={onJoinInstance} />

          {/* Solo mobile (ver .jt-group-games-section) — en desktop "Nueva
              partida" ya vive suelta en la columna derecha (jt-group-col--newgame). */}
          <div className="jt-group-open-section jt-group-games-section">
            <p className="jt-group-open-title">Juegos</p>
            <div className="jt-group-games-scroll">
              <button type="button" className="jt-group-games-tile jt-group-games-tile--new" onClick={() => setShowNewGamePicker(true)}>
                <span className="jt-group-games-tile-icon jt-group-games-tile-icon--new">
                  <PlusIcon size={20} color="#fff" />
                </span>
                <span className="jt-group-games-tile-label">Nueva partida</span>
              </button>
              {playableGames
                .filter(g => g.category === "destacados")
                .map(g => (
                  <button key={g.id} type="button" className="jt-group-games-tile" onClick={() => setPreviewGame(g)}>
                    <span className="jt-group-games-tile-icon">
                      {g.logo ? <img src={g.logo} alt={g.label} className="jt-group-games-tile-logo" /> : g.icon}
                    </span>
                    <span className="jt-group-games-tile-label">{g.label}</span>
                  </button>
                ))}
            </div>
          </div>

          <GroupMembersGrid group={group} myPlayerId={myPlayerId} isGroupHost={isGroupHost} onTogglePlayerMenu={onTogglePlayerMenu} />
        </div>

        <div className="jt-group-col jt-group-col--newgame">
          <div style={S.card} className="jt-card-glow jt-group-newgame-card">
            <p className="jt-group-newgame-label">Nueva partida</p>
            <div className="jt-group-games-grid">
              {playableGames.map(g => (
                <button key={g.id} onClick={() => setPreviewGame(g)} className="jt-group-game-card">
                  <span className="jt-group-game-icon">
                    {g.logo ? <img src={g.logo} alt={g.label} className="jt-group-game-logo" /> : g.icon}
                  </span>
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

      {openPlayerMenu &&
        (() => {
          const menuMember = group.members.find(m => m.id === openPlayerMenu);
          if (!menuMember) return null;
          return (
            <MemberActionsDialog
              memberName={menuMember.name}
              memberOnline={menuMember.online}
              onTransferHost={() => {
                onTransferHost(menuMember.id);
                onTogglePlayerMenu(null);
              }}
              onKickMember={() => {
                onKickMember(menuMember.id);
                onTogglePlayerMenu(null);
              }}
              onClose={() => onTogglePlayerMenu(null)}
            />
          );
        })()}

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
