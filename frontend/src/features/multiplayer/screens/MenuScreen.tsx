import type { ReactNode } from "react";
import { S } from "../../../theme/styles";
import { Btn } from "../../../components/Btn";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { NamePillEditor } from "../../../components/NamePillEditor";
import { QRScannerDialog } from "../../../components/QRScannerDialog";
import { getGame } from "../../../games/registry";
import type { GameDef } from "../../../games/gameTypes";
import type { RoomPreview } from "../hooks/useMultiplayerSocket";
import "../../../components/ModePicker.css";

// Mismo lenguaje visual que ModePicker: squircle + SVG (Feather-style, trazo
// blanco) para el ícono de cada fila principal — pero solo ahí. Adentro del
// contenido expandido no se repite otro squircle/ícono: un segundo círculo
// de color pegado abajo del primero es lo que hacía sentir "todo
// superpuesto" en la versión anterior. El contenido interno usa el mismo
// `S.label` de texto simple que el resto de la app (ver theme/styles.ts).
const rowIconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "#fff",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function LinkIcon() {
  return (
    <svg {...rowIconProps}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...rowIconProps}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--jt-accent-strong, #AFA9EC)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, transition: "transform 0.2s ease", transform: open ? "rotate(180deg)" : "none" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * Una fila grande (mismo squircle+título+subtítulo que `ModePicker`) que se
 * expande in-place con su propio formulario cuando está activa, en vez de
 * un toggle chico arriba de una sola card — así la pantalla ocupa el mismo
 * alto sea cual sea la opción elegida, sin dejar un hueco vacío debajo de un
 * formulario corto. El contenido expandido queda separado del encabezado
 * por una línea divisoria fina, no solo un margen, para que se lea como
 * "esto es lo de adentro de esta fila" y no como otro bloque flotando cerca.
 */
function ExpandableRow({
  icon,
  title,
  subtitle,
  active,
  onSelect,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="jt-mode-row" style={{ ...S.modeRow, flexDirection: "column", alignItems: "stretch", padding: 20 }}>
      <button
        onClick={onSelect}
        aria-label={title}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          textAlign: "left",
          cursor: "pointer",
          fontFamily: "inherit",
          color: "inherit",
        }}
      >
        <div style={{ ...S.modeIconBadge, background: "var(--jt-accent, #7F77DD)" }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <p style={S.modeRowTitle}>{title}</p>
          <p style={S.modeRowSubtitle}>{subtitle}</p>
        </div>
        <ChevronDownIcon open={active} />
      </button>
      {active && (
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--jt-card-border, rgba(127,119,221,0.18))" }}>
          {children}
        </div>
      )}
    </div>
  );
}

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
  // Set from the moment "Crear partida"/"Unirse" is tapped until the room
  // actually arrives (or the attempt fails) — see MultiplayerGame's
  // submitting state. Disables the button and swaps its label so the tap
  // reads as "in progress" instead of looking like nothing happened on a
  // slow connection.
  submitting: boolean;
}) {
  return (
    <div>
      {reconnectBanner}
      <ErrorBanner message={error} flashKey={errorKey} variant="block" />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
        <NamePillEditor name={playerName} onSave={onSaveName} avatarSize={22} editing={editingName} onEditingChange={onEditingChange} />
      </div>

      <ExpandableRow
        icon={<PlusIcon />}
        title={inGroup ? "Crear grupo" : "Crear partida"}
        subtitle="Generamos un código para compartir con tu grupo"
        active={connectionPhase === "create"}
        onSelect={() => onSetPhase("create")}
      >
        {inGroup && (
          <div style={{ marginBottom: 16 }}>
            <span style={S.label}>Nombre del grupo</span>
            <input style={S.input} placeholder="Ej: Los pibes" value={roomName} onChange={e => onRoomNameChange(e.target.value)} />
            <p style={{ ...S.muted, marginTop: 10 }}>Elegís qué jugar una vez adentro, con todo el grupo</p>
          </div>
        )}
        <span style={S.label}>Código de acceso</span>
        <p style={{ ...S.muted, margin: 0 }}>
          El servidor genera un código random de 5 caracteres (ej. XJ7K2), listo cuando toques "Crear".
        </p>
        <Btn onClick={onCreateRoom} disabled={submitting} style={{ marginTop: 14 }}>
          {submitting ? "Creando..." : inGroup ? "Crear grupo" : "Crear partida"}
        </Btn>
      </ExpandableRow>

      <ExpandableRow
        icon={<LinkIcon />}
        title="Unirse"
        subtitle={inGroup ? "Entrá a un grupo con su código" : "Entrá a una sala con su código"}
        active={connectionPhase === "join"}
        onSelect={() => onSetPhase("join")}
      >
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
        <Btn onClick={onJoinRoom} disabled={submitting} style={{ marginTop: 12 }}>
          {submitting ? "Uniéndose..." : "Unirse →"}
        </Btn>
      </ExpandableRow>

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
