import { lazy } from "react";
import { DEFAULT_CATEGORIES } from "@juntada/tutifruti-data";
import type { GameDef } from "../gameTypes";

// Dynamic import() creates its own chunk even though this metadata object is
// imported eagerly by the registry — this keeps every game's actual code out
// of the initial bundle until the player picks that game (see registry.js).
const LocalGame = lazy(() => import("./LocalGame").then(m => ({ default: m.LocalGame })));
const ConfigPanel = lazy(() => import("./ConfigPanel").then(m => ({ default: m.ConfigPanel })));
const RoundView = lazy(() => import("./RoundView").then(m => ({ default: m.RoundView })));
const LobbyInfo = lazy(() => import("./LobbyInfo").then(m => ({ default: m.LobbyInfo })));

// Tutifrutti / Stop / Basta: se sortea una letra y todos completan a
// contrarreloj (o hasta que alguien grite "¡Basta!") una lista de categorías
// (país, animal, color, ...) con una palabra que empiece con esa letra. Luego
// entre todos marcan qué respuestas son válidas antes de sumar puntos.
export const tutifrutiGame: GameDef = {
  id: "tutifruti",
  label: "Tutifrutti",
  icon: "🍉",
  description:
    "Sale una letra al azar y todos completan categorías (país, animal, color...) con una palabra que empiece con esa letra, contrarreloj.",
  minPlayers: 2,
  category: "rapidos",
  maintenance: false,
  tabbedLobby: true,
  // Same gate the ConfigPanel's own "categoría activa" counter reflects —
  // surfaced here too so it shows up right under "Iniciar ronda" instead of
  // only inside the (possibly not-even-open) Configuración tab. Cross-checks
  // against the real category list rather than just reading the raw
  // activeCategories map: removing a custom category doesn't clear its
  // (now orphaned) `true` entry there, so a naive truthy check could read
  // "active" when ConfigPanel's own counter — and the backend's own
  // start-round gate — would both say zero.
  canStart: room => {
    const config = room.config as { activeCategories?: Record<string, boolean>; customCategories?: { id: string }[] };
    const active = config.activeCategories ?? {};
    const customIds = Array.isArray(config.customCategories) ? config.customCategories.map(c => c.id) : [];
    const realIds = [...DEFAULT_CATEGORIES.map(c => c.id), ...customIds];
    const hasActive = realIds.some(id => active[id]);
    return hasActive ? null : "Elegí al menos una categoría para poder empezar";
  },
  rules: [
    "Se sortea una letra al azar; el anfitrión puede cambiarla antes de arrancar.",
    'Todos completan, a contrarreloj (o hasta que alguien grite "¡Basta!"), una lista de categorías con una palabra que empiece con esa letra.',
    "Al terminar, entre todos marcan con tilde o cruz cada respuesta de los demás.",
    "- Una palabra válida y no repetida vale 10 puntos.",
    "- Una palabra repetida con otro jugador vale la mitad.",
    "- Una palabra con más cruces que tildes no suma puntos.",
    "Se juegan varias rondas (las que configure el anfitrión) y gana quien más puntos acumule.",
  ],
  LocalGame,
  ConfigPanel,
  RoundView,
  LobbyInfo,
};
