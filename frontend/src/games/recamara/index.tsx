import type { GameDef } from "../gameTypes";
import { LocalGame } from "./LocalGame";
import { ConfigPanel } from "./components/ConfigPanel";
import { RoundView } from "./RoundView";

// Duelo por turnos estilo Buckshot Roulette (2 a 6 jugadores): escopeta con
// cartuchos reales y falsos en orden oculto, más ítems de un solo uso. Local
// (un dispositivo) y online (backend/src/games/recamara/engine.ts) comparten
// exactamente las mismas reglas vía @juntada/recamara-engine.
export const recamaraGame: GameDef = {
  id: "recamara",
  label: "Recámara",
  icon: "🔫",
  description:
    "Duelo con una escopeta cargada con cartuchos reales y falsos en orden oculto. En cada turno elegís dispararte a vos o a otro jugador, y usás ítems (lupa, cigarrillo, sierra, inversor, ladrón, teléfono, esposas) para blofear o jugar sobre seguro.",
  minPlayers: 2,
  category: "tematicos",
  gameTheme: "recamara",
  rules: [
    "La recámara se carga con entre 3 y 8 cartuchos, mezcla de reales y falsos en una proporción aleatoria, en un orden que nadie conoce de antemano.",
    "En tu turno, elegís dispararte a vos mismo o a otro jugador.",
    "Cartucho falso: no pasa nada. Si te disparaste a vos mismo con uno falso, seguís jugando el turno.",
    "Cartucho real: quien lo recibe pierde una o más vidas.",
    "Cada vez que se agota la recámara, se recarga y todos los jugadores reciben 2 ítems nuevos al azar.",
    "Los ítems se usan una sola vez: lupa (ver la bala actual), cigarrillo (curar una vida), sierra (duplicar el daño del próximo disparo real), inversor (cambiar el sentido de los turnos), ladrón (robarle un ítem a otro jugador), teléfono (pista sobre una bala futura) y esposas (el objetivo pierde su próximo turno).",
    "Gana quien queda como último jugador con vidas.",
  ],
  LocalGame,
  ConfigPanel,
  RoundView,
};
