import { CodeDisplay } from "../../../../components/ui/CodeDisplay";
import { QRDialog } from "../../../../components/dialogs/QRDialog";
import { ShareLinkDialog } from "../../../../components/dialogs/ShareLinkDialog";
import { ShareArrowIcon } from "../../../../components/ui/icons";
import { buildGroupJoinUrl } from "../../utils/joinLink";

const LINK_BTN =
  "border-none text-jt-accent-strong cursor-pointer text-[13px] font-[inherit] font-bold inline-flex items-center gap-[5px] transition-[color,transform] duration-200 hover:text-white hover:-translate-y-px";

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
      <div className="jt-animate-rise flex justify-center gap-[18px] mt-2.5">
        <button onClick={() => onShowQR(true)} className={LINK_BTN}>
          ▦ Ver QR
        </button>
        <button onClick={() => onShowShareLink(true)} className={LINK_BTN}>
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
