import { CodeDisplay } from "../../../../components/ui/CodeDisplay";
import { QRDialog } from "../../../../components/dialogs/QRDialog";
import { ShareLinkDialog } from "../../../../components/dialogs/ShareLinkDialog";
import { ShareArrowIcon } from "../../../../components/ui/icons";
import { buildGroupJoinUrl } from "../../utils/joinLink";

// Invitación para una sala que pertenece a un GRUPO: quien invita comparte
// el código del GRUPO (no el de la sala), y desde ahí se entra a la partida
// abierta (join_instance en GroupScreen). Extraído verbatim de
// LobbyScreen.tsx (rama `else`, `room.groupCode !== null`).
//
// Duplicado intencional de `LobbyRoomInvite.tsx` (rama sin grupo) — NO
// unificar en un componente paramétrico (decisión de diseño D4: cero riesgo
// de drift > deduplicación). Cualquier cambio de copy/comportamiento acá
// probablemente también aplica allá — revisar los dos juntos.
export function LobbyGroupInvite({
  groupCode,
  showQR,
  onShowQR,
  showShareLink,
  onShowShareLink,
}: {
  groupCode: string;
  showQR: boolean;
  onShowQR: (show: boolean) => void;
  showShareLink: boolean;
  onShowShareLink: (show: boolean) => void;
}) {
  return (
    <>
      <CodeDisplay code={groupCode} label="GRUPO" />
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
          title="Escaneá para unirte al grupo"
          subtitle={`Grupo ${groupCode}`}
          value={buildGroupJoinUrl(groupCode)}
          onClose={() => onShowQR(false)}
          showShare={false}
        />
      )}
      {showShareLink && (
        <ShareLinkDialog
          title="Compartir enlace de invitación"
          subtitle={`Grupo ${groupCode}`}
          value={buildGroupJoinUrl(groupCode)}
          onClose={() => onShowShareLink(false)}
        />
      )}
    </>
  );
}
