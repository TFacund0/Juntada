// ─── Frontend Game Contract ──────────────────────────────────────────────────
// Mirrors the contract documented as a comment in registry.js. Every game's
// index.jsx exports an object shaped like this; registry.js itself stays JS
// (each game module is still .jsx), so callers cast getGame()'s return to
// this type rather than the registry inferring it on its own.

import type { ComponentType } from "react";
import type { RoomPublicState } from "@juntada/shared-types";

export interface ConfigPanelProps {
  room: RoomPublicState;
  updateConfig: (patch: Record<string, unknown>) => void;
}

export interface RoundViewProps {
  room: RoomPublicState;
  me: { playerId: string; roomCode: string } | null;
  myPlayer: RoomPublicState["players"][number] | undefined;
  myRole: Record<string, unknown> | null;
  wordReveal: Record<string, unknown> | null;
  isHost: boolean;
  send: (msg: Record<string, unknown>) => void;
}

export interface LobbyInfoProps {
  room: RoomPublicState;
}

// Groups games in the picker screen (search + category sections). A game
// without a category falls into "otros" — see CATEGORY_LABEL in GamePicker.
export type GameCategory = "destacados" | "grupo" | "rapidos" | "equipos" | "otros";

export interface GameDef {
  id: string;
  label: string;
  icon?: string;
  description: string;
  minPlayers?: number;
  category?: GameCategory;
  LocalGame: ComponentType<Record<string, never>>;
  ConfigPanel?: ComponentType<ConfigPanelProps>;
  RoundView?: ComponentType<RoundViewProps>;
  LobbyInfo?: ComponentType<LobbyInfoProps>;
  comingSoon?: boolean;
  // Already released but temporarily blocked from being played while it's
  // being reworked — distinct from comingSoon (never launched yet). Gated
  // the same way (no "start round"), but labeled "En mantenimiento".
  maintenance?: boolean;
  localOnly?: boolean;
  rules?: string[];
  // Splits the online lobby into "Jugadores"/"Configuración" tabs instead of
  // stacking the player list and ConfigPanel one after another — worth it
  // once ConfigPanel has enough going on (its own sub-tabs, a longer list)
  // that the stacked layout reads as cluttered. Off by default since most
  // games' ConfigPanel is short enough that splitting it just adds a click.
  tabbedLobby?: boolean;
  // Extra readiness gate on top of the generic minPlayers check, for games
  // whose "can we start?" condition isn't just headcount (e.g. ruleta needs
  // at least 2 entries loaded, regardless of how many players are in the
  // room). Return a user-facing reason the room isn't ready yet, or null
  // once it is — the online lobby's "Iniciar ronda" bar disables itself and
  // shows this reason (mirrors the same check local mode does on its own
  // "Empezar a girar"/"Iniciar ronda" button, so online and local always
  // agree on when a game is startable).
  canStart?: (room: RoomPublicState) => string | null;
  // Label for the online lobby's start button — defaults to "Iniciar ronda".
  // Set when a game's own local-mode button uses different wording (ruleta:
  // "Empezar a girar") so online and local always say the same thing.
  startLabel?: string;
}
