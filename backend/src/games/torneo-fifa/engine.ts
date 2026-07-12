// ─── Torneo FIFA Game Engine ─────────────────────────────────────────────────
// Bracket tournament organizer: host assigns a team to each joined player
// (config.assignments) and arranges the crossing order (config.seedOrder)
// from the lobby, then starts the tournament — the bracket is built once and
// lives in room.round.rounds. Match results are reported by the host via the
// "report_result" action. No private per-player info; everything is public.
//
// Phase "round" (not "bracket") on purpose: roomService only allows joining
// a room whose phase is "lobby" or "round", so friends can still join while
// the tournament is in progress. Phase becomes "champion" once the final is
// decided.

import type { Room } from "@juntada/shared-types";
import type { GameEngine } from "../engineTypes";

const { shuffle } = require("../../utils/shuffle");

interface Entrant {
  id: string;
  name: string;
  team: string;
}

interface Match {
  a: Entrant | null;
  b: Entrant | null;
  winner: Entrant | null;
  goalsA: number | null;
  goalsB: number | null;
}

interface TorneoFifaConfig {
  trackGoals: boolean;
  teams: string[];
  assignments: Record<string, string>;
  seedOrder: string[];
  [key: string]: unknown;
}

interface TorneoFifaRound {
  rounds: Match[][];
  trackGoals: boolean;
}

function cfg(room: Room): TorneoFifaConfig {
  return room.config as TorneoFifaConfig;
}

function round(room: Room): TorneoFifaRound {
  return room.round as TorneoFifaRound;
}

const MIN_PLAYERS = 2;

const DEFAULT_TEAMS = [
  "Argentina",
  "Brasil",
  "Francia",
  "España",
  "Alemania",
  "Inglaterra",
  "Italia",
  "Portugal",
  "Países Bajos",
  "Bélgica",
  "Uruguay",
  "Croacia",
];

function createConfig(): TorneoFifaConfig {
  return {
    trackGoals: true,
    teams: DEFAULT_TEAMS.slice(0, 8),
    assignments: {}, // playerId -> team
    seedOrder: [], // playerId[], cruces order for round 0
  };
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Pushes an already-decided winner into the next round's slot. Does NOT
// invent new winners for the next round — with byes distributed one-per-pair
// (see buildBracket) every later-round match always ends up with two real
// contenders, even if one arrives instantly via a round-0 bye and the other
// only after a real match is played.
function propagateByes(rounds: Match[][]): void {
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((match, i) => {
      if (match.winner) {
        const nextMatch = rounds[r + 1][Math.floor(i / 2)];
        if (i % 2 === 0) nextMatch.a = match.winner;
        else nextMatch.b = match.winner;
      }
    });
  }
}

function buildBracket(entrants: Entrant[]): Match[][] {
  // Byes only go to the trailing entrants (matches the "los últimos N pasan
  // directo" copy shown in the UI), and each bye gets its own pair with an
  // empty slot — never two byes paired against each other, so no round-0
  // match is ever left with zero real players.
  const size = nextPowerOf2(entrants.length);
  const pairCount = size / 2;
  const byeCount = size - entrants.length;
  const normalPairs = pairCount - byeCount;

  const pool = [...entrants];
  const round0: Match[] = [];
  for (let i = 0; i < normalPairs; i++) {
    round0.push({ a: pool.shift() ?? null, b: pool.shift() ?? null, winner: null, goalsA: null, goalsB: null });
  }
  for (let i = 0; i < byeCount; i++) {
    const a = pool.shift() ?? null;
    round0.push({ a, b: null, winner: a, goalsA: null, goalsB: null });
  }

  const rounds: Match[][] = [round0];
  let count = round0.length;
  while (count > 1) {
    count = count / 2;
    rounds.push(Array.from({ length: count }, () => ({ a: null, b: null, winner: null, goalsA: null, goalsB: null })));
  }
  propagateByes(rounds);
  return rounds;
}

function startRound(room: Room): { success?: true; error?: string } {
  if (room.players.length < MIN_PLAYERS) return { error: `Necesitás al menos ${MIN_PLAYERS} jugadores` };

  const { assignments, teams } = cfg(room);
  const missing = room.players.filter(p => !assignments[p.id]);
  if (missing.length > 0) return { error: "Asigná un equipo a cada jugador antes de iniciar" };
  if (!teams || teams.length < room.players.length) return { error: "Necesitás al menos un equipo por jugador" };

  const playerIds = room.players.map(p => p.id);
  const validSeed =
    Array.isArray(cfg(room).seedOrder) &&
    cfg(room).seedOrder.length === playerIds.length &&
    playerIds.every(id => cfg(room).seedOrder.includes(id));
  const seedOrder: string[] = validSeed ? cfg(room).seedOrder : shuffle(playerIds);

  const entrants: Entrant[] = seedOrder.map(id => {
    const p = room.players.find(x => x.id === id)!;
    return { id: p.id, name: p.name, team: assignments[p.id] };
  });

  room.round = {
    rounds: buildBracket(entrants),
    trackGoals: !!cfg(room).trackGoals,
  } satisfies TorneoFifaRound;
  room.phase = "round";
  return { success: true };
}

// No auto-advance conditions in this game — progression only happens when
// the host reports a match result via handleAction.
function maybeAdvance(): void {}

function championIfDecided(room: Room): void {
  const rounds = round(room).rounds;
  const final = rounds[rounds.length - 1][0];
  if (final.winner) room.phase = "champion";
}

function handleAction(room: Room, playerId: string, action: string, payload: Record<string, unknown>): { handled: boolean } {
  if (!room.round) return { handled: false };
  if (playerId !== room.hostId) return { handled: false }; // only the host runs the bracket

  switch (action) {
    case "report_result": {
      if (room.phase !== "round") return { handled: false };
      const roundIdx = payload.roundIdx as number;
      const matchIdx = payload.matchIdx as number;
      const match = round(room).rounds?.[roundIdx]?.[matchIdx];
      if (!match || !match.a || !match.b || match.winner) return { handled: false };

      if (round(room).trackGoals) {
        const ga = Number(payload.goalsA),
          gb = Number(payload.goalsB);
        if (!Number.isInteger(ga) || !Number.isInteger(gb) || ga < 0 || gb < 0 || ga === gb) return { handled: false };
        match.goalsA = ga;
        match.goalsB = gb;
        match.winner = ga > gb ? match.a : match.b;
      } else {
        if (payload.winnerSide !== "a" && payload.winnerSide !== "b") return { handled: false };
        match.winner = payload.winnerSide === "a" ? match.a : match.b;
      }
      propagateByes(round(room).rounds);
      championIfDecided(room);
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

function getPublicRoundView(room: Room): Record<string, unknown> | null {
  if (!room.round) return null;
  return { rounds: round(room).rounds, trackGoals: round(room).trackGoals };
}

function getPrivateView(): null {
  return null;
}

const engine: GameEngine = {
  id: "torneo-fifa",
  minPlayers: MIN_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
};

module.exports = engine;
