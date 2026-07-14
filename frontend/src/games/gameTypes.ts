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
}
