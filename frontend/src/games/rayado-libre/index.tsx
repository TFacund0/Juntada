import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Juego de dibujo estilo Pictionary con nombre propio (para evitar
// conflictos de marca registrada): un jugador dibuja una palabra o frase
// secreta y el resto adivina antes de que se acabe el tiempo. Menu entry
// only for now — see ComingSoon.
export const rayadoLibreGame: GameDef = {
  id: "rayado-libre",
  label: "Rayado Libre",
  icon: "🎨",
  description: "Un jugador dibuja una palabra secreta sin usar letras ni números y el resto del grupo intenta adivinarla antes de que se acabe el tiempo.",
  minPlayers: 3,
  category: "equipos",
  comingSoon: true,
  rules: [
    "En cada ronda, un jugador recibe una palabra o frase secreta para dibujar.",
    "No puede hablar, escribir letras ni números, solo dibujar.",
    "El resto intenta adivinar la palabra antes de que se acabe el tiempo.",
    "Quien adivina correctamente (y quien dibujó) suman puntos.",
  ],
  LocalGame: () => <ComingSoon label="Rayado Libre" />,
  ConfigPanel: () => <ComingSoon label="Rayado Libre" />,
  RoundView: () => <ComingSoon label="Rayado Libre" />,
};
