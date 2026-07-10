import { LocalGame } from "./LocalGame";
import { ConfigPanel } from "./ConfigPanel";
import { RoundView } from "./RoundView";

// Wavelength-style game: en cada ronda a alguien le toca ver un punto secreto
// del dial entre dos conceptos opuestos (ej. "Frío" ↔ "Caliente"). En local se
// da la pista en voz alta; en online se escribe una frase y el resto adivina
// desde su propio dispositivo, con puntaje competitivo entre todos.
export const sintoniaGame = {
  id: "sintonia",
  label: "Sintonía",
  icon: "📡",
  description: "Uno ve un punto secreto entre dos conceptos opuestos y da una pista. Los demás intentan adivinar dónde quedó.",
  minPlayers: 2,
  LocalGame,
  ConfigPanel,
  RoundView,
};
