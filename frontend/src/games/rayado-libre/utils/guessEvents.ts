import type { ChatEntry } from "../types/roundView";

/** Un acierto del turno, visto desde este dispositivo (ver useGuessFx). */
export interface GuessEvent {
  /** Estable por acierto; es también el `data-fx-anchor` de su línea (chat o lista local). */
  key: string;
  /** Color del jugador (el de su avatar), para la mancha junto a su línea. */
  color: string;
  points: number;
  /** Lo adiviné yo. */
  mine: boolean;
}

interface OnlineGuessInput {
  chatLog: readonly ChatEntry[];
  players: readonly { id: string; name: string }[];
  roundPoints: Readonly<Record<string, number>>;
  myId: string | undefined;
  /** Color de cada jugador (el de su avatar). */
  colorOf: (name: string) => string;
}

/** Los aciertos del turno online, desde las líneas "correct" del chat (su id es la clave y el ancla de la línea). */
export function onlineGuessEvents({ chatLog, players, roundPoints, myId, colorOf }: OnlineGuessInput): GuessEvent[] {
  const names = new Map(players.map(p => [p.id, p.name]));
  return chatLog.flatMap(entry => {
    const name = names.get(entry.playerId);
    if (entry.type !== "correct" || name === undefined) return [];
    return [{ key: String(entry.id), color: colorOf(name), points: roundPoints[entry.playerId] ?? 0, mine: entry.playerId === myId }];
  });
}

interface LocalGuessInput {
  correctGuessers: readonly number[];
  players: readonly { id: number; name: string }[];
  points: Readonly<Record<number, number>>;
  colorOf: (name: string) => string;
}

/** Los aciertos del turno local, en el orden en que se marcaron (anclados al botón de cada uno en "¿Quién acertó?"). */
export function localGuessEvents({ correctGuessers, players, points, colorOf }: LocalGuessInput): GuessEvent[] {
  return correctGuessers.flatMap(id => {
    const player = players.find(p => p.id === id);
    return player ? [{ key: `guess-${id}`, color: colorOf(player.name), points: points[id] ?? 0, mine: false }] : [];
  });
}
