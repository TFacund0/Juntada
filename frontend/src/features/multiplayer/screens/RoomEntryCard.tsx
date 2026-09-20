import clsx from "clsx";
import { Btn } from "../../../components/ui/Btn";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { NamePillEditor } from "../../../components/shell/NamePillEditor";
import { QRScannerDialog } from "../../../components/dialogs/QRScannerDialog";
import { QrIcon } from "../../../components/ui/icons";
import { getGame } from "../../../games/registry";
import type { GameDef } from "../../../games/gameTypes";
import type { RoomPreview } from "../hooks/useMultiplayerSocket";
import { useEntryTabs } from "../hooks/useEntryTabs";

const FIELD_INPUT =
  "w-full box-border rounded-xl border border-jt-card-border bg-[color-mix(in_srgb,var(--jt-bg)_60%,transparent)] px-3.5 py-3 text-[15px] font-[inherit] text-[#e8e4f0] outline-none transition-colors placeholder:text-jt-muted-text focus:border-jt-accent-border";

// Tabs con subrayado deslizante (vía `after:`) — distinto de la pastilla
// rellena de GroupEntryCard, para diferenciar "sala" de "grupo" a simple
// vista aunque compartan la misma idea de organización (tabs + panel).
function tabClass(active: boolean): string {
  return clsx(
    "relative px-0.5 pt-2 pb-3 border-none text-sm font-bold font-[inherit] cursor-pointer transition-colors",
    "after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:rounded-sm after:transition-[background] after:duration-[250ms]",
    active
      ? "text-white after:bg-[linear-gradient(90deg,var(--jt-accent-strong),var(--jt-accent))]"
      : "text-jt-muted-text hover:text-[#e8e4f0] after:bg-transparent",
  );
}

/**
 * Diseño propio (no el accordion de la vieja MenuScreen) para la entrada
 * puntual a "Crear sala"/"Unirse" de un juego ya elegido: tabs arriba, el
 * formulario de la pestaña activa abajo — mismo criterio de organización
 * que GroupEntryCard (piensa en la tab abierta como "esto es lo de adentro
 * de esta pestaña"), pero con su propio look (placa romboidal + tabs con
 * subrayado, en vez de header con ícono + pastilla rellena) y con la vista
 * previa de sala / aviso de código de grupo que "Crear grupo" no necesita.
 * Pensado para vivir dentro de RoomEntryModal, no como pantalla completa —
 * reemplaza a MenuScreen.tsx para entryKind "room".
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
      <div className="flex justify-center mb-3.5">
        <div
          className="w-16 h-16 rounded-[18px] rotate-45 flex items-center justify-center overflow-hidden [&>*]:-rotate-45
            bg-[radial-gradient(120%_120%_at_30%_20%,color-mix(in_srgb,var(--jt-accent)_55%,transparent),var(--jt-surface))]
            border border-jt-accent-border shadow-[0_14px_30px_-12px_color-mix(in_srgb,var(--jt-accent)_65%,transparent)]"
        >
          {selectedGame?.logo ? (
            <img src={selectedGame.logo} alt="" className="w-[60%] h-[60%] object-cover rounded-lg" />
          ) : (
            <span className="text-[26px] leading-none">{selectedGame?.icon ?? "🎮"}</span>
          )}
        </div>
      </div>

      <div className="text-center mb-[18px]">
        <h2 className="m-0 text-xl font-extrabold tracking-[-0.01em] text-jt-accent-strong">{selectedGame?.label ?? "Jugar online"}</h2>
        <p className="mt-1.5 text-[13px] text-jt-muted-text">Creá una sala nueva o unite a una con su código.</p>
      </div>

      <div className="flex justify-center mb-[18px]">
        <NamePillEditor name={playerName} avatarSize={20} />
      </div>

      <ErrorBanner message={error} flashKey={errorKey} variant="block" />

      <div className="flex gap-7 justify-center border-b border-jt-card-border mb-5" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "create"}
          className={tabClass(activeTab === "create")}
          onClick={() => selectTab("create")}
        >
          Crear sala
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "join"}
          className={tabClass(activeTab === "join")}
          onClick={() => selectTab("join")}
        >
          Unirme
        </button>
      </div>

      <div className="animate-[jt-rise_0.35s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none">
        {activeTab === "create" ? (
          <Btn onClick={onCreateRoom} disabled={submitting} variant="success" className="jt-home-cta-btn">
            {submitting ? "Creando..." : "Crear partida"}
          </Btn>
        ) : (
          <>
            <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-jt-accent-strong mb-2" htmlFor="jt-room-code">
              Código de sala
            </label>
            <input
              id="jt-room-code"
              className={clsx(FIELD_INPUT, "text-center text-2xl font-extrabold tracking-[0.2em] uppercase")}
              placeholder="XXXXX"
              maxLength={5}
              value={joinCode}
              onChange={e => onJoinCodeChange(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              onClick={() => onShowScanner(true)}
              className="flex items-center justify-center gap-1.5 w-full mt-3 py-2.5 rounded-xl border border-dashed border-[rgba(127,119,221,0.3)]
                text-jt-accent-strong cursor-pointer text-[13px] font-bold font-[inherit] transition-colors hover:border-jt-accent-border hover:bg-jt-accent-soft"
            >
              <QrIcon /> Escanear código QR
            </button>

            {roomPreview &&
              roomPreview.code === joinCode.trim().toUpperCase() &&
              (roomPreview.found ? (
                <div className="mt-3 px-2.5 py-2 rounded-lg bg-[rgba(93,202,165,0.1)] border border-[rgba(93,202,165,0.3)]">
                  <p className="m-0 text-[13px] text-[#5dcaa5]">
                    {getGame(roomPreview.gameType ?? "")?.icon} Vas a unirte a: <b>{roomPreview.name}</b>
                  </p>
                  {selectedGame && roomPreview.gameType !== selectedGame.id && (
                    <p className="mt-1 text-[11px] text-[#ef9f27]">
                      Ojo: esa sala es de {getGame(roomPreview.gameType ?? "")?.label ?? roomPreview.gameType}, no de {selectedGame.label}
                    </p>
                  )}
                </div>
              ) : roomPreview.isGroupCode ? (
                <div className="mt-3 px-3 py-2.5 rounded-lg bg-[rgba(226,196,74,0.1)] border border-[rgba(226,196,74,0.3)]">
                  <p className="m-0 text-[13px] text-[#e2c44a]">
                    Ese código es de un grupo
                    {roomPreview.name ? (
                      <>
                        {" "}
                        (<b>{roomPreview.name}</b>)
                      </>
                    ) : null}
                    , no de una sala.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <Btn variant="success" onClick={() => onSwitchToGroup?.(roomPreview.code)} className="px-3.5 py-1.5 text-[13px] flex-1">
                      Unirme al grupo
                    </Btn>
                    <Btn variant="ghost" onClick={() => onJoinCodeChange("")} className="px-3.5 py-1.5 text-[13px] flex-1">
                      Cancelar
                    </Btn>
                  </div>
                </div>
              ) : (
                <p className="mt-2.5 text-xs text-jt-muted-text leading-[1.5]">No encontramos ninguna sala con ese código</p>
              ))}

            <Btn onClick={onJoinRoom} disabled={submitting} variant="success" className="jt-home-cta-btn mt-3.5">
              {submitting ? "Uniéndose..." : "Unirse →"}
            </Btn>
          </>
        )}
      </div>

      {showScanner && <QRScannerDialog title="Escaneá el QR de la sala" onScan={onScan} onClose={() => onShowScanner(false)} />}
    </div>
  );
}
