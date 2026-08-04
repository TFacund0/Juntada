import type { DrawAction } from "../components/Canvas";

/** Una entrada del chat en vivo: un intento escrito, o el aviso de que alguien acertó. */
export interface ChatEntry {
  type: "chat" | "correct";
  playerId: string;
  text?: string;
}

/** Forma de `room.round` para este juego, tal como la envía el motor online. */
export interface RayadoLibreRoundState {
  turnNumber: number;
  totalTurns: number;
  drawerId: string;
  chooseTimerEnd?: number | null;
  timerEnd?: number | null;
  strokes?: DrawAction[];
  chatLog?: ChatEntry[];
  correctGuessers?: string[];
  roundPoints?: Record<string, number>;
  wordHint?: string;
  word?: string;
  /** Si quien dibuja ya usó su "pedir otra palabra" este turno (ver `reroll_word`) — una sola vez, y solo antes de que alguien acierte. */
  rerollUsed?: boolean;
}
