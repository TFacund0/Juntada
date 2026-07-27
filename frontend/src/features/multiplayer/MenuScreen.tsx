import type { ReactNode } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { ErrorBanner } from "../../components/ErrorBanner";
import { NamePillEditor } from "../../components/NamePillEditor";
import { QRScannerDialog } from "../../components/QRScannerDialog";
import { getGame } from "../../games/registry";
import type { GameDef } from "../../games/gameTypes";
import type { RoomPreview } from "./useMultiplayerSocket";

// The pre-connection screen: name editor, create/join toggle, and (for
// "join") the code field with its live room preview. Covers connectionPhase
// "menu"/"create"/"join" — extracted verbatim out of MultiplayerGame.tsx,
// which still owns every bit of state this reads/writes (join code, error,
// the socket connection itself); this is purely the render for that one
// slice of it, so the parent's state/effects didn't need touching.
export function MenuScreen({
  connectionPhase,
  reconnectBanner,
  error,
  errorKey,
  playerName,
  editingName,
  onEditingChange,
  onSaveName,
  onSetPhase,
  inGroup,
  roomName,
  onRoomNameChange,
  onCreateRoom,
  joinCode,
  onJoinCodeChange,
  onJoinRoom,
  showScanner,
  onShowScanner,
  roomPreview,
  selectedGame,
  onSwitchToGroup,
  onScan,
}: {
  connectionPhase: string;
  reconnectBanner: ReactNode;
  error: string;
  errorKey: number;
  playerName: string;
  editingName: boolean;
  onEditingChange: (editing: boolean) => void;
  onSaveName: (name: string) => void;
  onSetPhase: (phase: "create" | "join") => void;
  inGroup: boolean;
  roomName: string;
  onRoomNameChange: (name: string) => void;
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
}) {
  return (
    <div>
      {reconnectBanner}
      <ErrorBanner message={error} flashKey={errorKey} variant="block" />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
        <NamePillEditor name={playerName} onSave={onSaveName} avatarSize={22} editing={editingName} onEditingChange={onEditingChange} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Btn variant={connectionPhase === "create" ? "primary" : "ghost"} onClick={() => onSetPhase("create")} style={{ flex: 1 }}>
          {inGroup ? "Crear grupo" : "Crear partida"}
        </Btn>
        <Btn variant={connectionPhase === "join" ? "primary" : "ghost"} onClick={() => onSetPhase("join")} style={{ flex: 1 }}>
          Unirse
        </Btn>
      </div>
      {inGroup && connectionPhase === "create" && (
        <div style={S.card}>
          <span style={S.label}>Nombre del grupo</span>
          <input style={S.input} placeholder="Ej: Los pibes" value={roomName} onChange={e => onRoomNameChange(e.target.value)} />
          <p style={{ ...S.muted, marginTop: 10 }}>Elegís qué jugar una vez adentro, con todo el grupo</p>
        </div>
      )}
      {connectionPhase === "create" && (
        <div style={S.card}>
          <span style={S.label}>Código de acceso</span>
          <p style={{ ...S.muted, margin: 0 }}>
            El servidor genera un código random de 5 caracteres (ej. XJ7K2), listo cuando toques "Crear".
          </p>
          <Btn onClick={onCreateRoom} style={{ marginTop: 14 }}>
            {inGroup ? "Crear grupo" : "Crear partida"}
          </Btn>
        </div>
      )}
      {connectionPhase === "join" && (
        <div style={S.card}>
          <span style={S.label}>{inGroup ? "Código del grupo" : "Código de sala"}</span>
          <input
            style={{ ...S.input, letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 20, fontWeight: 700, textAlign: "center" }}
            placeholder="XXXXX"
            maxLength={5}
            value={joinCode}
            onChange={e => onJoinCodeChange(e.target.value.toUpperCase())}
          />
          <button
            onClick={() => onShowScanner(true)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: "100%",
              margin: "10px 0 0",
              background: "none",
              border: "none",
              color: "#7F77DD",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              fontWeight: 700,
            }}
          >
            📷 Escanear código QR
          </button>
          {!inGroup &&
            roomPreview &&
            roomPreview.code === joinCode.trim().toUpperCase() &&
            (roomPreview.found ? (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(93,202,165,0.1)",
                  border: "1px solid rgba(93,202,165,0.3)",
                }}
              >
                <p style={{ margin: 0, fontSize: 13, color: "#5DCAA5" }}>
                  {getGame(roomPreview.gameType ?? "")?.icon} Vas a unirte a: <b>{roomPreview.name}</b>
                </p>
                {selectedGame && roomPreview.gameType !== selectedGame.id && (
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#EF9F27" }}>
                    Ojo: esa sala es de {getGame(roomPreview.gameType ?? "")?.label ?? roomPreview.gameType}, no de {selectedGame.label}
                  </p>
                )}
              </div>
            ) : roomPreview.isGroupCode ? (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(226,196,74,0.1)",
                  border: "1px solid rgba(226,196,74,0.3)",
                }}
              >
                <p style={{ margin: 0, fontSize: 13, color: "#E2C44A" }}>
                  Ese código es de un grupo
                  {roomPreview.name ? (
                    <>
                      {" "}
                      (<b>{roomPreview.name}</b>)
                    </>
                  ) : null}
                  , no de una sala.
                </p>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
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
              <p style={{ ...S.muted, marginTop: 10, fontSize: 12 }}>No encontramos ninguna sala con ese código</p>
            ))}
          <Btn onClick={onJoinRoom} style={{ marginTop: 12 }}>
            Unirse →
          </Btn>
        </div>
      )}
      {showScanner && (
        <QRScannerDialog
          title={inGroup ? "Escaneá el QR del grupo" : "Escaneá el QR de la sala"}
          onScan={onScan}
          onClose={() => onShowScanner(false)}
        />
      )}
    </div>
  );
}
