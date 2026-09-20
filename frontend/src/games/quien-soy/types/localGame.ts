export interface LocalPlayer {
  id: string;
  name: string;
}

export interface QAEntry {
  turnPlayerId: string;
  question: string;
  answer: "si" | "no";
}

export type Phase = "setup" | "turnHandoff" | "turnAction" | "answerHandoff" | "answerInput" | "final";
