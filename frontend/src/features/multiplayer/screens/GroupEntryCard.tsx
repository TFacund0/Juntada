import clsx from "clsx";
import { Btn } from "../../../components/ui/Btn";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { NamePillEditor } from "../../../components/shell/NamePillEditor";
import { QRScannerDialog } from "../../../components/dialogs/QRScannerDialog";
import { QrIcon } from "../../../components/ui/icons";
import { useEntryTabs } from "../hooks/useEntryTabs";

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

const FIELD_INPUT =
  "w-full box-border rounded-2xl border border-jt-card-border bg-[color-mix(in_srgb,var(--jt-bg)_60%,transparent)] px-3.5 py-3 text-[15px] font-[inherit] text-[#e8e4f0] outline-none transition-colors placeholder:text-jt-muted-text focus:border-jt-accent-border";

const FIELD_LABEL = "block text-[11px] font-bold tracking-[0.08em] uppercase text-jt-accent-strong mb-2";

function tabClass(active: boolean): string {
  return clsx(
    "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-none text-sm font-semibold font-[inherit] cursor-pointer transition-all duration-[250ms]",
    active
      ? "text-white bg-[linear-gradient(135deg,var(--jt-accent-strong),var(--jt-accent))] shadow-[0_10px_26px_-12px_color-mix(in_srgb,var(--jt-accent)_70%,transparent)]"
      : "text-jt-muted-text hover:text-[#e8e4f0]",
  );
}

/**
 * Diseño propio (no el accordion de MenuScreen) para la entrada puntual a
 * "Crear grupo"/"Unirme a un grupo": tabs arriba, el formulario de la
 * pestaña activa abajo — pensado para vivir dentro de GroupEntryModal, no
 * como pantalla completa. Solo se usa cuando `entryKind === "group"`
 * (MultiplayerGame.tsx); el flujo de sala suelta (elegir juego → crear/
 * unirse a esa sala puntual) se queda con MenuScreen tal cual.
 *
 * El nombre del grupo es obligatorio (a diferencia de una sala suelta): el
 * botón "Crear grupo" queda deshabilitado hasta que se escriba algo (o se
 * use el dado) — un grupo vive más tiempo y lo ve más gente, así que no
 * alcanza con el nombre por defecto que pondría el backend si se manda
 * vacío (ver useMultiplayerGameShell.ts).
 */
export function GroupEntryCard({
  connectionPhase,
  error,
  errorKey,
  playerName,
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
  error: string;
  errorKey: number;
  playerName: string;
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
      <div className="text-center mb-[18px]">
        <h2 className="jt-text-gradient m-0 text-xl font-extrabold tracking-[-0.01em]">Juntá a tu grupo</h2>
        <p className="mt-1.5 text-[13px] text-jt-muted-text">Creá un grupo nuevo o sumate a uno con su código.</p>
      </div>

      <div className="flex justify-center mb-[18px]">
        <NamePillEditor name={playerName} avatarSize={20} />
      </div>

      <ErrorBanner message={error} flashKey={errorKey} variant="block" />

      <div
        className="flex gap-1 p-1 rounded-2xl border border-jt-card-border bg-[color-mix(in_srgb,var(--jt-bg)_50%,transparent)] mb-5"
        role="tablist"
      >
        <button
          role="tab"
          aria-selected={activeTab === "create"}
          className={tabClass(activeTab === "create")}
          onClick={() => selectTab("create")}
        >
          Crear grupo
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
          <>
            <label className={FIELD_LABEL} htmlFor="jt-group-name">
              Nombre del grupo
            </label>
            <div className="flex gap-2 items-stretch">
              <input
                id="jt-group-name"
                className={clsx(FIELD_INPUT, "flex-1")}
                placeholder="Ej: Los pibes"
                value={roomName}
                onChange={e => onRoomNameChange(e.target.value)}
              />
              <button
                type="button"
                className="shrink-0 w-12 rounded-2xl border border-jt-card-border bg-[color-mix(in_srgb,var(--jt-bg)_60%,transparent)] text-xl cursor-pointer transition-transform hover:border-jt-accent-border hover:scale-105 hover:-rotate-[8deg] active:scale-[0.94]"
                onClick={() => onRoomNameChange(randomGroupName())}
                aria-label="Generar nombre al azar"
                title="Generar nombre al azar"
              >
                🎲
              </button>
            </div>
            <Btn onClick={onCreateRoom} disabled={submitting || !roomName.trim()} variant="success" className="jt-home-cta-btn mt-4">
              {submitting ? "Creando..." : "Crear grupo"}
            </Btn>
          </>
        ) : (
          <>
            <label className={FIELD_LABEL} htmlFor="jt-group-code">
              Código del grupo
            </label>
            <input
              id="jt-group-code"
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
            <Btn onClick={onJoinRoom} disabled={submitting} variant="success" className="jt-home-cta-btn mt-4">
              {submitting ? "Uniéndose..." : "Unirme →"}
            </Btn>
          </>
        )}
      </div>

      {showScanner && <QRScannerDialog title="Escaneá el QR del grupo" onScan={onScan} onClose={() => onShowScanner(false)} />}
    </div>
  );
}
