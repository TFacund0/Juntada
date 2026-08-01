import type { ReactNode } from "react";
import { Btn } from "../../../components/ui/Btn";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { NamePillEditor } from "../../../components/shell/NamePillEditor";
import { QRScannerDialog } from "../../../components/dialogs/QRScannerDialog";
import { useEntryTabs } from "../hooks/useEntryTabs";
import "./GroupEntryCard.css";

const GROUP_NAME_ADJECTIVES = ["Los", "Las", "Equipo", "Banda de", "Peña", "Combo"];
const GROUP_NAME_NOUNS = [
  "Pibes",
  "Genias",
  "Crumbers",
  "Trasnochados",
  "Sin Filtro",
  "de la Previa",
  "Piratas",
  "Insomnes",
  "Rebeldes",
  "Copados",
  "del Asado",
  "Invencibles",
];

function randomGroupName(): string {
  const adj = GROUP_NAME_ADJECTIVES[Math.floor(Math.random() * GROUP_NAME_ADJECTIVES.length)];
  const noun = GROUP_NAME_NOUNS[Math.floor(Math.random() * GROUP_NAME_NOUNS.length)];
  return `${adj} ${noun}`;
}

/**
 * Diseño propio (no el accordion de MenuScreen) para la entrada puntual a
 * "Crear grupo"/"Unirme a un grupo": tabs arriba, el formulario de la
 * pestaña activa abajo — pensado para vivir dentro de GroupEntryModal, no
 * como pantalla completa. Solo se usa cuando `entryKind === "group"`
 * (MultiplayerGame.tsx); el flujo de sala suelta (elegir juego → crear/
 * unirse a esa sala puntual) se queda con MenuScreen tal cual.
 */
export function GroupEntryCard({
  connectionPhase,
  reconnectBanner,
  error,
  errorKey,
  playerName,
  editingName,
  onEditingChange,
  onSaveName,
  onSetPhase,
  roomName,
  onRoomNameChange,
  onCreateRoom,
  joinCode,
  onJoinCodeChange,
  onJoinRoom,
  showScanner,
  onShowScanner,
  onScan,
  submitting,
}: {
  connectionPhase: string;
  reconnectBanner: ReactNode;
  error: string;
  errorKey: number;
  playerName: string;
  editingName: boolean;
  onEditingChange: (editing: boolean) => void;
  onSaveName: (name: string) => void;
  onSetPhase: (phase: "create" | "join" | "menu") => void;
  roomName: string;
  onRoomNameChange: (name: string) => void;
  onCreateRoom: () => void;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  onJoinRoom: () => void;
  showScanner: boolean;
  onShowScanner: (show: boolean) => void;
  onScan: (raw: string) => void;
  submitting: boolean;
}) {
  const { activeTab, selectTab } = useEntryTabs(connectionPhase, onSetPhase);

  return (
    <div>
      <div className="jt-group-card-header">
        <h2 className="jt-text-gradient jt-group-card-title">Juntá a tu grupo</h2>
        <p className="jt-group-card-subtitle">Creá un grupo nuevo o sumate a uno con su código.</p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <NamePillEditor name={playerName} onSave={onSaveName} avatarSize={20} editing={editingName} onEditingChange={onEditingChange} />
      </div>

      {reconnectBanner}
      <ErrorBanner message={error} flashKey={errorKey} variant="block" />

      <div className="jt-group-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "create"}
          className={activeTab === "create" ? "jt-group-tab jt-group-tab--active" : "jt-group-tab"}
          onClick={() => selectTab("create")}
        >
          Crear grupo
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "join"}
          className={activeTab === "join" ? "jt-group-tab jt-group-tab--active" : "jt-group-tab"}
          onClick={() => selectTab("join")}
        >
          Unirme
        </button>
      </div>

      <div className="jt-group-tab-panel">
        {activeTab === "create" ? (
          <>
            <label className="jt-group-field-label" htmlFor="jt-group-name">
              Nombre del grupo
            </label>
            <div className="jt-group-name-row">
              <input
                id="jt-group-name"
                className="jt-group-field-input"
                placeholder="Ej: Los pibes"
                value={roomName}
                onChange={e => onRoomNameChange(e.target.value)}
              />
              <button
                type="button"
                className="jt-group-dice-btn"
                onClick={() => onRoomNameChange(randomGroupName())}
                aria-label="Generar nombre al azar"
                title="Generar nombre al azar"
              >
                🎲
              </button>
            </div>
            <Btn onClick={onCreateRoom} disabled={submitting} variant="success" className="jt-home-cta-btn" style={{ marginTop: 16 }}>
              {submitting ? "Creando..." : "Crear grupo"}
            </Btn>
          </>
        ) : (
          <>
            <label className="jt-group-field-label" htmlFor="jt-group-code">
              Código del grupo
            </label>
            <input
              id="jt-group-code"
              className="jt-group-field-input jt-group-field-input--code"
              placeholder="XXXXX"
              maxLength={5}
              value={joinCode}
              onChange={e => onJoinCodeChange(e.target.value.toUpperCase())}
            />
            <button type="button" className="jt-group-scan-btn" onClick={() => onShowScanner(true)}>
              📷 Escanear código QR
            </button>
            <Btn onClick={onJoinRoom} disabled={submitting} variant="success" className="jt-home-cta-btn" style={{ marginTop: 16 }}>
              {submitting ? "Uniéndose..." : "Unirme →"}
            </Btn>
          </>
        )}
      </div>

      {showScanner && <QRScannerDialog title="Escaneá el QR del grupo" onScan={onScan} onClose={() => onShowScanner(false)} />}
    </div>
  );
}
