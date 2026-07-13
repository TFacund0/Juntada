// ─── Ruleta Game Engine ──────────────────────────────────────────────────────
// El anfitrión carga las entradas (nombre + descripción opcional) y elige el
// modo desde el lobby (config). El servidor es quien decide el resultado de
// cada giro (para que todos vean el mismo resultado al mismo tiempo) y guarda
// la rotación acumulada para que la animación de la rueda sea continua entre
// giros. Modo eliminación: la entrada que sale se saca de la ruleta hasta que
// queda una sola (ahí termina la ronda). Modo repetir: se mantienen todas y
// se puede girar cuantas veces se quiera, llevando la cuenta de salidas.

import type { Room } from "@juntada/shared-types";
import type { GameEngine } from "../engineTypes";

const MIN_PLAYERS = 1;
const SPIN_MS = 4200;

interface Entry {
  id: string;
  name: string;
  description: string;
}

interface RuletaConfig {
  entries: Entry[];
  mode: "keep" | "eliminate";
  [key: string]: unknown;
}

interface RuletaRound {
  pool: Entry[];
  rotation: number;
  result: Entry | null;
  spinAt: number | null;
  eliminated: Entry[];
  counts: Record<string, number>;
}

function cfg(room: Room): RuletaConfig {
  return room.config as RuletaConfig;
}

function round(room: Room): RuletaRound {
  return room.round as RuletaRound;
}

function createConfig(): RuletaConfig {
  return { entries: [], mode: "eliminate" };
}

function startRound(room: Room): { success?: true; error?: string } {
  const entries = cfg(room).entries || [];
  if (entries.length < 2) return { error: "Cargá al menos 2 entradas" };
  room.round = {
    pool: entries,
    rotation: 0,
    result: null,
    spinAt: null,
    eliminated: [],
    counts: {},
  } satisfies RuletaRound;
  room.phase = "round";
  return { success: true };
}

function handleAction(room: Room, playerId: string, action: string, _payload: Record<string, unknown>): { handled: boolean } {
  const r = room.round ? round(room) : null;
  const mode = cfg(room).mode;

  switch (action) {
    case "spin": {
      if (!r || room.phase !== "round") return { handled: false };
      if (room.hostId !== playerId) return { handled: false };
      if (r.result) return { handled: false };
      if (r.pool.length < 2) return { handled: false };

      const idx = Math.floor(Math.random() * r.pool.length);
      const seg = 360 / r.pool.length;
      const center = idx * seg + seg / 2;
      const targetMod = (360 - center + 360) % 360;
      const currentMod = ((r.rotation % 360) + 360) % 360;
      const extra = (targetMod - currentMod + 360) % 360;
      r.rotation = r.rotation + 5 * 360 + extra;

      r.result = r.pool[idx];
      r.spinAt = Date.now();
      return { handled: true };
    }

    case "confirm_eliminate": {
      if (!r || room.phase !== "round") return { handled: false };
      if (room.hostId !== playerId) return { handled: false };
      if (mode !== "eliminate") return { handled: false };
      if (!r.result) return { handled: false };
      r.pool = r.pool.filter(e => e.id !== r.result!.id);
      r.eliminated.push(r.result);
      r.result = null;
      r.spinAt = null;
      return { handled: true };
    }

    case "spin_again": {
      if (!r || room.phase !== "round") return { handled: false };
      if (room.hostId !== playerId) return { handled: false };
      if (mode !== "keep") return { handled: false };
      if (!r.result) return { handled: false };
      r.counts[r.result.id] = (r.counts[r.result.id] || 0) + 1;
      r.result = null;
      r.spinAt = null;
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

function maybeAdvance(room: Room): void {
  if (!room.round || room.phase !== "round") return;
  const r = round(room);
  if (cfg(room).mode === "eliminate" && r.pool.length < 2 && !r.result) {
    room.phase = "result";
  }
}

function getPublicRoundView(room: Room): Record<string, unknown> | null {
  if (!room.round) return null;
  const r = round(room);
  return {
    mode: cfg(room).mode,
    entries: cfg(room).entries,
    pool: r.pool,
    rotation: r.rotation,
    result: r.result,
    spinAt: r.spinAt,
    spinMs: SPIN_MS,
    eliminated: r.eliminated,
    counts: r.counts,
  };
}

function getPrivateView(): null {
  return null;
}

function getRevealMessage(): null {
  return null;
}

const engine: GameEngine = {
  id: "ruleta",
  minPlayers: MIN_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
  getRevealMessage,
};

module.exports = engine;
