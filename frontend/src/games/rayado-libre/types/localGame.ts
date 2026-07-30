export interface LocalPlayer {
  id: number;
  name: string;
}

export type LocalGamePhase = "setup" | "wordReveal" | "drawing" | "reveal" | "result";
