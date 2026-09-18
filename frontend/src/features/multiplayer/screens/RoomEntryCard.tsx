import { Btn } from "../../../components/ui/Btn";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { NamePillEditor } from "../../../components/shell/NamePillEditor";
import { QRScannerDialog } from "../../../components/dialogs/QRScannerDialog";
import { getGame } from "../../../games/registry";
import type { GameDef } from "../../../games/gameTypes";
import type { RoomPreview } from "../hooks/useMultiplayerSocket";
import { useEntryTabs } from "../hooks/useEntryTabs";
import "./RoomEntryCard.css";

/**
 * Diseño propio (no el accordion de la vieja MenuScreen) para la entrada
 * puntual a "Crear sala"/"Unirse" de un juego ya elegido: tabs arriba, el
 * formulario de la pestaña activa abajo — mismo criterio de organización
 * que GroupEntryCard (piensa en la tab abierta como "esto es lo de adentro
 * de esta pestaña"), pero con su propio look (ver RoomEntryCard.css) y con
 * la vista previa de sala / aviso de código de grupo que "Crear grupo" no
 * necesita. Pensado para vivir dentro de RoomEntryModal, no como pantalla
 * completa — reemplaza a MenuScreen.tsx para entryKind "room".
 */
export function RoomEntryCard({
  connectionPhase,
  error,
  errorKey,
  playerName,
  onSetPhase,
  joinCode,
  onJoinCodeChange,
  onJoinRoom,
  showScanner,
  onShowScanner,
  roomPreview,
  selectedGame,
  onSwitchToGroup,
  onScan,
  onCreateRoom,
  submitting,
}: {
  connectionPhase: string;
  error: string;
  errorKey: number;
  playerName: string;
  onSetPhase: (phase: "create" | "join" | "menu") => void;
  onCreateRoom: () => void;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  onJoinRoom: () => void;
  showScanner: boolean;
  onShowScanner: (show: boolean) => void;
  roomPreview: RoomPreview | null;
  selectedGame: GameDef | undefined;
  onSwitchToGroup?: (code: string) => void;
  onScan: (raw: string) => void;
  submitting: boolean;
}) {
  const { activeTab, selectTab } = useEntryTabs(connectionPhase, onSetPhase);

  return (
    <div>
      <div className="jt-room-card-badge-wrap">
        <div className="jt-room-card-badge">
          {selectedGame?.logo ? <img src={selectedGame.logo} alt="" /> : <span>{selectedGame?.icon ?? "🎮"}</span>}
        </div>
      </div>

      <div className="jt-room-card-header">
        <h2 className="jt-room-card-title">{selectedGame?.label ?? "Jugar online"}</h2>
        <p className="jt-room-card-subtitle">Creá una sala nueva o unite a una con su código.</p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <NamePillEditor name={playerName} avatarSize={20} />
      </div>

      <ErrorBanner message={error} flashKey={errorKey} variant="block" />

      <div className="jt-room-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "create"}
          className={activeTab === "create" ? "jt-room-tab jt-room-tab--active" : "jt-room-tab"}
          onClick={() => selectTab("create")}
        >
          Crear sala
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "join"}
          className={activeTab === "join" ? "jt-room-tab jt-room-tab--active" : "jt-room-tab"}
          onClick={() => selectTab("join")}
        >
          Unirme
        </button>
      </div>

      <div className="jt-room-tab-panel">
        {activeTab === "create" ? (
          <Btn onClick={onCreateRoom} disabled={submitting} variant="success" className="jt-home-cta-btn" style={{ marginTop: 0 }}>
            {submitting ? "Creando..." : "Crear partida"}
          </Btn>
        ) : (
          <>
            <label className="jt-room-field-label" htmlFor="jt-room-code">
              Código de sala
            </label>
            <input
              id="jt-room-code"
              className="jt-room-field-input jt-room-field-input--code"
              placeholder="XXXXX"
              maxLength={5}
              value={joinCode}
              onChange={e => onJoinCodeChange(e.target.value.toUpperCase())}
            />
            <button type="button" className="jt-room-scan-btn" onClick={() => onShowScanner(true)}>
              📷 Escanear código QR
            </button>

            {roomPreview &&
              roomPreview.code === joinCode.trim().toUpperCase() &&
              (roomPreview.found ? (
                <div className="jt-room-preview jt-room-preview--found">
                  <p className="jt-room-preview-text">
                    {getGame(roomPreview.gameType ?? "")?.icon} Vas a unirte a: <b>{roomPreview.name}</b>
                  </p>
                  {selectedGame && roomPreview.gameType !== selectedGame.id && (
                    <p className="jt-room-preview-warning">
                      Ojo: esa sala es de {getGame(roomPreview.gameType ?? "")?.label ?? roomPreview.gameType}, no de {selectedGame.label}
                    </p>
                  )}
                </div>
              ) : roomPreview.isGroupCode ? (
                <div className="jt-room-preview jt-room-preview--group">
                  <p className="jt-room-preview-text">
                    Ese código es de un grupo
                    {roomPreview.name ? (
                      <>
                        {" "}
                        (<b>{roomPreview.name}</b>)
                      </>
                    ) : null}
                    , no de una sala.
                  </p>
                  <div className="jt-room-preview-actions">
                    <Btn
                      variant="success"
                      onClick={() => onSwitchToGroup?.(roomPreview.code)}
                      style={{ padding: "6px 14px", fontSize: 13, flex: 1 }}
                    >
                      Unirme al grupo
                    </Btn>
                    <Btn variant="ghost" onClick={() => onJoinCodeChange("")} style={{ padding: "6px 14px", fontSize: 13, flex: 1 }}>
                      Cancelar
                    </Btn>
                  </div>
                </div>
              ) : (
                <p className="jt-room-hint">No encontramos ninguna sala con ese código</p>
              ))}

            <Btn onClick={onJoinRoom} disabled={submitting} variant="success" className="jt-home-cta-btn" style={{ marginTop: 14 }}>
              {submitting ? "Uniéndose..." : "Unirse →"}
            </Btn>
          </>
        )}
      </div>

      {showScanner && <QRScannerDialog title="Escaneá el QR de la sala" onScan={onScan} onClose={() => onShowScanner(false)} />}
    </div>
  );
}
