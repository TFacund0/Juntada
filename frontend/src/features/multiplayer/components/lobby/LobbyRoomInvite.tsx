import { CodeDisplay } from "../../../../components/ui/CodeDisplay";
import { QRDialog } from "../../../../components/dialogs/QRDialog";
import { ShareLinkDialog } from "../../../../components/dialogs/ShareLinkDialog";
import { ShareArrowIcon } from "../../../../components/ui/icons";
import { buildRoomJoinUrl } from "../../utils/joinLink";
import type { RoomPublicState } from "@juntada/shared-types";

// Invitación para una sala INDEPENDIENTE (sin grupo): comparte el código de
// la propia sala, su único mecanismo de invitación. Extraído verbatim de
// LobbyScreen.tsx (rama `room.groupCode === null`).
//
// Duplicado intencional de `LobbyGroupInvite.tsx` (rama de grupo) — NO
// unificar en un componente paramétrico (decisión de diseño D4: cero riesgo
// de drift > deduplicación). Cualquier cambio de copy/comportamiento acá
// probablemente también aplica allá — revisar los dos juntos.
export function LobbyRoomInvite({
  room,
  activeGameLabel,
  showQR,
  onShowQR,
  showShareLink,
  onShowShareLink,
}: {
  room: RoomPublicState;
  activeGameLabel: string | undefined;
  showQR: boolean;
  onShowQR: (show: boolean) => void;
  showShareLink: boolean;
  onShowShareLink: (show: boolean) => void;
}) {
  return (
    <>
      <CodeDisplay code={room.code} />
      <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 10 }} className="jt-animate-rise">
        <button onClick={() => onShowQR(true)} className="jt-lobby-link-btn">
          ▦ Ver QR
        </button>
        <button onClick={() => onShowShareLink(true)} className="jt-lobby-link-btn">
          <ShareArrowIcon /> Compartir enlace
        </button>
      </div>
      {showQR && (
        <QRDialog
          title="Escaneá para unirte"
          subtitle={`${room.name ? room.name + " · " : ""}Sala ${room.code} · ${activeGameLabel ?? ""}`}
          value={buildRoomJoinUrl(room.gameType, room.code)}
          onClose={() => onShowQR(false)}
          showShare={false}
        />
      )}
      {showShareLink && (
        <ShareLinkDialog
          title="Compartir enlace de invitación"
          subtitle={`${room.name ? room.name + " · " : ""}Sala ${room.code} · ${activeGameLabel ?? ""}`}
          value={buildRoomJoinUrl(room.gameType, room.code)}
          onClose={() => onShowShareLink(false)}
        />
      )}
    </>
  );
}
