import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Juego de reflejos: todos miran la pantalla esperando que cambie de
// color, y gana quien la toca primero apenas cambia (tocar antes de
// tiempo penaliza). Menu entry only for now — see ComingSoon.
export const reaccionGame: GameDef = {
  id: "reaccion",
  label: "Reacción",
  icon: "⚡",
  description:
    "La pantalla cambia de color en un momento aleatorio. Hay que tocarla lo más rápido posible apenas cambia, sin tocar antes de tiempo.",
  minPlayers: 2,
  category: "rapidos",
  comingSoon: true,
  rules: [
    "Todos los jugadores tienen el dedo listo sobre la pantalla.",
    "En un momento aleatorio, la pantalla cambia de color.",
    "Gana quien la toque primero después del cambio.",
    "Tocar antes de que cambie el color penaliza o descalifica esa ronda.",
  ],
  LocalGame: () => <ComingSoon label="Reacción" />,
  ConfigPanel: () => <ComingSoon label="Reacción" />,
  RoundView: () => <ComingSoon label="Reacción" />,
};
