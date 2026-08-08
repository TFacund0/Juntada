import { useState } from "react";
import { readLocalFlag, setLocalFlag } from "../utils/localFlag";

const DEV_NOTICE_SEEN_KEY = "impostorgame:devNoticeSeen";

/**
 * El aviso único de "app en desarrollo" (`DevNoticeDialog`) — extraído de
 * `App.tsx`. Se muestra una sola vez por dispositivo: `dismissDevNotice`
 * persiste la bandera en localStorage (vía `utils/localFlag.ts`) para que no
 * vuelva a aparecer.
 */
export function useDevNotice() {
  const [showDevNotice, setShowDevNotice] = useState(() => !readLocalFlag(DEV_NOTICE_SEEN_KEY));

  const dismissDevNotice = () => {
    setLocalFlag(DEV_NOTICE_SEEN_KEY);
    setShowDevNotice(false);
  };

  return { showDevNotice, dismissDevNotice };
}
