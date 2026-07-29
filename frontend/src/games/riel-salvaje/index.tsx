import type { GameDef } from "../gameTypes";
import { LocalGame } from "./LocalGame";
import { ConfigPanel } from "./ConfigPanel";
import { RoundView } from "./RoundView";

// Atraco por turnos, con planificación de cartas de acción y ejecución en
// bloque después. Seis forajidos suben a un tren en marcha, apilan sus
// cartas turno a turno y después se revela y ejecuta todo en el orden en
// que se jugó. Ver DESIGN.md en esta carpeta para la especificación completa
// (personajes, fases, botín, Marshal, etc.). Fase 4 del PLAN.md: reskin
// visual completo (theme/gameThemes.ts, referencia: el artifact "Riel
// Salvaje — Set completo de pantallas") + transición a landscape.
export const rielSalvajeGame: GameDef = {
  id: "riel-salvaje",
  label: "Riel Salvaje",
  icon: "🚂",
  description:
    "Seis forajidos, un tren en marcha. Apilás tus cartas de acción turno a turno y después se revelan y ejecutan todas en orden — quien junte más botín al final de la 5ª ronda gana.",
  minPlayers: 3,
  category: "tematicos",
  gameTheme: "riel-salvaje",
  landscapeRound: true,
  rules: [
    "Cada ronda tiene dos fases: Planificación y Acción.",
    "En Planificación, cada jugador apila una carta (Mover, Cambiar de piso, Robar, Disparar, Golpear, Mover al Marshal) en su propio mazo, turno a turno — boca arriba por defecto, o boca abajo si el turno es 'Túnel'.",
    "En Acción se resuelve el mazo de cada jugador en el orden en que se apiló, revelando recién ahí las cartas que quedaron ocultas.",
    "El botín está repartido por los vagones: bolsas de dinero (valor oculto hasta robarlas), joyas ($500) y un maletín ($1000) en la Locomotora, custodiado por el Marshal.",
    "El Marshal se mueve por acción de los jugadores o por eventos de ronda. Si comparte vagón con un bandido, ese jugador sube al techo y recibe una bala neutral.",
    "Al final de la partida, quien más balas haya disparado en total gana el Título de Pistolero: un bono de $1000 (empates cobran todos).",
    "Se juegan 5 rondas fijas. Al terminar la última, gana quien tenga más valor acumulado en botín.",
  ],
  LocalGame,
  ConfigPanel,
  RoundView,
};
