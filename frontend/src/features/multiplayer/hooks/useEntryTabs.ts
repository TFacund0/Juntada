import { useState } from "react";

/**
 * Estado de la tab activa ("crear"/"unirse") para las cards de entrada a una
 * sala o a un grupo (RoomEntryCard/GroupEntryCard) — idéntico en las dos
 * pese a que cada una tiene su propio look (tabs pastilla vs. subrayado,
 * badge romboidal vs. sin badge): esta pieza es organización de estado, no
 * apariencia, así que compartirla no choca con que se vean distintas.
 *
 * `connectionPhase` arranca en "menu" hasta que se toca una pestaña (o llega
 * ya con una intención inicial, ver initialGroupIntent en App.tsx) — "menu"
 * no tiene tab propio en ninguno de los dos diseños, así que cae en "create"
 * por defecto.
 */
export function useEntryTabs(connectionPhase: string, onSetPhase: (phase: "create" | "join" | "menu") => void) {
  const [localTab, setLocalTab] = useState<"create" | "join">(connectionPhase === "join" ? "join" : "create");

  const activeTab = connectionPhase === "join" ? "join" : connectionPhase === "create" ? "create" : localTab;

  const selectTab = (tab: "create" | "join") => {
    setLocalTab(tab);
    onSetPhase(tab);
  };

  return { activeTab, selectTab };
}
