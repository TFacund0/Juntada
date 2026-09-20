import { CodeDisplay } from "../../../../components/ui/CodeDisplay";
import { QRDialog } from "../../../../components/dialogs/QRDialog";
import { ShareLinkDialog } from "../../../../components/dialogs/ShareLinkDialog";
import { ShareArrowIcon } from "../../../../components/ui/icons";
import { buildRoomJoinUrl } from "../../utils/joinLink";
import type { RoomPublicState } from "@juntada/shared-types";

const LINK_BTN =
  "border-none text-jt-accent-strong cursor-pointer text-[13px] font-[inherit] font-bold inline-flex items-center gap-[5px] transition-[color,transform] duration-200 hover:text-white hover:-translate-y-px";

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
