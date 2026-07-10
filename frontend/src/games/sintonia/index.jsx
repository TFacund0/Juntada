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
  rules: [
    "En cada ronda alguien es el \"psíquico\" y ve un punto secreto en un dial entre dos conceptos opuestos (por ejemplo \"Frío\" ↔ \"Caliente\").",
    "El psíquico da (o escribe) una pista relacionada con ese punto, sin nombrarlo directamente.",
    "El resto adivina, por turnos, moviendo la aguja lo más cerca posible del punto secreto.",
    "Al final se revela el objetivo con la marca de cada uno.",
    "Puntaje: cada jugador que adivina anota según qué tan cerca cayó su marca, y el psíquico se lleva la suma de lo que ganaron entre todos los que adivinaron — una buena pista vale tanto como acertarla en persona.",
    "Antes de cada ronda se puede elegir quién es el psíquico (sugerido, a mano o al azar) y qué par de conceptos usar (al azar de la base o escrito a mano).",
  ],
  LocalGame,
  ConfigPanel,
  RoundView,
};
