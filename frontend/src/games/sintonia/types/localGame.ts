export interface LocalPlayer {
  id: number;
  name: string;
}

export interface RoundData {
  left: string | null;
  right: string | null;
  target: number | null;
  psychicId: number;
  psychicName: string;
  clue: string | null;
  guesses: Record<number, number>;
  pointsByPlayer?: Record<number, number>;
}

export interface HistoryEntry {
  left: string;
  right: string;
  target: number;
  psychicId: number;
  psychicName: string;
  guesses: Record<number, number>;
  pointsByPlayer: Record<number, number>;
}
