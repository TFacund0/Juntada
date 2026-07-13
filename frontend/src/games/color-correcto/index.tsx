import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Se muestra una grilla de colores casi idénticos y hay que tocar el que
// es ligeramente distinto antes que los demás. Menu entry only for now —
// see ComingSoon.
export const colorCorrectoGame: GameDef = {
  id: "color-correcto",
  label: "Encuentra el Color Correcto",
  icon: "🟪",
  description: "Una grilla de colores casi idénticos esconde uno ligeramente distinto. Hay que encontrarlo y tocarlo antes que el resto.",
  minPlayers: 2,
  category: "rapidos",
  comingSoon: true,
  rules: [
    "Se muestra una grilla de casilleros con el mismo color, salvo uno ligeramente distinto.",
    "Todos buscan el casillero diferente al mismo tiempo.",
    "Gana quien lo toque primero.",
    "En cada ronda el color diferente cambia de posición y la diferencia se hace más sutil.",
  ],
  LocalGame: () => <ComingSoon label="Encuentra el Color Correcto" />,
  ConfigPanel: () => <ComingSoon label="Encuentra el Color Correcto" />,
  RoundView: () => <ComingSoon label="Encuentra el Color Correcto" />,
};
