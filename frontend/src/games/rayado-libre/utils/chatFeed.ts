import type { ChatEntry } from "../types/roundView";

/** Una línea ya resuelta del chat de respuestas (ver ChatLine). */
export type ChatFeedItem =
  | { kind: "sys"; key: string; text: string }
  | { kind: "msg"; key: string; playerId: string; name: string; mine: boolean; close: boolean; text: string }
  | { kind: "ok"; key: string; playerId: string; name: string; mine: boolean; points: number };

export interface ChatFeedInput {
  chatLog: readonly ChatEntry[];
  players: readonly { id: string; name: string }[];
  myId: string | undefined;
  /** Mis intentos "cerca" (vista privada); se ignora cualquier id que no sea mío. */
  closeEntryIds: readonly number[];
  roundPoints: Record<string, number>;
  /** Línea de sistema al principio ("X está dibujando…"), armada en el cliente — no viaja por el servidor. */
  systemLine?: string;
}

/**
 * Convierte el log del turno en las líneas del chat: mensajes propios o de
 * otros (marcando los "cerca" propios) y aciertos con sus puntos — nunca la
 * palabra. Las entradas de alguien que ya se fue de la sala se omiten.
 */
export function buildChatFeed({ chatLog, players, myId, closeEntryIds, roundPoints, systemLine }: ChatFeedInput): ChatFeedItem[] {
  const names = new Map(players.map(p => [p.id, p.name]));
  const close = new Set(closeEntryIds);
  const items: ChatFeedItem[] = systemLine ? [{ kind: "sys", key: "sys", text: systemLine }] : [];
  for (const entry of chatLog) {
    const name = names.get(entry.playerId);
    if (name === undefined) continue;
    const mine = entry.playerId === myId;
    const key = String(entry.id);
    if (entry.type === "correct") {
      items.push({ kind: "ok", key, playerId: entry.playerId, name, mine, points: roundPoints[entry.playerId] ?? 0 });
    } else {
      items.push({ kind: "msg", key, playerId: entry.playerId, name, mine, close: mine && close.has(entry.id), text: entry.text ?? "" });
    }
  }
  return items;
}

/**
 * Cuántos pueden acertar este turno, para el "N/M ✓" de la cabecera: todos
 * menos quien dibuja, sin contar a los desconectados que todavía no
 * acertaron — el turno termina cuando aciertan todos los conectados (ver
 * maybeAdvance en el motor), así que ese es el total real a completar.
 */
export function eligibleGuessers(
  players: readonly { id: string; online?: boolean }[],
  drawerId: string | null,
  correctGuessers: readonly string[],
): number {
  return players.filter(p => p.id !== drawerId && (p.online !== false || correctGuessers.includes(p.id))).length;
}

export const DRAWER_TIP = "Dibujá sin letras ni números. Cuanto antes adivinen, más puntos.";
export const drawingNowLine = (drawerName: string) => `${drawerName} está dibujando…`;
export const EMPTY_CHAT_GUESSER = "Todavía nadie escribió nada.";
export const EMPTY_CHAT_DRAWER = "Acá van a aparecer las respuestas de los demás.";
