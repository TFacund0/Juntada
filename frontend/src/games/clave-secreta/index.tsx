import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Juego de mesa por equipos (Rojo vs Azul): un "spymaster" por equipo da
// pistas de una palabra + un número para que su equipo adivine palabras
// relacionadas en un tablero de 5x5, evitando la palabra "asesina" y las del
// equipo contrario. Ver DESIGN.md en esta carpeta para la especificación
// completa (roles, flujo de turno, features de sala, etc.) antes de
// implementarlo. Menu entry only for now — see ComingSoon.
export const claveSecretaGame: GameDef = {
  id: "clave-secreta",
  label: "Clave Secreta",
  icon: "🗝️",
  description:
    "Por equipos: el spymaster da una pista (palabra + número) para que su equipo adivine las palabras del tablero sin caer en la del rival ni en la asesina.",
  minPlayers: 4,
  category: "equipos",
  comingSoon: true,
  rules: [
    "Dos equipos (Rojo y Azul). Cada uno tiene un spymaster (ve los colores ocultos de las 25 palabras) y uno o más operatives (solo ven las palabras).",
    'El spymaster del equipo activo da una pista: una palabra + un número (por ejemplo "Océano 3").',
    "Su equipo puede adivinar hasta número + 1 veces, tocando palabras del tablero:",
    "- Si es del color correcto, se revela y pueden seguir adivinando.",
    "- Si es neutral o del otro equipo, el turno termina ahí.",
    '- Si es la palabra "asesina", el equipo pierde en el acto.',
    "El equipo puede pasar el turno voluntariamente cuando quiera.",
    "Gana el equipo que revela primero las 9 palabras propias.",
  ],
  LocalGame: () => <ComingSoon label="Clave Secreta" />,
  ConfigPanel: () => <ComingSoon label="Clave Secreta" />,
  RoundView: () => <ComingSoon label="Clave Secreta" />,
};
