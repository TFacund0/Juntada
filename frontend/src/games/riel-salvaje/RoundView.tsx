import { useEffect, useRef, useState } from "react";
import type { RoundViewProps } from "../gameTypes";
import { useIsPortrait } from "./useIsPortrait";
import { Timer } from "../../components/Timer";
import "./rielSalvaje.css";

// Fase 4 del PLAN.md: pulido visual calcado del artifact "Riel Salvaje —
// Set completo de pantallas (horizontal)" — misma estructura de pantallas
// (HUD + tira de Pistolero, tren con techo/cuerpo, panel lateral, perfil de
// jugador con tabs, evento de fin de ronda a pantalla completa, etc.), con
// las clases de rielSalvaje.css. Referencia visual, no spec exacta — no
// todos los estados posibles del juego estaban cubiertos ahí (PLAN.md
// Fase 4), así que algunos huecos se resolvieron con criterio propio,
// marcados en los comentarios de abajo.
//
// Las formas de acá abajo son un espejo ad-hoc de lo que
// backend/src/games/riel-salvaje/engine.ts manda en getPublicRoundView/
// getPrivateView — no hay paquete compartido porque no hay modo local que
// lo necesite (ver DESIGN.md sección 7).

type Layer = "interior" | "techo";
type CargoKind = "bolsa" | "joya" | "maletin";

interface RsCargoItem {
  id: string;
  kind: CargoKind;
  value: number | null;
}
interface RsSlot {
  occupantIds: string[];
  items: RsCargoItem[];
}
interface RsWagon {
  index: number;
  isLocomotora: boolean;
  interior: RsSlot;
  techo: RsSlot;
}
interface RsPlayer {
  id: string;
  character: string;
  position: { wagonIndex: number; layer: Layer };
  handSize: number;
  drawPileSize: number;
  cargo: RsCargoItem[];
  ownBulletStock: number;
  bulletsReceivedTotal: number;
}
interface RsStackEntry {
  ownerId: string;
  faceDown: boolean;
  kind: string | null;
}
interface RsFinalScore {
  playerId: string;
  cargoTotal: number;
  pistolero: boolean;
  total: number;
}
interface RielSalvajeRoundView {
  train: RsWagon[];
  marshal: { position: { wagonIndex: number; layer: Layer } };
  players: RsPlayer[];
  sharedNeutralBulletsRemaining: number;
  secondBriefcasePlaced: boolean;
  round: {
    roundNumber: number;
    cardId: string;
    event: string | null;
    turns: string[];
    phase: "planning" | "action" | "round_event";
    turnOrder: string[];
    currentPlayerId: string | null;
    turnsCompleted: number;
    stack: RsStackEntry[];
    actionCursor: number;
    planningTurnTimerEnd: number | null;
  };
  stage: "planning" | "action" | "round_event" | "finished";
  pistoleroWinnerIds: string[] | null;
  winnerIds: string[] | null;
  finalScores: RsFinalScore[] | null;
}
interface RielSalvajePrivateView {
  hand: { id: string; kind: string }[];
  cargoValues: { id: string; value: number }[];
  ownFaceDownStack: { index: number; kind: string }[];
}

// ASUNCIÓN: debe coincidir con STARTING_BULLET_STOCK del motor
// (backend/src/games/riel-salvaje/rules.ts) — la vista pública no manda el
// máximo, solo lo que queda, y el perfil de cada jugador necesita el total
// para mostrar "disparos dados" (no solo balas restantes).
const MAX_BULLET_STOCK = 6;

const CARD_LABEL: Record<string, string> = {
  mover: "Mover",
  cambiar_piso: "Cambiar de piso",
  disparar: "Disparar",
  robar: "Robar",
  golpear: "Golpear",
  mover_marshal: "Mover al Marshal",
  bala: "Bala",
};
const CARGO_LABEL: Record<CargoKind, string> = { bolsa: "Bolsa de dinero", joya: "Joya", maletin: "Maletín" };
const CHARACTER_LABEL: Record<string, string> = {
  vibora: "Víbora",
  trueno: "Trueno",
  sombra: "Sombra",
  buho: "Búho",
  dalia: "Dalia",
  urraca: "Urraca",
};
const CHARACTER_ICON: Record<string, string> = { vibora: "🐍", trueno: "⚡", sombra: "🌑", buho: "🦉", dalia: "🌸", urraca: "🐦" };
const CHARACTER_COLOR: Record<string, string> = {
  vibora: "#b3261e",
  trueno: "#4a6e56",
  sombra: "#8b6dab",
  buho: "#5a86a3",
  dalia: "#c96b8f",
  urraca: "#c9974f",
};
const CHARACTER_ABILITY: Record<string, string> = {
  vibora:
    "Puede disparar a un bandido en su mismo vagón, pero en otro piso — el único caso donde se puede disparar dentro del propio vagón.",
  trueno: "Su disparo siempre empuja al objetivo un vagón (elige la dirección), además de darle la bala.",
  sombra:
    "Su primer turno de cada ronda lo juega boca abajo, aunque no sea Túnel — si roba en vez de jugar ese turno, pierde la habilidad esa ronda.",
  buho: "Arranca cada ronda con 7 cartas para elegir en vez de 6.",
  dalia: "No puede ser objetivo de disparo o puñetazo si hay otro bandido que sea un blanco válido.",
  urraca: "Si su puñetazo hace soltar una bolsa (no joya ni maletín), se la queda para ella en el acto.",
};
const EVENT_LABEL: Record<string, string> = {
  marshal_furioso: "Marshal furioso",
  brazo_giratorio: "Brazo giratorio",
  frenada: "Frenada",
  llevatelo_todo: "¡Llevátelo todo!",
  rebelion_de_pasajeros: "Rebelión de pasajeros",
  carterismo: "Carterismo",
  venganza_del_marshal: "Venganza del Marshal",
  secuestro_del_conductor: "Secuestro del conductor",
  alarma_en_el_tren: "Alarma en el tren",
};
const EVENT_DESC: Record<string, string> = {
  marshal_furioso:
    "El Marshal dispara a todos los bandidos que están en el techo de su vagón — cada uno recibe una bala neutral. Después avanza un vagón hacia la cola.",
  brazo_giratorio: "Todos los bandidos que están en un techo se mueven al techo del último vagón.",
  frenada: "Todos los bandidos que están en un techo avanzan un vagón hacia la Locomotora.",
  llevatelo_todo: "Se coloca el segundo maletín ($1000) en el vagón donde está el Marshal.",
  rebelion_de_pasajeros: "Todos los bandidos que están en el interior de un vagón reciben una bala neutral.",
  carterismo: "Cada bandido que está solo en su posición se lleva gratis una bolsa de dinero de ahí, si hay.",
  venganza_del_marshal: "Cada bandido en el techo justo encima del vagón del Marshal pierde su bolsa de menor valor.",
  secuestro_del_conductor: "Cada bandido en la Locomotora (interior o techo) recibe un rescate de $250.",
  alarma_en_el_tren: "Cada bandido que está en un techo recibe una bala neutral.",
};

// Nombre de la carta de ronda (distinto del evento que dispara — "Vía
// libre" y "Freno", por ejemplo, no comparten nombre con ningún evento).
const ROUND_CARD_LABEL: Record<string, string> = {
  marshal_furioso: "Marshal furioso",
  gancho_de_correo: "Gancho de correo",
  freno: "Freno",
  a_por_todas: "¡A por todas!",
  rebelion_de_pasajeros: "Rebelión de pasajeros",
  via_libre: "Vía libre",
  silbato_de_alarma: "Silbato de alarma",
  carterismo: "Carterismo",
  venganza_del_marshal: "Venganza del Marshal",
  secuestro_del_conductor: "Secuestro del conductor",
};
const TURN_ICON_LABEL: Record<string, string> = {
  boca_arriba: "Boca arriba",
  tunel: "Túnel",
  acelerar: "Acelerar",
  cambio_de_via: "Cambio de vía",
};
const TURN_ICON_GLYPH: Record<string, string> = { boca_arriba: "↑", tunel: "🔒", acelerar: "⚡", cambio_de_via: "↺" };
const TURN_ICON_DESC: Record<string, string> = {
  boca_arriba: "Se juega visible para todos apenas se coloca.",
  tunel: "Se juega oculta — recién se revela cuando le toca resolverse en la fase de Acción.",
  acelerar: "Ese turno jugás 2 cartas seguidas (o robás 3 nuevas, como siempre, en vez de jugar).",
  cambio_de_via: "Desde este turno el orden de juego se invierte, arrancando de nuevo por el Jugador Inicial.",
};

function charColor(id: string, view: RielSalvajeRoundView): string {
  const p = view.players.find(pl => pl.id === id);
  return p ? (CHARACTER_COLOR[p.character] ?? "#c9974f") : "#9a9082";
}

// Íconos como SVG en vez de emoji — el emoji trae su propio color fijo
// (⚙️ se ve celeste en la mayoría de plataformas) que no combina con la
// paleta western; con `currentColor` el ícono toma el color del botón.
function GearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.36.86.6 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="11" />
      <circle cx="12" cy="7.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TrainIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="12" rx="2" />
      <path d="M4 10h16" />
      <path d="M8 16l-2 4M16 16l2 4" />
      <circle cx="8" cy="13" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="13" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Ícono de carta de acción / botín como SVG en vez de emoji — mismo motivo
// que GearIcon/InfoIcon: `currentColor` combina con el ink de la carta de
// papel o el texto del panel oscuro, en vez de traer su propio color/estilo
// fijo de emoji.
function CardGlyph({ kind, size = 18 }: { kind: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "mover":
      return (
        <svg {...common}>
          <path d="M13 6l6 6-6 6" />
          <path d="M11 18l-6-6 6-6" />
        </svg>
      );
    case "cambiar_piso":
      return (
        <svg {...common}>
          <path d="M8 3v18M16 3v18" />
          <path d="M8 8h8M8 16h8" />
        </svg>
      );
    case "disparar":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      );
    case "robar":
      return (
        <svg {...common}>
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          <path d="M6 8h12l-1 12.5A1.5 1.5 0 0 1 15.5 22h-7A1.5 1.5 0 0 1 7 20.5L6 8Z" />
        </svg>
      );
    case "golpear":
      return (
        <svg {...common}>
          <path d="M6 15V9a2 2 0 0 1 4 0" />
          <path d="M10 9a2 2 0 0 1 4 0v1" />
          <path d="M14 10a2 2 0 0 1 4 0v2" />
          <path d="M18 12a2 2 0 0 1 3 1.8v2.7A5.5 5.5 0 0 1 15.5 22H12a5 5 0 0 1-4-2l-2.5-3.2c-.6-.9-.2-2 .8-2.3.6-.2 1.3 0 1.7.6L10 17" />
        </svg>
      );
    case "mover_marshal":
      return (
        <svg {...common}>
          <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 2Z" />
        </svg>
      );
    case "bala":
      return (
        <svg {...common}>
          <path d="M9 15h6l-.7 6.3a1 1 0 0 1-1 .7h-2.6a1 1 0 0 1-1-.7L9 15Z" />
          <path d="M9 15c0-4 1-8 3-12 2 4 3 8 3 12" />
        </svg>
      );
    case "bolsa":
      return (
        <svg {...common}>
          <path d="M9 8l.8-3.5a2 2 0 0 1 2-1.5h.4a2 2 0 0 1 2 1.5L15 8" />
          <path d="M5.5 8h13L17 20.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.5L5.5 8Z" />
        </svg>
      );
    case "joya":
      return (
        <svg {...common}>
          <path d="M6 9l3-6h6l3 6-6 12-6-12Z" />
          <path d="M6 9h12M9 3l3 6 3-6" />
        </svg>
      );
    case "maletin":
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="12" rx="2" />
          <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 14h18" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="4" y="9" width="16" height="12" rx="1.5" />
          <path d="M8 9V6a4 4 0 0 1 8 0v3" />
        </svg>
      );
  }
}

interface PendingResolve {
  targetId?: string;
  itemId?: string;
  direction?: 1 | -1;
  distance?: number;
  pushDirection?: 1 | -1;
}

export function RoundView({ room, me, send, myRole, onExitToMainMenu }: RoundViewProps) {
  const isPortrait = useIsPortrait();
  const view = room.round as RielSalvajeRoundView | null;
  const priv = myRole as RielSalvajePrivateView | null;
  const [pending, setPending] = useState<PendingResolve>({});
  const [profileOpenFor, setProfileOpenFor] = useState<string | null>(null);
  const [helpTab, setHelpTab] = useState<"reglas" | "personajes" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsConfirm, setSettingsConfirm] = useState<"lobby" | null>(null);
  const [handHidden, setHandHidden] = useState(false);
  const [roundCardInfoOpen, setRoundCardInfoOpen] = useState(false);
  const [trainModalOpen, setTrainModalOpen] = useState(false);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number | null>(null);

  const myId = me?.playerId;
  const actionCursor = view?.round.phase === "action" ? view.round.actionCursor : -1;
  useEffect(() => {
    setPending({});
  }, [actionCursor, view?.round.phase]);

  // ─── Evento de fin de ronda — interstitial de pantalla completa ─────────
  // El server resuelve el evento y cierra la ronda en el mismo mensaje (no
  // hay una fase "round_event" separada que el cliente pueda esperar) — acá
  // se detecta la transición de ronda y se recuerda cuál fue el último
  // evento visto antes de saltar, para mostrarlo un momento como pantalla
  // completa, igual que en el artifact (pantalla 4/8).
  const lastRoundNumberRef = useRef<number | null>(null);
  const lastEventRef = useRef<string | null>(null);
  const [eventScreen, setEventScreen] = useState<{ event: string; fromRound: number } | null>(null);
  useEffect(() => {
    if (!view) return;
    const prevRoundNumber = lastRoundNumberRef.current;
    if (prevRoundNumber !== null && view.round.roundNumber !== prevRoundNumber && lastEventRef.current) {
      setEventScreen({ event: lastEventRef.current, fromRound: prevRoundNumber });
    }
    lastRoundNumberRef.current = view.round.roundNumber;
    lastEventRef.current = view.round.event;
  }, [view?.round.roundNumber, view?.round.event]);

  if (!view) return <p style={{ color: "#9a9082", fontFamily: "Syne, sans-serif", textAlign: "center", padding: 24 }}>Cargando partida…</p>;

  if (isPortrait && view.stage !== "finished") {
    return (
      <div className="rs-rotate-prompt">
        <span style={{ fontSize: 54 }}>🔄</span>
        <p className="rs-display" style={{ fontSize: 20, margin: 0, color: "#e8d9b5" }}>
          Girá tu teléfono
        </p>
        <p style={{ color: "#9a9082", fontSize: 13, margin: 0, maxWidth: 260 }}>
          El tren se ve mejor de costado — poné el teléfono horizontal.
        </p>
      </div>
    );
  }

  const nameOf = (id: string) => room.players.find(p => p.id === id)?.name ?? "?";
  const myValues = new Map((priv?.cargoValues ?? []).map(c => [c.id, c.value]));
  const myPublicPlayer = view.players.find(p => p.id === myId);
  const wagonLabel = (w: RsWagon) => (w.isLocomotora ? "Locomotora" : `Vagón ${w.index}`);

  const lootChip = (item: RsCargoItem, mine: boolean) => {
    const value = item.value ?? (mine ? myValues.get(item.id) : undefined) ?? null;
    const known = value != null;
    return (
      <span
        key={item.id}
        className={`rs-loot-chip ${known ? "rs-known" : "rs-hidden"}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 2 }}
      >
        <CardGlyph kind={item.kind} size={11} />
        {known && value}
      </span>
    );
  };

  // ================= HUD =================
  const Hud = (
    <div className="rs-hud" style={{ position: "relative" }}>
      <div className="rs-hud-left">
        <span className="rs-round-tag">
          RONDA {view.round.roundNumber}/5 · {view.round.phase === "planning" ? "PLANIFICACIÓN" : "ACCIÓN"}
        </span>
      </div>
      <div className="rs-hud-stats">
        <button type="button" className="rs-icon-btn" onClick={() => setTrainModalOpen(true)} title="Ver el tren">
          <TrainIcon />
        </button>
        <button type="button" className="rs-icon-btn" onClick={() => setHelpTab("reglas")} title="Cómo se juega">
          ?
        </button>
        <button
          type="button"
          className="rs-icon-btn"
          onClick={() => {
            setSettingsOpen(v => !v);
            setSettingsConfirm(null);
          }}
          title="Ajustes"
        >
          <GearIcon />
        </button>
      </div>
      {settingsOpen && (
        <div className="rs-settings-menu">
          {settingsConfirm === "lobby" ? (
            <>
              <p className="rs-settings-confirm-msg">
                Se interrumpe la partida para todos y se pierde el progreso. ¿Volver al lobby de la sala?
              </p>
              <button type="button" className="rs-danger-item" onClick={() => send({ type: "back_to_lobby" })}>
                Sí, volver al lobby
              </button>
              <button type="button" onClick={() => setSettingsConfirm(null)}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setSettingsConfirm("lobby")}>
                🚪 Volver al lobby de la sala
              </button>
              {onExitToMainMenu && (
                <button
                  type="button"
                  className="rs-danger-item"
                  onClick={() => {
                    setSettingsOpen(false);
                    onExitToMainMenu();
                  }}
                >
                  🏠 Salir al menú principal
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  // Tira de jugadores — a pedido, solo color + nombre acá (nada de detalle
  // de botín/disparos en la pantalla principal); tocar a cualquiera abre su
  // perfil completo (ProfileOverlay más abajo), que es donde vive todo ese
  // detalle — tanto el propio como el de un rival.
  // A quién le toca ahora mismo — para resaltar su ficha en la tira y que
  // quede obvio de un vistazo, sin tener que leer el texto de "turno de...".
  const currentTurnPlayerId =
    view.round.phase === "planning" ? view.round.currentPlayerId : (view.round.stack[view.round.actionCursor]?.ownerId ?? null);

  const PlayersStrip = (
    <div className="rs-pistolero-strip">
      <div className="rs-pistolero-row">
        {view.players.map(p => (
          <button
            key={p.id}
            type="button"
            className={`rs-pistolero-chip ${p.id === currentTurnPlayerId ? "rs-current-turn" : ""}`}
            onClick={() => setProfileOpenFor(p.id)}
            style={{ borderColor: p.id === currentTurnPlayerId ? CHARACTER_COLOR[p.character] : undefined, cursor: "pointer" }}
          >
            <span className="rs-who-dot" style={{ background: CHARACTER_COLOR[p.character] }} />
            <span style={{ fontSize: "0.72rem", color: "#e8d9b5", fontFamily: "Syne, sans-serif" }}>
              {nameOf(p.id)}
              {p.id === myId ? " (vos)" : ""}
            </span>
            {p.id === currentTurnPlayerId && <span style={{ fontSize: 10 }}>👉</span>}
          </button>
        ))}
      </div>
    </div>
  );

  // ================= tren ================= (siempre visible, tira compacta)
  const TrainStrip = (
    <div className="rs-train-strip-h">
      {view.train.map(w => {
        const isMine = myPublicPlayer?.position.wagonIndex === w.index;
        return (
          <div key={w.index} className={`rs-unit ${w.isLocomotora ? "rs-locomotive" : ""} ${isMine ? "rs-active" : ""}`}>
            <div className={`rs-roof-shape ${view.marshal.position.wagonIndex === w.index ? "rs-marshal" : ""}`}>
              {view.marshal.position.wagonIndex === w.index && <span className="rs-marshal-ico">🤠</span>}
              {w.techo.occupantIds.length === 0 && w.techo.items.length === 0 && view.marshal.position.wagonIndex !== w.index && (
                <span className="rs-empty-lbl">vacío</span>
              )}
              {w.techo.occupantIds.map(id => (
                <span
                  key={id}
                  className="rs-occ-dot"
                  title={nameOf(id)}
                  style={{ background: charColor(id, view), cursor: "pointer" }}
                  onClick={() => setProfileOpenFor(id)}
                />
              ))}
              {w.techo.items.map(i => lootChip(i, false))}
            </div>
            <div className="rs-car-body">
              <div className="rs-wname">{wagonLabel(w)}</div>
              <div className="rs-loot-row">{w.interior.items.map(i => lootChip(i, isMine))}</div>
              {w.interior.occupantIds.length > 0 && (
                <div className="rs-occ-row">
                  {w.interior.occupantIds.map(id => (
                    <span
                      key={id}
                      className="rs-occ-dot"
                      title={nameOf(id)}
                      style={{ background: charColor(id, view), cursor: "pointer" }}
                      onClick={() => setProfileOpenFor(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ================= pantalla final =================
  if (view.stage === "finished") {
    const scores = [...(view.finalScores ?? [])].sort((a, b) => b.total - a.total);
    return (
      <div className="rs-root">
        <div className="rs-final-hero">
          <p className="rs-display" style={{ fontSize: 22, color: "#e8d9b5", margin: 0 }}>
            {view.winnerIds && view.winnerIds.length > 1
              ? `Empate entre ${view.winnerIds.map(nameOf).join(" y ")}`
              : view.winnerIds
                ? `¡Ganó ${nameOf(view.winnerIds[0])}!`
                : "Partida terminada"}
          </p>
          {view.pistoleroWinnerIds && view.pistoleroWinnerIds.length > 0 && (
            <p className="rs-mono" style={{ color: "#ffd27a", fontSize: 12, marginTop: 8 }}>
              🏆 Título de Pistolero (+$1000): {view.pistoleroWinnerIds.map(nameOf).join(", ")}
            </p>
          )}
        </div>
        <div className="rs-final-body">
          {scores.map(s => (
            <div key={s.playerId} className="rs-score-row">
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="rs-who-dot" style={{ background: charColor(s.playerId, view) }} />
                <strong style={{ color: "#e8d9b5", fontFamily: "'Roboto Slab', Georgia, serif" }}>{nameOf(s.playerId)}</strong>
              </span>
              <span className="rs-mono" style={{ color: "#c9974f" }}>
                ${s.total} {s.pistolero ? "🏆" : ""}
              </span>
            </div>
          ))}
          <button
            type="button"
            className="rs-event-continue"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => send({ type: "back_to_lobby" })}
          >
            Volver a la sala
          </button>
        </div>
      </div>
    );
  }

  // ================= carta de ronda / turnos =================
  const RoundCardStrip = (
    <button type="button" className="rs-roundcard-strip rs-roundcard-btn" onClick={() => setRoundCardInfoOpen(true)}>
      <div className="rs-turn-slots">
        {view.round.turns.map((turnIcon, i) => {
          const done = i < view.round.turnsCompleted;
          const now = i === view.round.turnsCompleted && view.round.phase === "planning";
          return (
            <div key={i} className={`rs-turn-slot ${done ? "rs-done" : ""} ${now ? "rs-now" : ""}`}>
              <div className="rs-box">{TURN_ICON_GLYPH[turnIcon] ?? "↑"}</div>
              <span className="rs-tl">T{i + 1}</span>
            </div>
          );
        })}
      </div>
      <span className="rs-roundcard-lbl" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        🃏 {ROUND_CARD_LABEL[view.round.cardId] ?? view.round.cardId} <InfoIcon />
      </span>
    </button>
  );

  // Explicación de la carta de ronda actual — a demanda (tocando el bloque
  // de arriba), no siempre visible, para no llenar la pantalla de texto una
  // vez que ya se aprendió a jugar.
  const closeRoundCardInfo = () => {
    setRoundCardInfoOpen(false);
    setSelectedTurnIndex(null);
  };

  const RoundCardInfoModal = roundCardInfoOpen && (
    <div className="rs-modal-backdrop" onClick={closeRoundCardInfo}>
      <div className="rs-modal-card" style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
        <button type="button" className="rs-overlay-close" style={{ position: "absolute", top: 0, right: 0 }} onClick={closeRoundCardInfo}>
          ✕
        </button>
        {/* Cartas de turno una al lado de la otra, horizontal — tocar
            cualquiera muestra la explicación de esa carta puntual acá abajo,
            en vez de listar las 4 siempre (más limpio). */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 2px 10px", justifyContent: "center" }}>
          {view.round.turns.map((turnIcon, i) => {
            const done = i < view.round.turnsCompleted;
            const now = i === view.round.turnsCompleted && view.round.phase === "planning";
            const selected = selectedTurnIndex === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedTurnIndex(prev => (prev === i ? null : i))}
                style={{
                  flex: "0 0 auto",
                  width: 56,
                  height: 74,
                  borderRadius: 8,
                  background: "#e8d9b5",
                  color: "#201a12",
                  border: `2px solid ${selected ? "#c9974f" : now ? "#ff4d3d" : "#201a12"}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  opacity: done ? 0.55 : 1,
                  cursor: "pointer",
                  boxShadow: selected ? "0 0 0 2px rgba(201,151,79,0.4)" : undefined,
                }}
              >
                <span style={{ fontSize: 20 }}>{TURN_ICON_GLYPH[turnIcon] ?? "↑"}</span>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", fontFamily: "'Roboto Slab', Georgia, serif" }}>
                  T{i + 1}
                </span>
                <span style={{ fontSize: 8, textAlign: "center", lineHeight: 1.2, padding: "0 2px" }}>
                  {TURN_ICON_LABEL[turnIcon] ?? turnIcon}
                </span>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: "#9a9082", lineHeight: 1.5, margin: "0 0 12px", textAlign: "left", minHeight: 32 }}>
          {selectedTurnIndex != null ? (
            <>
              <strong style={{ color: "#c9974f" }}>
                {TURN_ICON_GLYPH[view.round.turns[selectedTurnIndex]]} {TURN_ICON_LABEL[view.round.turns[selectedTurnIndex]]}:
              </strong>{" "}
              {TURN_ICON_DESC[view.round.turns[selectedTurnIndex]]}
            </>
          ) : (
            "Tocá una carta para ver qué significa ese turno."
          )}
        </p>
        <div
          style={{
            height: 2,
            margin: "2px 0 14px",
            background: "linear-gradient(90deg, transparent, #c9974f, transparent)",
          }}
        />
        <h3 className="rs-display" style={{ fontSize: 16, color: "#e8d9b5", margin: "0 0 6px", textAlign: "center" }}>
          🃏 {ROUND_CARD_LABEL[view.round.cardId] ?? view.round.cardId}
        </h3>
        <p style={{ fontSize: 12, color: "#9a9082", lineHeight: 1.5, margin: 0, fontFamily: "Georgia, serif", textAlign: "left" }}>
          {view.round.event
            ? EVENT_DESC[view.round.event]
            : 'No dispara ningún evento al final de la ronda — es la única carta "tranquila" del mazo.'}
        </p>
      </div>
    </div>
  );

  // ================= Pila central (Planificación y Acción) =================
  // Una sola pila de cartas creciendo en el centro, sin desglose por rival
  // — a propósito: acordarse quién tiró qué es parte de la estrategia del
  // juego, no algo que la UI deba resolver por vos. Debajo, la fila de
  // nombres con mini-badges de cuánto botín lleva cada uno (solo cantidad,
  // nunca valor — eso sigue siendo privado, ver perfil).
  const currentEntryForCursor = view.round.phase === "action" ? view.round.actionCursor : view.round.stack.length;
  const StagePile = (
    <div className="rs-stage-pile">
      {view.round.stack.map((entry, i) => {
        const kind = entry.kind ?? (entry.ownerId === myId ? priv?.ownFaceDownStack.find(e => e.index === i)?.kind : undefined);
        const isCurrent = view.round.phase === "action" && i === currentEntryForCursor;
        return (
          <div key={i} className={`rs-pile-card ${kind ? "" : "rs-pile-hidden"} ${isCurrent ? "rs-pile-current" : ""}`}>
            {kind ? <CardGlyph kind={kind} size={20} /> : <CardGlyph kind="hidden" size={20} />}
          </div>
        );
      })}
      {view.round.stack.length === 0 && <span style={{ fontSize: 11, color: "#9a9082" }}>Todavía no se jugó ninguna carta.</span>}
    </div>
  );

  const stageTurnPlayerId =
    view.round.phase === "planning" ? view.round.currentPlayerId : (view.round.stack[view.round.actionCursor]?.ownerId ?? null);
  const StageRoster = (
    <div className="rs-stage-roster">
      {view.players.map(p => (
        <button
          key={p.id}
          type="button"
          className={`rs-roster-chip ${p.id === stageTurnPlayerId ? "rs-current-turn" : ""}`}
          style={{ borderColor: p.id === stageTurnPlayerId ? CHARACTER_COLOR[p.character] : undefined }}
          onClick={() => setProfileOpenFor(p.id)}
        >
          <span className="rs-roster-name">
            <span className="rs-who-dot" style={{ background: CHARACTER_COLOR[p.character] }} />
            {nameOf(p.id)}
            {p.id === myId ? " (vos)" : ""}
            {p.id === stageTurnPlayerId && <span style={{ fontSize: 9 }}>👉</span>}
          </span>
          <span className="rs-mini-badges">
            <span>🎒{p.cargo.filter(i => i.kind === "bolsa").length}</span>
            <span>💎{p.cargo.filter(i => i.kind === "joya").length}</span>
            <span>💼{p.cargo.filter(i => i.kind === "maletin").length}</span>
          </span>
        </button>
      ))}
    </div>
  );

  // ================= Fase Planificación — pila/turnos en un modal centrado ===
  // A pedido: la pila creciendo + los nombres viven en un recuadro propio en
  // el medio de la pantalla, no incrustados en el tablero de fondo — que
  // sigue visible detrás (tren, HUD). Se cierra solo cuando la fase termina
  // (arranca la Acción). La MANO, en cambio, queda afuera del modal, como
  // panel fijo a la derecha del tren — si viviera adentro del modal tapa el
  // tren y se pierde el foco en él mientras elegís qué jugar.
  const PlanningModal = view.round.phase === "planning" && (
    <div className="rs-modal-backdrop">
      <div className="rs-modal-card" style={{ maxWidth: 480, position: "relative" }}>
        <button
          type="button"
          onClick={() => setRoundCardInfoOpen(true)}
          style={{
            display: "block",
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            color: "#c9974f",
            textAlign: "center",
            margin: "0 0 8px",
            fontFamily: "'Courier New', monospace",
          }}
        >
          🃏 {ROUND_CARD_LABEL[view.round.cardId] ?? view.round.cardId}
          {" — "}
          {view.round.event ? (EVENT_LABEL[view.round.event] ?? view.round.event) : "sin evento"} <InfoIcon />
        </button>
        <div className="rs-turn-slots" style={{ justifyContent: "center", marginBottom: 8 }}>
          {view.round.turns.map((turnIcon, i) => {
            const done = i < view.round.turnsCompleted;
            const now = i === view.round.turnsCompleted;
            return (
              <div key={i} className={`rs-turn-slot ${done ? "rs-done" : ""} ${now ? "rs-now" : ""}`}>
                <div className="rs-box">{TURN_ICON_GLYPH[turnIcon] ?? "↑"}</div>
                <span className="rs-tl">T{i + 1}</span>
              </div>
            );
          })}
        </div>
        <div style={{ height: 2, margin: "0 0 12px", background: "linear-gradient(90deg, transparent, #c9974f, transparent)" }} />
        <span className="rs-stage-turn-label" style={{ display: "block", marginBottom: 8 }}>
          {view.round.currentPlayerId === myId
            ? "Tu turno — elegí una carta"
            : `Turno de ${view.round.currentPlayerId ? nameOf(view.round.currentPlayerId) : "?"}`}
        </span>
        {view.round.planningTurnTimerEnd && (
          <Timer timerEnd={view.round.planningTurnTimerEnd} total={25} label="Si no jugás a tiempo, se juega una carta al azar" />
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {StagePile}
          <button
            type="button"
            className="rs-icon-btn"
            onClick={() => setTrainModalOpen(true)}
            title="Ver el tren"
            style={{ flex: "0 0 auto" }}
          >
            <TrainIcon />
          </button>
        </div>
        <div style={{ marginTop: 10 }}>{StageRoster}</div>
        {/* Tu mano se ve siempre acá abajo, no solo cuando te toca — cada
            jugador ve solo la suya (priv.hand ya es privado por diseño).
            Jugar una carta solo funciona en tu turno; mientras tanto quedan
            deshabilitadas, para que quede claro que todavía no podés. */}
        {priv && (
          <div style={{ marginTop: 14 }}>
            <p className="rs-side-title" style={{ marginBottom: 6 }}>
              Tu mano{view.round.currentPlayerId !== myId ? " (esperá tu turno)" : ""}
            </p>
            <div className="rs-hand-row">
              {priv.hand.map(card => (
                <button
                  key={card.id}
                  type="button"
                  className="rs-hand-card"
                  disabled={view.round.currentPlayerId !== myId}
                  onClick={() => send({ type: "play_card", cardId: card.id })}
                >
                  <CardGlyph kind={card.kind} size={22} />
                  <span className="rs-hand-card-label">{CARD_LABEL[card.kind] ?? card.kind}</span>
                </button>
              ))}
              <button
                type="button"
                className="rs-hand-card rs-ghost"
                disabled={view.round.currentPlayerId !== myId}
                onClick={() => send({ type: "draw_three" })}
              >
                <span className="rs-hand-card-label">Robar 3 cartas nuevas</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Panel de mano, fijo a la derecha del tren (no adentro del modal) —
  // siempre visible junto al tablero mientras se juega la Planificación.
  const HandSidePanel = (
    <div className="rs-side-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="rs-side-title">Tu mano{priv ? ` (${priv.hand.length})` : ""}</span>
        {priv && priv.hand.length > 0 && (
          <button
            type="button"
            className="rs-icon-btn"
            onClick={() => setHandHidden(v => !v)}
            title={handHidden ? "Mostrar mano" : "Ocultar mano"}
          >
            {handHidden ? "👁️" : "🙈"}
          </button>
        )}
      </div>
      {handHidden ? (
        <p style={{ color: "#9a9082", fontSize: 11, textAlign: "center" }}>Mano oculta — tocá 👁️ para verla.</p>
      ) : view.round.currentPlayerId === myId && priv ? (
        <>
          {priv.hand.map(card => (
            <button key={card.id} type="button" className="rs-mini-card" onClick={() => send({ type: "play_card", cardId: card.id })}>
              <span className="rs-icon">
                <CardGlyph kind={card.kind} size={18} />
              </span>
              <span className="rs-label">{CARD_LABEL[card.kind] ?? card.kind}</span>
            </button>
          ))}
          <button type="button" className="rs-mini-card rs-ghost" onClick={() => send({ type: "draw_three" })}>
            o robar 3 cartas nuevas
          </button>
        </>
      ) : (
        <p style={{ color: "#9a9082", fontSize: 11, textAlign: "center" }}>Esperando…</p>
      )}
    </div>
  );

  // ================= Fase Acción =================
  const currentEntry = view.round.phase === "action" ? view.round.stack[view.round.actionCursor] : undefined;
  const isMyEntry = !!currentEntry && currentEntry.ownerId === myId;
  const trueKind =
    currentEntry?.kind ?? (isMyEntry ? priv?.ownFaceDownStack.find(e => e.index === view.round.actionCursor)?.kind : undefined) ?? null;
  const otherPlayers = view.players.filter(p => p.id !== myId);
  const targetPlayer = pending.targetId ? view.players.find(p => p.id === pending.targetId) : undefined;

  const resolveControls = isMyEntry && trueKind && (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {(trueKind === "mover" || trueKind === "mover_marshal" || trueKind === "cambiar_piso") && (
        <>
          {trueKind === "cambiar_piso" ? (
            <button type="button" className="rs-ghost-btn" onClick={() => send({ type: "resolve_card" })}>
              Cambiar de piso
            </button>
          ) : trueKind === "mover" && myPublicPlayer?.position.layer === "techo" ? (
            <>
              <span className="rs-plan-prompt">Vagones: {pending.distance ?? 1}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="rs-ghost-btn"
                  onClick={() => setPending(prev => ({ ...prev, distance: Math.max(1, (prev.distance ?? 1) - 1) }))}
                >
                  −
                </button>
                <button
                  type="button"
                  className="rs-ghost-btn"
                  onClick={() => setPending(prev => ({ ...prev, distance: Math.min(view.train.length - 1, (prev.distance ?? 1) + 1) }))}
                >
                  +
                </button>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="rs-ghost-btn"
                  onClick={() => send({ type: "resolve_card", direction: -1, distance: pending.distance ?? 1 })}
                >
                  ◀ Locomotora
                </button>
                <button
                  type="button"
                  className="rs-ghost-btn"
                  onClick={() => send({ type: "resolve_card", direction: 1, distance: pending.distance ?? 1 })}
                >
                  Cola ▶
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="rs-ghost-btn" onClick={() => send({ type: "resolve_card", direction: -1 })}>
                ◀ Locomotora
              </button>
              <button type="button" className="rs-ghost-btn" onClick={() => send({ type: "resolve_card", direction: 1 })}>
                Cola ▶
              </button>
            </div>
          )}
        </>
      )}
      {trueKind === "robar" &&
        (() => {
          const mySlot = myPublicPlayer && view.train[myPublicPlayer.position.wagonIndex][myPublicPlayer.position.layer];
          const items = mySlot?.items ?? [];
          if (items.length <= 1) {
            return (
              <button type="button" className="rs-ghost-btn" onClick={() => send({ type: "resolve_card", itemId: items[0]?.id })}>
                {items.length === 0 ? "Nada acá — continuar" : `Robar ${CARGO_LABEL[items[0].kind]}`}
              </button>
            );
          }
          return (
            <>
              {items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="rs-mini-card"
                  onClick={() => send({ type: "resolve_card", itemId: item.id })}
                >
                  <span className="rs-icon">
                    <CardGlyph kind={item.kind} size={18} />
                  </span>
                  <span className="rs-label">{CARGO_LABEL[item.kind]}</span>
                </button>
              ))}
            </>
          );
        })()}
      {trueKind === "disparar" && (
        <>
          {otherPlayers.map(p => (
            <button
              key={p.id}
              type="button"
              className={`rs-ghost-btn ${pending.targetId === p.id ? "rs-on" : ""}`}
              onClick={() => setPending(prev => ({ ...prev, targetId: p.id }))}
            >
              {nameOf(p.id)}
            </button>
          ))}
          {myPublicPlayer?.character === "trueno" && pending.targetId && (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className={`rs-ghost-btn ${pending.direction === -1 ? "rs-on" : ""}`}
                onClick={() => setPending(prev => ({ ...prev, direction: -1 }))}
              >
                ◀ Empujar
              </button>
              <button
                type="button"
                className={`rs-ghost-btn ${pending.direction === 1 ? "rs-on" : ""}`}
                onClick={() => setPending(prev => ({ ...prev, direction: 1 }))}
              >
                Empujar ▶
              </button>
            </div>
          )}
          <button
            type="button"
            className="rs-confirm-btn"
            disabled={!pending.targetId || (myPublicPlayer?.character === "trueno" && !pending.direction)}
            onClick={() => send({ type: "resolve_card", targetId: pending.targetId, direction: pending.direction })}
          >
            Confirmar disparo
          </button>
        </>
      )}
      {trueKind === "golpear" && (
        <>
          {otherPlayers.map(p => (
            <button
              key={p.id}
              type="button"
              className={`rs-ghost-btn ${pending.targetId === p.id ? "rs-on" : ""}`}
              onClick={() => setPending(prev => ({ ...prev, targetId: p.id, itemId: undefined }))}
            >
              {nameOf(p.id)}
            </button>
          ))}
          {targetPlayer && targetPlayer.cargo.length > 0 && (
            <>
              {targetPlayer.cargo.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`rs-mini-card ${pending.itemId === item.id ? "rs-selected" : ""}`}
                  onClick={() => setPending(prev => ({ ...prev, itemId: item.id }))}
                >
                  <span className="rs-icon">
                    <CardGlyph kind={item.kind} size={18} />
                  </span>
                  <span className="rs-label">{CARGO_LABEL[item.kind]}</span>
                </button>
              ))}
            </>
          )}
          {pending.targetId && (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className={`rs-ghost-btn ${pending.pushDirection === -1 ? "rs-on" : ""}`}
                onClick={() => setPending(prev => ({ ...prev, pushDirection: -1 }))}
              >
                ◀ Locomotora
              </button>
              <button
                type="button"
                className={`rs-ghost-btn ${pending.pushDirection === 1 ? "rs-on" : ""}`}
                onClick={() => setPending(prev => ({ ...prev, pushDirection: 1 }))}
              >
                Cola ▶
              </button>
            </div>
          )}
          <button
            type="button"
            className="rs-confirm-btn"
            disabled={!pending.targetId || !pending.pushDirection}
            onClick={() =>
              send({ type: "resolve_card", targetId: pending.targetId, itemId: pending.itemId, pushDirection: pending.pushDirection })
            }
          >
            Confirmar golpe
          </button>
        </>
      )}
      {trueKind === "bala" && (
        <button type="button" className="rs-ghost-btn" onClick={() => send({ type: "resolve_card" })}>
          Continuar (no hace nada)
        </button>
      )}
    </div>
  );

  const ActionBody = view.round.phase === "action" && (
    <>
      {view.round.event && (
        <div className="rs-pending-event">
          ⚠ Evento pendiente al final: <strong>{EVENT_LABEL[view.round.event] ?? view.round.event}</strong>
        </div>
      )}
      <div className="rs-stage">
        {currentEntry ? (
          <span className="rs-stage-turn-label">
            {isMyEntry ? "Te toca resolver tu carta" : `Resolviendo la carta de ${nameOf(currentEntry.ownerId)}`}
          </span>
        ) : (
          <span className="rs-stage-turn-label">Resolviendo evento de fin de ronda…</span>
        )}
        {StagePile}
        {StageRoster}
      </div>
      {currentEntry && <div className="rs-action-below">{resolveControls}</div>}
    </>
  );

  // ================= perfil (overlay) =================
  const ProfileOverlay = profileOpenFor && (
    <div className="rs-overlay">
      <div className="rs-overlay-topbar">
        <span className="rs-round-tag">PERFIL DE JUGADOR</span>
        <button type="button" className="rs-overlay-close" onClick={() => setProfileOpenFor(null)}>
          ✕
        </button>
      </div>
      <div className="rs-player-tabs">
        {view.players.map(p => (
          <button
            key={p.id}
            type="button"
            className={`rs-player-tab ${profileOpenFor === p.id ? "rs-on" : ""}`}
            onClick={() => setProfileOpenFor(p.id)}
          >
            <span className="rs-who-dot" style={{ background: CHARACTER_COLOR[p.character] }} />
            {nameOf(p.id)}
            {p.id === myId ? " (vos)" : ""}
          </button>
        ))}
      </div>
      {(() => {
        const p = view.players.find(pl => pl.id === profileOpenFor);
        if (!p) return null;
        const mine = p.id === myId;
        const total = p.cargo.reduce((sum, item) => {
          const v = item.value ?? (mine ? myValues.get(item.id) : undefined);
          return v != null ? sum + v : sum;
        }, 0);
        const allKnown = p.cargo.every(item => item.value != null || (mine && myValues.has(item.id)));
        return (
          <div className="rs-profile-body">
            <div className="rs-profile-left">
              <div
                className="rs-profile-portrait"
                style={{ background: `linear-gradient(180deg, ${CHARACTER_COLOR[p.character]}aa, ${CHARACTER_COLOR[p.character]}55)` }}
              >
                {CHARACTER_ICON[p.character]}
              </div>
              <div>
                <p className="rs-profile-name">{CHARACTER_LABEL[p.character] ?? p.character}</p>
                <p className="rs-profile-pos">
                  📍 {wagonLabel(view.train[p.position.wagonIndex])} · {p.position.layer === "interior" ? "interior" : "techo"}
                </p>
                <div className="rs-profile-badges">
                  <span className="rs-badge">{p.cargo.length} ítems</span>
                  <span className="rs-badge">
                    🔫 {MAX_BULLET_STOCK - p.ownBulletStock} disparo{MAX_BULLET_STOCK - p.ownBulletStock === 1 ? "" : "s"} dado
                    {MAX_BULLET_STOCK - p.ownBulletStock === 1 ? "" : "s"} ({p.ownBulletStock} restante{p.ownBulletStock === 1 ? "" : "s"})
                  </span>
                  <span className="rs-badge rs-bullets">{p.bulletsReceivedTotal} balas recibidas</span>
                </div>
              </div>
              <div className="rs-ability-box">
                <div className="rs-lbl">Habilidad</div>
                <p>&ldquo;{CHARACTER_ABILITY[p.character]}&rdquo;</p>
              </div>
            </div>
            <div className="rs-profile-right">
              <div className="rs-inv-total">
                <span className="rs-lbl">{mine ? "Tu botín (solo vos lo ves)" : "Su botín (valor oculto)"}</span>
                <span className={`rs-v ${allKnown ? "" : "rs-unknown"}`}>{allKnown ? `$${total}` : `$${total || 0}+?`}</span>
              </div>
              <div className="rs-inv-list">
                {p.cargo.length === 0 && <p style={{ color: "#9a9082", fontSize: 12 }}>Nada todavía.</p>}
                {p.cargo.map(item => {
                  const value = item.value ?? (mine ? myValues.get(item.id) : undefined) ?? null;
                  // "Robar" solo aparece si es mi turno de Acción, la carta en
                  // curso es mía y es "robar", y el dueño del ítem comparte mi
                  // vagón y piso (mismas condiciones que exige el motor).
                  const canSteal =
                    !mine &&
                    isMyEntry &&
                    trueKind === "robar" &&
                    myPublicPlayer &&
                    p.position.wagonIndex === myPublicPlayer.position.wagonIndex &&
                    p.position.layer === myPublicPlayer.position.layer;
                  return (
                    <div key={item.id} className="rs-inv-row">
                      <div className="rs-ico">
                        <CardGlyph kind={item.kind} size={16} />
                      </div>
                      <div className="rs-meta">
                        <b>{CARGO_LABEL[item.kind]}</b>
                      </div>
                      <div className={`rs-val ${value == null ? "rs-unknown" : ""}`}>{value == null ? "?" : `$${value}`}</div>
                      {canSteal && (
                        <button type="button" className="rs-steal-btn" onClick={() => send({ type: "resolve_card", itemId: item.id })}>
                          Robar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ================= ayuda: reglas / personajes (overlay) =================
  const HelpOverlay = helpTab && (
    <div className="rs-overlay">
      <div className="rs-overlay-topbar">
        <span className="rs-round-tag">{helpTab === "reglas" ? "CÓMO SE JUEGA" : "PERSONAJES"}</span>
        <button type="button" className="rs-overlay-close" onClick={() => setHelpTab(null)}>
          ✕
        </button>
      </div>
      <div style={{ display: "flex", gap: 4, padding: "0 14px 8px" }}>
        <button type="button" className={`rs-ghost-btn ${helpTab === "reglas" ? "rs-on" : ""}`} onClick={() => setHelpTab("reglas")}>
          Reglas
        </button>
        <button
          type="button"
          className={`rs-ghost-btn ${helpTab === "personajes" ? "rs-on" : ""}`}
          onClick={() => setHelpTab("personajes")}
        >
          Personajes
        </button>
      </div>
      <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "0 14px 14px" }}>
        {helpTab === "reglas" ? (
          <>
            {[
              [
                "Fase Planificación",
                "Por turnos, cada jugador apila una carta en su propio mazo — boca arriba por defecto, o boca abajo si el turno es Túnel. En vez de jugar, podés robar 3 cartas nuevas.",
              ],
              [
                "Fase Acción",
                "Se resuelve el mazo de cada jugador en el orden en que se apiló. Las cartas ocultas recién se revelan al ejecutarse.",
              ],
              [
                "El Marshal",
                "Arranca en la Locomotora junto al maletín de $1000. Si comparte vagón con un bandido, ese jugador sube al techo y recibe una bala neutral.",
              ],
              [
                "Botín oculto",
                "Las bolsas valen entre $250 y $500, ocultas para todos salvo su dueño. Las joyas valen $500 y el maletín $1000 — esos se conocen de entrada.",
              ],
              ["Título de Pistolero", "Al final, quien más balas haya disparado gana $1000 (empates cobran todos)."],
              ["Fin de la partida", "5 rondas fijas. Gana quien tenga más botín — empate se resuelve por menos balas recibidas."],
            ].map(([title, desc]) => (
              <div key={title} style={{ marginBottom: 14 }}>
                <h4 className="rs-display" style={{ fontSize: 13, color: "#e8d9b5", margin: "0 0 4px" }}>
                  {title}
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: "#9a9082", lineHeight: 1.5, fontFamily: "Georgia, serif" }}>{desc}</p>
              </div>
            ))}
          </>
        ) : (
          Object.keys(CHARACTER_LABEL).map(id => (
            <div key={id} className="rs-inv-row" style={{ marginBottom: 8, alignItems: "flex-start" }}>
              <div className="rs-ico" style={{ background: CHARACTER_COLOR[id], width: 40, height: 40, fontSize: 20 }}>
                {CHARACTER_ICON[id]}
              </div>
              <div className="rs-meta">
                <b style={{ fontSize: 13 }}>{CHARACTER_LABEL[id]}</b>
                <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 11 }}>{CHARACTER_ABILITY[id]}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="rs-root" onClick={() => settingsOpen && setSettingsOpen(false)}>
      <div className="rs-content">
        {Hud}
        {PlayersStrip}
        {/* Durante Planificación el nombre/turnos de la carta de ronda ya se
            ven en el modal (PlanningModal más abajo) — mostrar este botón
            también acá se veía como un título repetido de fondo. */}
        {view.round.phase !== "planning" && RoundCardStrip}
        {view.round.phase === "action" && ActionBody}
        <div className="rs-play-body">
          {TrainStrip}
          {view.round.phase === "planning" && HandSidePanel}
        </div>
      </div>
      {PlanningModal}
      {trainModalOpen && (
        <div className="rs-modal-backdrop" onClick={() => setTrainModalOpen(false)}>
          <div className="rs-modal-card" style={{ maxWidth: 700, position: "relative" }} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="rs-overlay-close"
              style={{ position: "absolute", top: 0, right: 0 }}
              onClick={() => setTrainModalOpen(false)}
            >
              ✕
            </button>
            <h3 className="rs-display" style={{ fontSize: 16, color: "#e8d9b5", margin: "0 0 10px", textAlign: "center" }}>
              🚂 Situación del tren
            </h3>
            <div style={{ overflowX: "auto" }}>{TrainStrip}</div>
          </div>
        </div>
      )}
      {eventScreen && (
        <div className="rs-event-screen">
          <span className="rs-event-eyebrow">Evento de fin de ronda {eventScreen.fromRound}</span>
          <h3 className="rs-event-title">{EVENT_LABEL[eventScreen.event] ?? eventScreen.event}</h3>
          <p className="rs-event-desc">{EVENT_DESC[eventScreen.event] ?? ""}</p>
          <button type="button" className="rs-event-continue" onClick={() => setEventScreen(null)}>
            Continuar ▶
          </button>
        </div>
      )}
      {RoundCardInfoModal}
      {ProfileOverlay}
      {HelpOverlay}
    </div>
  );
}
