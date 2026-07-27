import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Atraco por turnos simultáneos ocultos, inspirado en el juego de mesa Colt
// Express (Raimbault / Valbuena): seis forajidos suben a un tren en marcha,
// planifican sus movimientos a ciegas y después se revelan y ejecutan todos
// a la vez. Pensado para jugarse en landscape. Ver DESIGN.md en esta carpeta
// para la especificación completa (personajes, fases, botín, Sheriff,
// Marshal, etc.) antes de implementarlo. Menu entry only for now — see
// ComingSoon.
export const coltExpressGame: GameDef = {
  id: "colt-express",
  label: "Colt Express",
  icon: "🚂",
  description:
    "Seis forajidos, un tren en marcha. Planificás tus cartas de acción a ciegas y después se revelan y ejecutan todas a la vez — quien junte más botín al final del último asalto gana.",
  minPlayers: 2,
  category: "equipos",
  comingSoon: true,
  rules: [
    "Cada ronda tiene dos fases: Planificación y Acción.",
    "En Planificación, cada jugador apila 1-2 cartas (Moverse, Robar, Disparar, Golpear, Subir/bajar del techo) en su mazo sin ver lo que hacen los demás. Algunas rondas permiten una carta boca abajo.",
    "En Acción se combinan los mazos de todos los jugadores y se ejecutan carta por carta, en el orden en que se apilaron.",
    "El botín está repartido por los vagones: bolsas de dinero, diamantes, y un maletín de mayor valor en la Locomotora custodiado por el Sheriff.",
    "El Marshal se mueve por el techo del tren y dispara a quien comparta su vagón, quitándole un ítem de botín.",
    "Cada disparo que le acertás a un mismo rival queda contado: al quinto disparo sobre esa persona cobrás un bono de $1000 al instante.",
    "Tras el último asalto, gana quien tenga más valor acumulado en botín.",
  ],
  LocalGame: () => <ComingSoon label="Colt Express" />,
  ConfigPanel: () => <ComingSoon label="Colt Express" />,
  RoundView: () => <ComingSoon label="Colt Express" />,
};
