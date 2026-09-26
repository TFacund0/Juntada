import type { DrawAction } from "../components/Canvas";

/** Una entrada del chat en vivo: un intento escrito, o el aviso de que alguien acertó. */
export interface ChatEntry {
  /** Creciente dentro de la partida: clave estable y lo que marca `closeEntryIds`. */
  id: number;
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
  /** Solo en "reveal": segundos que quedaban cuando acertó cada uno ("adivinó con 57s"). */
  guessSeconds?: Record<string, number>;
  wordHint?: string;
  word?: string;
  /** Quiénes están escribiendo: id → cuándo se apaga el indicador (ver `activeTypingIds`). */
  typingUntil?: Record<string, number>;
}

/** Lo que el chat necesita de la vista privada de este jugador (`private_role`). */
export interface PrivateChatView {
  /** Mis intentos que quedaron "cerca" — solo me llegan a mí. */
  closeEntryIds: readonly number[];
  /** La palabra, solo si ya la adiviné (para "¡Era PALABRA!"). */
  guessedWord?: string;
}
